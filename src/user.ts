/**
 * The single, invariant identity contract every quikee reads.
 *
 * Whatever the auth source (real Cloudflare Access token in prod/preview, or the
 * prod-safe dev stub locally), the app only ever sees a `QuikeeUser`. Change the
 * shape here once and every app that depends on this version of core inherits it.
 */
export interface QuikeeUser {
  /** Verified email of the authenticated user. */
  email: string;
  /** Stable Access user identifier (the JWT `sub` claim). */
  sub: string;
  /** Optional display name, when the identity provider supplies one. */
  name?: string;
  /** Access identity nonce, when present. */
  identityNonce?: string;
  /** The full set of verified JWT claims, for apps that need more than the above. */
  claims: Record<string, unknown>;
  /**
   * How this identity was established. `access` = a cryptographically verified
   * Cloudflare Access token. `dev-stub` = the local-only fake user. A deployed
   * app can therefore assert `user.source === 'access'` if it ever wants to be
   * doubly sure it is not looking at a stub.
   */
  source: 'access' | 'dev-stub';
}
