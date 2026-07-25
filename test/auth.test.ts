import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthError, authenticateRequest } from '../dist/index.js';

const req = (headers: Record<string, string> = {}) =>
  new Request('https://app.quikee.org/api/me', { headers });

test('dev env + stub var => returns stub user (source dev-stub)', async () => {
  const user = await authenticateRequest(req(), {
    QUIKEE_ENV: 'development',
    QUIKEE_DEV_STUB_USER: 'nick@example.com',
  });
  assert.equal(user.email, 'nick@example.com');
  assert.equal(user.source, 'dev-stub');
});

test('production + no token => fail closed (no-token)', async () => {
  await assert.rejects(
    authenticateRequest(req(), {
      QUIKEE_ENV: 'production',
      ACCESS_TEAM_DOMAIN: 'nick.cloudflareaccess.com',
      ACCESS_AUD: 'aud-tag',
    }),
    (e: unknown) => e instanceof AuthError && e.reason === 'no-token',
  );
});

test('preview + no token => fail closed (no-token)', async () => {
  await assert.rejects(
    authenticateRequest(req(), {
      QUIKEE_ENV: 'preview',
      ACCESS_TEAM_DOMAIN: 'nick.cloudflareaccess.com',
      ACCESS_AUD: 'aud-tag',
    }),
    (e: unknown) => e instanceof AuthError && e.reason === 'no-token',
  );
});

test('stub var leaked into production => refused (never stubbed)', async () => {
  await assert.rejects(
    authenticateRequest(req(), {
      QUIKEE_ENV: 'production',
      QUIKEE_DEV_STUB_USER: 'attacker@example.com',
      ACCESS_TEAM_DOMAIN: 'nick.cloudflareaccess.com',
      ACCESS_AUD: 'aud-tag',
    }),
    (e: unknown) => e instanceof AuthError && e.reason === 'stub-forbidden-in-production',
  );
});

test('missing QUIKEE_ENV is treated as NOT deployed, but still needs a token without stub', async () => {
  await assert.rejects(
    authenticateRequest(req(), {
      ACCESS_TEAM_DOMAIN: 'nick.cloudflareaccess.com',
      ACCESS_AUD: 'aud-tag',
    }),
    (e: unknown) => e instanceof AuthError && e.reason === 'no-token',
  );
});

test('deployed with a bogus token => invalid-token (never accepted)', async () => {
  await assert.rejects(
    authenticateRequest(req({ 'cf-access-jwt-assertion': 'not.a.jwt' }), {
      QUIKEE_ENV: 'production',
      ACCESS_TEAM_DOMAIN: 'nick.cloudflareaccess.com',
      ACCESS_AUD: 'aud-tag',
    }),
    (e: unknown) => e instanceof AuthError && e.reason === 'invalid-token',
  );
});
