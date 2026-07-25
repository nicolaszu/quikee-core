import type { Context, MiddlewareHandler } from 'hono';
import { AuthError, authenticateRequest } from './auth.js';
import type { QuikeeAuthEnv } from './env.js';
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
        return c.json({ error: 'unauthorized', reason: err.reason }, err.status);
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
