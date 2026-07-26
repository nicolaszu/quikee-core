import type { Context, MiddlewareHandler } from 'hono';
import { AuthError, authenticateRequest } from './auth.js';
import { isDeployed, type QuikeeAuthEnv } from './env.js';
import type { QuikeeUser } from './user.js';

/**
 * Hono context typing helper. Wire your app as:
 *   const app = new Hono<QuikeeHonoEnv<Env>>()
 * so `c.get('user')` is typed and `c.env` has the auth vars.
 */
export interface QuikeeHonoEnv<Bindings extends QuikeeAuthEnv = QuikeeAuthEnv> {
  Bindings: Bindings;
  Variables: { user: QuikeeUser };
}

/**
 * Where to send someone whose session we refused, so they can get a working one.
 *
 * A rejected token is a dead end otherwise: Cloudflare's edge accepts the cookie
 * (so the page loads), the Worker rejects the token (so the data does not), and
 * the visitor has no way to log out and try again. That happens whenever a token
 * outlives the config that validates it — most sharply after a team-domain
 * rename, when old cookies still carry the previous `iss`.
 *
 * Clearing the Access session at the team domain is the fix; the next visit to
 * the app triggers a fresh login. Returns null when auth is not configured (a
 * public app, or local dev), where there is nothing to re-authenticate against.
 */
export function reauthUrl(env: QuikeeAuthEnv, requestUrl: string): string | null {
  if (!isDeployed(env) || !env.ACCESS_TEAM_DOMAIN) return null;
  // MUST be the app's own origin, not the team domain. Access issues two
  // cookies: a global session token on the team domain, and an APPLICATION
  // token on the app hostname. The application token is the one handed to this
  // Worker and the one we reject, so the team-domain logout clears the wrong
  // cookie and appears to do nothing. Same-origin also means the page can clear
  // it with fetch() instead of navigating away.
  return new URL('/cdn-cgi/access/logout', requestUrl).toString();
}

/**
 * Fail-closed auth middleware. Mounting this IS the per-app opt-in to auth:
 * public quikees simply never mount it. Once mounted, every matched request
 * must carry a valid Access token (in prod/preview) or be running under the
 * local dev stub. On failure it short-circuits with 403 — the handler never runs.
 */
export function requireAuth<
  Bindings extends QuikeeAuthEnv = QuikeeAuthEnv,
>(): MiddlewareHandler<QuikeeHonoEnv<Bindings>> {
  return async (c, next) => {
    try {
      const user = await authenticateRequest(c.req.raw, c.env);
      c.set('user', user);
    } catch (err) {
      if (err instanceof AuthError) {
        return c.json(
          { error: 'unauthorized', reason: err.reason, reauth: reauthUrl(c.env, c.req.url) },
          err.status,
        );
      }
      throw err;
    }
    await next();
  };
}

/** Read the authenticated user inside a handler that ran behind `requireAuth()`. */
export function getUser<Bindings extends QuikeeAuthEnv = QuikeeAuthEnv>(
  c: Context<QuikeeHonoEnv<Bindings>>,
): QuikeeUser {
  return c.get('user');
}

/**
 * The one identity endpoint the frontend calls to learn who is logged in.
 * Mount behind `requireAuth()`:
 *   app.get('/api/me', requireAuth(), me)
 */
export function me<Bindings extends QuikeeAuthEnv = QuikeeAuthEnv>(
  c: Context<QuikeeHonoEnv<Bindings>>,
): Response {
  const u = c.get('user');
  return c.json({ email: u.email, sub: u.sub, name: u.name, source: u.source });
}
