/**
 * @quikee/core — the invariant, security-critical plumbing every quikee shares.
 *
 * Apps depend on this by git tag and read it, never copy it. Fix auth once here,
 * bump the tag, roll it out per app deliberately.
 *
 * Runtime surface (import from "@quikee/core"):
 *   - requireAuth(), getUser(), me()      Hono auth middleware + identity endpoint
 *   - authenticateRequest(), AuthError    framework-agnostic auth primitive
 *   - QuikeeUser                          the req.user contract
 *   - getD1()                              D1 binding helper
 *   - isDeployed(), runtimeEnv()           environment gate used by the auth code
 *
 * Deploy-time surface (import from "@quikee/core/deploy", or the
 * `quikee-migrate` bin): the capture-bookmark-then-migrate ritual.
 */
export type { QuikeeUser } from './user.js';
export type { QuikeeAuthEnv, QuikeeRuntimeEnv } from './env.js';
export { isDeployed, runtimeEnv } from './env.js';
export { AuthError, authenticateRequest } from './auth.js';
export { requireAuth, getUser, me, reauthUrl, logout, LOGOUT_PATH, type QuikeeHonoEnv } from './hono.js';
export { getD1, type D1Env } from './db.js';
