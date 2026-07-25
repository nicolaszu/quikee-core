import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseJsonc } from './jsonc.js';

export interface RunMigrationsOptions {
  /** D1 database name. Defaults to the one resolved from wrangler.jsonc. */
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

/**
 * Read the D1 database name from wrangler.jsonc.
 *
 * Each app is ONE Worker with ONE database, declared at the top level — branch
 * preview versions are versions of that same Worker and share it.
 */
export function resolveDatabaseName(configPath: string): string {
  const cfg = parseJsonc(readFileSync(configPath, 'utf8')) as {
    d1_databases?: Array<{ database_name?: string }>;
  };
  const name = cfg.d1_databases?.[0]?.database_name;
  if (!name) {
    throw new Error(
      `No d1_databases[0].database_name found in ${configPath}. ` +
        `If this app has no storage, skip migrations (do not call quikee-migrate).`,
    );
  }
  return name;
}

/**
 * Record the current Time Travel bookmark before migrating.
 *
 * Preview builds migrate the *production* database, so this restore point is the
 * only thing standing between a bad migration and lost data. Note restoring is a
 * whole-database rewind — it also discards every write since the bookmark — so it
 * is a genuine last resort, not an "undo this migration" button.
 */
export function captureBookmark(database: string, cwd: string): string | null {
  try {
    const out = sh(['wrangler', 'd1', 'time-travel', 'info', database], cwd);
    // Wrangler prints: The current bookmark is '00000001-00000002-000050b3-9cf2…'
    // Match the token shape itself — keying off the word "bookmark" alone would
    // capture the following word ("is") instead of the value.
    const match = out.match(/[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{32}/i);
    const bookmark = match?.[0] ?? null;
    console.log(
      `\n[quikee] Pre-migration Time Travel bookmark for "${database}": ${bookmark ?? 'unknown'}`,
    );
    if (bookmark) {
      console.log(
        `[quikee] Last resort rollback (rewinds the WHOLE database, discarding later writes):\n` +
          `[quikee]   wrangler d1 time-travel restore ${database} --bookmark=${bookmark}\n`,
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

/** Apply pending (additive-only) migrations against the remote D1. */
export function applyMigrations(database: string, cwd: string): void {
  console.log(`[quikee] Applying migrations to "${database}"...`);
  sh(['wrangler', 'd1', 'migrations', 'apply', database, '--remote'], cwd);
}

/**
 * The invariant deploy-time ritual: capture the bookmark, then apply migrations.
 * CI runs this before both `wrangler deploy` (main) and `wrangler versions upload`
 * (branches). Safe to re-run — only new migrations apply.
 */
export function runMigrations(opts: RunMigrationsOptions = {}): void {
  const cwd = opts.cwd ?? process.cwd();
  const configPath = opts.configPath ?? `${cwd}/wrangler.jsonc`;
  const database = opts.database ?? resolveDatabaseName(configPath);

  captureBookmark(database, cwd);
  applyMigrations(database, cwd);
  console.log(`[quikee] Migrations complete for "${database}".`);
}
