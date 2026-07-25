# @quikee/core

The invariant, security-critical plumbing shared by every [quikee](https://quikee.org):
fail-closed Cloudflare Access auth, the `req.user` contract, and the D1 migration
ritual. Apps depend on this by **git tag** and read it, never copy it — fix auth once,
bump the tag, roll it out per app.

Consumed as a dependency:

```json
{ "dependencies": { "@quikee/core": "github:nicolaszu/quikee-core#v0.1.0" } }
```

## Runtime (`@quikee/core`)

- `requireAuth()`, `getUser()`, `me()` — Hono auth middleware + identity endpoint
- `authenticateRequest()`, `AuthError` — framework-agnostic auth primitive
- `QuikeeUser` — the `req.user` contract
- `getD1()` — D1 binding helper
- `isDeployed()`, `runtimeEnv()` — the environment gate the auth code uses

Auth is **fail-closed**: in production/preview a request must carry a
cryptographically verified Access JWT (signature + `aud` + issuer). The local dev
stub can never activate in a deployed environment.

## Deploy-time (`@quikee/core/deploy`, or the `quikee-migrate` bin)

The migration ritual: capture the current D1 Time Travel bookmark, then apply
additive-only migrations. CI runs it before `wrangler deploy`.

## License

MIT
