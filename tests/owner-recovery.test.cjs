const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const load = name => import(pathToFileURL(path.join(root, 'cloudflare/src', name)).href);
const initial = 'initial-owner-test-credential';

async function fixture(t) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  const { OwnerCredentialStore } = await load('owner-credential-store.js');
  const store = new OwnerCredentialStore({ exec(sql, ...params) { const rows = db.prepare(sql).all(...params); return { toArray: () => rows }; } }, initial);
  const mails = [];
  const env = { OWNER_AUTH: { getByName: () => store }, OWNER_RECOVERY_EMAIL: 'owner@example.test', RECOVERY_FROM_EMAIL: 'security@example.test', RECOVERY_EMAIL: { async send(message) { mails.push(message); } } };
  async function call(action, payload = {}, options = {}) {
    const { handleOwnerPassword } = await load('owner-auth.js');
    const pending = [];
    const response = await handleOwnerPassword(new Request('https://worker.example.test/', { method: options.method || 'POST', headers: { origin: options.origin || 'https://btcsolucoes.github.io', 'cf-connecting-ip': options.ip || '192.0.2.1', ...(options.session ? { 'x-owner-session': options.session } : {}) } }), env, payload, action, { waitUntil: promise => pending.push(promise) });
    const data = await response.json();
    await Promise.all(pending);
    return { status: response.status, data, headers: response.headers };
  }
  return { db, store, env, mails, call };
}

test('sessions have bounded lifetimes, use hashed tokens and are revoked by logout and password changes', async t => {
  const f = await fixture(t);
  const login = await f.call('loginOwner', { password: initial });
  assert.equal(login.status, 200);
  assert.match(login.data.session_token, /^[0-9a-f]{64}$/);
  assert.ok(Date.parse(login.data.expires_at) <= Date.now() + 4 * 3600000);
  assert.equal((await f.store.verifySession(login.data.session_token)).ok, true);
  assert.ok(!JSON.stringify(f.db.prepare('SELECT * FROM owner_sessions').all()).includes(login.data.session_token));
  const changed = await f.call('changeOwnerPassword', { current_password: initial, new_password: 'Nova senha de teste 42!' }, { session: login.data.session_token });
  assert.equal(changed.status, 200);
  assert.equal((await f.store.verifySession(login.data.session_token)).ok, false);
  assert.equal((await f.store.verifySession(changed.data.session_token)).ok, true);
  await f.call('logoutOwner', {}, { session: changed.data.session_token });
  assert.equal((await f.store.verifySession(changed.data.session_token)).ok, false);
  assert.equal(f.mails.length, 1);
  assert.ok(!f.mails[0].text.includes('Nova senha de teste'));
});

test('forgot-password responses do not expose address existence or reset tokens', async t => {
  const f = await fixture(t);
  const known = await f.call('requestOwnerPasswordReset', { email: 'owner@example.test' });
  const unknown = await f.call('requestOwnerPasswordReset', { email: 'unrelated@example.test' });
  assert.equal(known.status, 202);
  assert.deepEqual(known.data, unknown.data);
  assert.deepEqual(known.data, { ok: true });
  assert.equal(f.mails.length, 1);
  assert.equal(f.mails[0].to, 'owner@example.test');
  const token = f.mails[0].text.match(/token=([a-f0-9]{64})/)[1];
  assert.ok(!JSON.stringify(f.db.prepare('SELECT * FROM owner_resets').all()).includes(token));
  assert.equal(known.headers.get('cache-control'), 'no-store');
});

test('reset links expire and one successful reset invalidates all links, sessions and old password', async t => {
  const f = await fixture(t);
  const session = (await f.store.login(initial, 'client')).session_token;
  const first = await f.store.issueReset('owner@example.test', 'owner@example.test');
  const second = await f.store.issueReset('owner@example.test', 'owner@example.test');
  f.db.prepare('UPDATE owner_resets SET expires_at = 1').run();
  assert.equal((await f.call('resetOwnerPassword', { token: first.token, new_password: 'Test password replacement' })).data.error, 'invalid_reset_link');
  const valid = await f.store.issueReset('owner@example.test', 'owner@example.test');
  const result = await f.call('resetOwnerPassword', { token: valid.token, new_password: 'Senha totalmente nova 321!' });
  assert.deepEqual(result.data, { ok: true });
  assert.equal((await f.store.verifySession(session)).ok, false);
  assert.equal((await f.store.verify(initial, 'client')).ok, false);
  assert.equal((await f.store.verify('Senha totalmente nova 321!', 'client')).ok, true);
  assert.equal((await f.store.reset(valid.token, 'Another replacement 321!', 'client')).ok, false);
  assert.equal((await f.store.reset(second.token, 'Another replacement 321!', 'client')).ok, false);
});

test('concurrent reset consumes the token once and no failed request changes credentials', async t => {
  const f = await fixture(t);
  const reset = await f.store.issueReset('owner@example.test', 'owner@example.test');
  const results = await Promise.all(['first-reset-password', 'second-reset-password'].map(password => f.store.reset(reset.token, password, 'client')));
  assert.equal(results.filter(result => result.ok).length, 1);
  assert.equal((await f.store.reset('0'.repeat(64), 'intruder-password', 'client')).ok, false);
});

test('request, delivery and reset budgets survive successes and return Retry-After on HTTP limits', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 3; i++) assert.equal((await f.call('requestOwnerPasswordReset', { email: 'owner@example.test' })).status, 202);
  const blocked = await f.call('requestOwnerPasswordReset', { email: 'owner@example.test' });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  await f.call('requestOwnerPasswordReset', { email: 'owner@example.test' }, { ip: '192.0.2.2' });
  assert.equal(f.mails.length, 3);
  for (let i = 0; i < 10; i++) await f.call('resetOwnerPassword', { token: 'invalid', new_password: 'invalid-but-long' });
  assert.equal((await f.call('resetOwnerPassword', { token: 'invalid' })).status, 429);
});

test('failed mail delivery revokes the unused token; missing sender is uniformly unavailable', async t => {
  const f = await fixture(t);
  f.env.RECOVERY_EMAIL.send = async () => { throw new Error('test mail failure'); };
  assert.equal((await f.call('requestOwnerPasswordReset', { email: 'owner@example.test' })).status, 202);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM owner_resets').get().n, 0);
  delete f.env.RECOVERY_EMAIL;
  assert.equal((await f.call('requestOwnerPasswordReset', { email: 'owner@example.test' })).status, 503);
  assert.equal((await f.call('requestOwnerPasswordReset', { email: 'unknown@example.test' })).status, 503);
});

test('mutations reject foreign origins and GET; session expiry fails closed', async t => {
  const f = await fixture(t);
  assert.equal((await f.call('loginOwner', { password: initial }, { origin: 'https://attacker.example' })).status, 403);
  assert.equal((await f.call('resetOwnerPassword', {}, { method: 'GET' })).status, 405);
  const session = (await f.store.login(initial, 'client')).session_token;
  f.db.prepare('UPDATE owner_sessions SET expires_at = 1').run();
  assert.equal((await f.store.verifySession(session)).ok, false);
});
