/**
 * Environment contract + runtime environment detection.
 *
 * The critical security property lives here: whether we are in a *deployed*
 * environment is decided by `QUIKEE_ENV`, a plaintext var committed to
 * `wrangler.jsonc` — NOT by the presence or absence of a secret. That makes the
 * dev-stub gate un-bypassable: a leaked stub var in production cannot re-enable
 * the stub, because the committed `QUIKEE_ENV=production` marker overrides it.
 *
 * Each app is ONE Worker, so there is no production/preview split to encode here:
 * committed config always says `production`, and local `wrangler dev` overrides it
 * to `development` through `.dev.vars` — a gitignored file that cannot reach the
 * cloud. So "this is a dev machine" is asserted only by something that never
 * ships, and everything deployed (including branch preview versions, which are
 * versions of the same Worker) is fail-closed by default.
 */

export type QuikeeRuntimeEnv = 'development' | 'preview' | 'production';

/**
 * The subset of the Worker `env` that core reads. Apps extend their own `Env`
 * with these keys (all supplied via `wrangler.jsonc` vars or secrets).
 */
export interface QuikeeAuthEnv {
  /**
   * "production" in committed wrangler.jsonc (covers the live domain AND branch
   * preview versions — both are deployed), overridden to "development" by the
   * local-only `.dev.vars`. Anything that is not explicitly a deployed value is
   * treated as "development"; only that state permits the dev stub.
   */
  QUIKEE_ENV?: string;
  /** Full Access team domain, e.g. "nick.cloudflareaccess.com". Required when deployed with auth. */
  ACCESS_TEAM_DOMAIN?: string;
  /**
   * Access application AUD tag(s) this app accepts, comma-separated. Usually two:
   * the custom-domain app and the preview-URL app. Required when deployed with auth.
   */
  ACCESS_AUD?: string;
  /**
   * Local-only: when set (to an email), and ONLY in a non-deployed environment,
   * requests are authenticated as this fake user. Never set this as a production
   * secret — and even if it leaks, the deployed-env gate ignores it.
   */
  QUIKEE_DEV_STUB_USER?: string;
  /** Optional display name for the dev stub user. */
  QUIKEE_DEV_STUB_NAME?: string;
}

/** Normalize the runtime environment marker. Anything not explicitly a deployed value is "development". */
export function runtimeEnv(env: QuikeeAuthEnv): QuikeeRuntimeEnv {
  const v = env.QUIKEE_ENV;
  if (v === 'production') return 'production';
  if (v === 'preview') return 'preview';
  return 'development';
}

/**
 * True in any environment reachable from the internet (production or preview).
 * This is the hard gate: the dev stub can never activate when this is true.
 */
export function isDeployed(env: QuikeeAuthEnv): boolean {
  const e = runtimeEnv(env);
  return e === 'production' || e === 'preview';
}
