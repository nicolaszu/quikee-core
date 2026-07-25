#!/usr/bin/env node
import { runMigrations, type DeployEnv } from './ritual.js';

/**
 * `quikee-migrate` — the deploy-time migration ritual as a CLI, invoked by CI
 * before `wrangler deploy`. Reads CLOUDFLARE_ENV (set per build trigger) unless
 * --env is passed.
 *
 *   quikee-migrate                       # uses CLOUDFLARE_ENV
 *   quikee-migrate --env preview
 *   quikee-migrate --database my-app-staging --env preview
 */
function main(): void {
  const argv = process.argv.slice(2);
  let env: DeployEnv | undefined;
  let database: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--env') env = argv[++i] as DeployEnv;
    else if (a === '--database') database = argv[++i];
    else if (a === '-h' || a === '--help') {
      console.log('Usage: quikee-migrate [--env production|preview] [--database <name>]');
      return;
    }
  }

  try {
    runMigrations({ env, database });
  } catch (err) {
    console.error(`[quikee] Migration ritual failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
