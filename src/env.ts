/**
 * Environment contract + runtime environment detection.
 *
 * The critical security property lives here: whether we are in a *deployed*
 * environment is decided by `QUIKEE_ENV`, a plaintext var baked into
 * `wrangler.jsonc` per environment and committed to the repo — NOT by the
 * presence or absence of a secret. That makes the dev-stub gate un-bypassable:
 * a leaked stub var in production cannot re-enable the stub, because the
 * committed `QUIKEE_ENV=production` marker overrides it.
 */

export type QuikeeRuntimeEnv = 'development' | 'preview' | 'production';

/**
 * The subset of the Worker `env` that core reads. Apps extend their own `Env`
 * with these keys (all supplied via `wrangler.jsonc` vars or secrets).
 */
export interface QuikeeAuthEnv {
  /**
   * Set per-environment in wrangler.jsonc: "development" (top-level, used by
   * `wrangler dev`), "preview", or "production". Missing is treated as
   * "development" locally — but note only an explicit "development" (i.e. NOT
   * deployed) allows the dev stub.
   */
  QUIKEE_ENV?: string;
  /** Full Access team domain, e.g. "nick.cloudflareaccess.com". Required when deployed with auth. */
  ACCESS_TEAM_DOMAIN?: string;
  /** The Access application AUD tag this app validates tokens against. Required when deployed with auth. */
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
