import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseJsonc } from './jsonc.js';

export type DeployEnv = 'production' | 'preview';

export interface RunMigrationsOptions {
  /** Target Wrangler environment. Defaults to process.env.CLOUDFLARE_ENV. */
  env?: DeployEnv;
  /** D1 database name. Defaults to the one resolved from wrangler.jsonc for `env`. */
  database?: string;
  /** Path to the Wrangler config. Defaults to ./wrangler.jsonc. */
  configPath?: string;
  /** Working directory for wrangler invocations. Defaults to process.cwd(). */
  cwd?: string;
}

function sh(args: string[], cwd: string): string {
  return execFileSync('npx', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

/** Read the D1 database name configured for a given environment in wrangler.jsonc. */
export function resolveDatabaseName(configPath: string, env: DeployEnv): string {
  const cfg = parseJsonc(readFileSync(configPath, 'utf8')) as {
    env?: Record<string, { d1_databases?: Array<{ database_name?: string }> }>;
  };
  const name = cfg.env?.[env]?.d1_databases?.[0]?.database_name;
  if (!name) {
    throw new Error(
      `No d1_databases[0].database_name found for env "${env}" in ${configPath}. ` +
        `If this app has no storage, skip migrations (do not call quikee-migrate).`,
    );
  }
  return name;
}

/**
 * Capture the current Time Travel bookmark so the exact pre-migration restore
 * point is recorded in the build log. Best-effort: Time Travel is always on, so a
 * restore point exists regardless; this just pins the precise one.
 */
export function captureBookmark(database: string, env: DeployEnv, cwd: string): string | null {
  try {
    const out = sh(['wrangler', 'd1', 'time-travel', 'info', database, '--env', env], cwd);
    // Wrangler prints: The current bookmark is '00000001-00000002-000050b3-9cf2…'
    // Match the token shape itself — keying off the word "bookmark" alone would
    // capture the following word ("is") instead of the value.
    const match = out.match(/[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{32}/i);
    const bookmark = match?.[0] ?? null;
    console.log(
      `\n[quikee] Pre-migration Time Travel bookmark for "${database}" (${env}): ${bookmark ?? 'unknown'}`,
    );
    if (bookmark) {
      console.log(
        `[quikee] To roll back: wrangler d1 time-travel restore ${database} --env ${env} --bookmark=${bookmark}\n`,
      );
    }
    return bookmark;
  } catch {
    console.warn(
      `[quikee] WARN: could not read Time Travel bookmark for "${database}". ` +
        `Time Travel is always on, so a restore point still exists. Continuing.`,
    );
    return null;
  }
}

/** Apply pending (additive-only) migrations against the remote D1 for this env. */
export function applyMigrations(database: string, env: DeployEnv, cwd: string): void {
  console.log(`[quikee] Applying migrations to "${database}" (${env})...`);
  sh(['wrangler', 'd1', 'migrations', 'apply', database, '--remote', '--env', env], cwd);
}

/**
 * The invariant deploy-time ritual: capture the bookmark, then apply migrations.
 * CI runs this before `wrangler deploy`. Safe to re-run — only new migrations apply.
 */
export function runMigrations(opts: RunMigrationsOptions = {}): void {
  const cwd = opts.cwd ?? process.cwd();
  const env = opts.env ?? (process.env.CLOUDFLARE_ENV as DeployEnv | undefined);
  if (env !== 'production' && env !== 'preview') {
    throw new Error(
      `runMigrations requires env "production" or "preview" (got ${String(env)}). ` +
        `Set CLOUDFLARE_ENV on the build trigger.`,
    );
  }
  const configPath = opts.configPath ?? `${cwd}/wrangler.jsonc`;
  const database = opts.database ?? resolveDatabaseName(configPath, env);

  captureBookmark(database, env, cwd);
  applyMigrations(database, env, cwd);
  console.log(`[quikee] Migrations complete for "${database}" (${env}).`);
}
