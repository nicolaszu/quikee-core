/**
 * Runtime D1 helpers. Deliberately ORM-agnostic: core does not pin a Drizzle
 * version. Apps build their own `drizzle(getD1(env))` on top of this — the only
 * thing core guarantees is a clear, uniform failure when the binding is missing.
 *
 * The migration *ritual* (capture Time Travel bookmark -> apply additive
 * migrations) is the invariant that actually lives in core, but it is a
 * deploy-time concern — see `@quikee/core/deploy`.
 */

/** Any env that may carry a D1 binding. */
export type D1Env = Record<string, unknown>;

/**
 * Fetch a D1 binding by name (default "DB") with a precise error if it is absent
 * or misconfigured, instead of a downstream "cannot read properties of undefined".
 *
 * Takes `object` rather than `Record<string, unknown>` on purpose: an app's `Env`
 * is an interface, and interfaces have no implicit index signature, so requiring
 * a Record would reject every real caller.
 */
export function getD1(env: object, binding = 'DB'): D1Database {
  const db = (env as Record<string, unknown>)[binding];
  if (!db || typeof (db as D1Database).prepare !== 'function') {
    throw new Error(
      `D1 binding "${binding}" is not available. Add it to wrangler.jsonc (d1_databases) for every environment, or pass the correct binding name.`,
    );
  }
  return db as D1Database;
}
