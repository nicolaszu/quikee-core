#!/usr/bin/env node
import { runMigrations } from './ritual.js';

/**
 * `quikee-migrate` — the deploy-time migration ritual, invoked by CI before both
 * `wrangler deploy` (main) and `wrangler versions upload` (branch previews).
 *
 * Each app is one Worker with one database, so there is no environment to select.
 *
 *   quikee-migrate
 *   quikee-migrate --database my-app
 */
function main(): void {
  const argv = process.argv.slice(2);
  let database: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--database') database = argv[++i];
    else if (a === '-h' || a === '--help') {
      console.log('Usage: quikee-migrate [--database <name>]');
      return;
    }
  }

  try {
    runMigrations({ database });
  } catch (err) {
    console.error(`[quikee] Migration ritual failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
