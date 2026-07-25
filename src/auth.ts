import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { QuikeeAuthEnv } from './env.js';
import { isDeployed, runtimeEnv } from './env.js';
import type { QuikeeUser } from './user.js';

/** Header Cloudflare Access adds at the edge when a request passes through a protected hostname. */
const ACCESS_JWT_HEADER = 'cf-access-jwt-assertion';
/** Cookie Access sets in the browser after login. */
const ACCESS_COOKIE = 'CF_Authorization';

/** Thrown when a request cannot be authenticated. Callers translate this into a 403. */
export class AuthError extends Error {
  readonly status = 403 as const;
  constructor(
    message: string,
    /** Machine-readable reason, safe to log. Never contains token material. */
    readonly reason:
      | 'no-token'
      | 'invalid-token'
      | 'misconfigured'
      | 'stub-forbidden-in-production',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Per-isolate cache of remote JWKS sets, keyed by team domain. `createRemoteJWKSet`
 * handles fetching + caching + key rotation internally; we just avoid recreating it.
 */
const jwksCache = new Map<string, JWTVerifyGetKey>();

function getJwks(teamDomain: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

function readToken(request: Request): string | null {
  const header = request.headers.get(ACCESS_JWT_HEADER);
  if (header) return header;
  const cookie = request.headers.get('cookie');
  if (cookie) {
    for (const part of cookie.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name === ACCESS_COOKIE && rest.length) return rest.join('=');
    }
  }
  return null;
}

function stubUser(env: QuikeeAuthEnv): QuikeeUser {
  const email = env.QUIKEE_DEV_STUB_USER!;
  return {
    email,
    sub: `dev-stub:${email}`,
    name: env.QUIKEE_DEV_STUB_NAME ?? email.split('@')[0],
    claims: { email, dev: true },
    source: 'dev-stub',
  };
}

/**
 * Fail-closed authentication. Framework-agnostic: give it the raw Request and the
 * Worker env, get back a verified `QuikeeUser` or an `AuthError`.
 *
 * Rules, in order:
 *  1. If deployed (QUIKEE_ENV is production|preview): the dev stub is NEVER used,
 *     even if the stub var is present. A valid Access JWT is required. No token or
 *     an invalid token => AuthError. There is no bypass via the raw *.workers.dev
 *     URL, because Access never adds the header there, so no token arrives.
 *  2. If NOT deployed and the stub var is set: return the stub user.
 *  3. If NOT deployed and no stub var: still require a real token (lets you test
 *     the real path locally against a real Access app if you want).
 */
export async function authenticateRequest(
  request: Request,
  env: QuikeeAuthEnv,
): Promise<QuikeeUser> {
  const deployed = isDeployed(env);

  if (!deployed && env.QUIKEE_DEV_STUB_USER) {
    return stubUser(env);
  }

  // Defense in depth: if somehow a stub var reached a deployed env, refuse loudly
  // rather than silently ignoring it — makes misconfiguration visible.
  if (deployed && env.QUIKEE_DEV_STUB_USER) {
    throw new AuthError(
      `Refusing to run: QUIKEE_DEV_STUB_USER is set in a deployed environment (${runtimeEnv(env)}). Remove this secret.`,
      'stub-forbidden-in-production',
    );
  }

  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    throw new AuthError(
      'Auth is enabled but ACCESS_TEAM_DOMAIN / ACCESS_AUD are not configured.',
      'misconfigured',
    );
  }

  const token = readToken(request);
  if (!token) {
    throw new AuthError('No Cloudflare Access token on request.', 'no-token');
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(env.ACCESS_TEAM_DOMAIN), {
      audience: env.ACCESS_AUD,
      issuer: `https://${env.ACCESS_TEAM_DOMAIN}`,
    });
    const email = typeof payload.email === 'string' ? payload.email : undefined;
    if (!email) {
      throw new AuthError('Access token has no email claim.', 'invalid-token');
    }
    return {
      email,
      sub: String(payload.sub ?? email),
      name: typeof payload.name === 'string' ? payload.name : undefined,
      identityNonce:
        typeof payload.identity_nonce === 'string' ? payload.identity_nonce : undefined,
      claims: payload as Record<string, unknown>,
      source: 'access',
    };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError('Access token failed verification.', 'invalid-token');
  }
}
