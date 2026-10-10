const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');

const root = path.resolve(__dirname, '..');
const modulePromise = import(pathToFileURL(path.join(root, 'cloudflare/src/instagram-stories.js')).href);
const workerPromise = import(pathToFileURL(path.join(root, 'cloudflare/src/worker.js')).href);
const ownerStorePromise = import(pathToFileURL(path.join(root, 'cloudflare/src/owner-credential-store.js')).href);
const ownerKey = 'test-owner-key-not-a-real-secret';
const publisherToken = 'test-publisher-credential-'.repeat(3);
const secondToken = 'test-second-publisher-token-'.repeat(3);
// Valid 1x1 PNG; media dimensions are normalized by the UI and decoded by the runner.
const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=';

function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  const authSqlite = new DatabaseSync(':memory:');
  t.after(() => authSqlite.close());
  const authStore = ownerStorePromise.then(({ OwnerCredentialStore }) => new OwnerCredentialStore({
    exec(sql, ...values) { const rows = authSqlite.prepare(sql).all(...values); return { toArray: () => rows }; },
  }, ownerKey));
  sqlite.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE restaurants(id TEXT PRIMARY KEY, slug TEXT UNIQUE, admin_token TEXT, story_link TEXT);
    INSERT INTO restaurants VALUES ('r-internal','internal','internal-test-token','https://example.test/menu');
    INSERT INTO restaurants VALUES ('r-other','other','other-test-token','https://example.test/other');`);
  sqlite.exec("ALTER TABLE restaurants ADD COLUMN name TEXT DEFAULT 'Internal restaurant'");
  sqlite.exec(fs.readFileSync(path.join(root, 'cloudflare/migrations/0007_story_automation.sql'), 'utf8'));
  sqlite.exec("INSERT INTO story_agents(device_id,label,token_hash) VALUES ('legacy-phone','Retired','unused')");
  sqlite.exec(`INSERT INTO story_publish_jobs(id,restaurant_id,restaurant_slug,story_link,media_key,media_token,queued_at)
    VALUES ('legacy-job','r-internal','internal','https://example.test/menu','old-media','old-token','2026-01-01')`);
  const migration = fs.readFileSync(path.join(root, 'cloudflare/migrations/0010_instagram_python_publisher.sql'), 'utf8');
  sqlite.exec(migration);
  sqlite.exec(migration); // Retry-safe migration, preserving old records.
  sqlite.exec(fs.readFileSync(path.join(root, 'cloudflare/migrations/0011_restaurant_plans.sql'), 'utf8'));
  for (let i = 0; i < 2; i++) sqlite.exec(fs.readFileSync(path.join(root, 'cloudflare/migrations/0012_instagram_sessions.sql'), 'utf8'));
  sqlite.exec(fs.readFileSync(path.join(root, "cloudflare/migrations/0013_instagram_onboarding_schedule.sql"), "utf8"));
  sqlite.exec("INSERT INTO restaurant_plans SELECT id, 'performance', '2026-10-06' FROM restaurants");
  const kv = new Map();
  const env = {
    OWNER_ACCESS_TOKEN: ownerKey,
    INSTAGRAM_CREDENTIAL_KEY: 'ab'.repeat(32),
    OWNER_AUTH: { getByName() { return {
      async verify(...args) { return (await authStore).verify(...args); },
      async change(...args) { return (await authStore).change(...args); },
      async rateLimit(...args) { return (await authStore).rateLimit(...args); },
      async verifySession(...args) { return (await authStore).verifySession(...args); },
    }; } },
    DB: {
      prepare(sql) {
        let values = [];
        const statement = {
          bind(...args) { values = args; return statement; },
          run() { const result = sqlite.prepare(sql).run(...values); return { success: true, meta: { changes: Number(result.changes) } }; },
          first() { return sqlite.prepare(sql).get(...values) || null; },
          all() { return { results: sqlite.prepare(sql).all(...values) }; },
        };
        return statement;
      },
      batch(statements) {
        sqlite.exec('BEGIN');
        try { const results = statements.map(statement => statement.run()); sqlite.exec('COMMIT'); return results; }
        catch (error) { sqlite.exec('ROLLBACK'); throw error; }
      },
    },
    INSIGHTS_CACHE: {
      async put(key, value, options) { kv.set(key, { value: typeof value === 'string' ? value : new Uint8Array(value).slice().buffer, metadata: options?.metadata }); },
      async get(key, type) { const value = kv.get(key)?.value; return value && type === 'json' ? JSON.parse(value) : value || null; },
      async getWithMetadata(key) { return kv.get(key) || { value: null, metadata: null }; },
      async delete(key) { kv.delete(key); },
    },
  };
  async function call(action, bodyOrQuery = {}, options = {}) {
    const { handleInstagramStories } = await modulePromise;
    const method = options.method || (['cancelInstagramStoryJob', 'registerInstagramPublisher', 'bindInstagramAccount', 'createStoryJob', 'updateInstagramStoryJob', 'requestInstagramConnection', 'claimInstagramConnection', 'reportInstagramSessions', 'completeInstagramConnection'].includes(action) ? 'POST' : 'GET');
    const url = new URL('https://worker.example.test/');
    url.searchParams.set('action', action);
    if (method === 'GET') for (const [name, value] of Object.entries(bodyOrQuery)) url.searchParams.set(name, value);
    const headers = new Headers();
    if (options.token) headers.set('authorization', `Bearer ${options.token}`);
    if (options.claimToken) headers.set('x-claim-token', options.claimToken);
    const request = new Request(url, { method, headers });
    const response = await handleInstagramStories(request, env, method === 'POST' ? bodyOrQuery : {}, action);
    if (response.headers.get('content-type')?.includes('application/json')) return { status: response.status, data: await response.json(), headers: response.headers };
    return { status: response.status, bytes: new Uint8Array(await response.arrayBuffer()), headers: response.headers };
  }
  async function setupAccount({ slug = 'internal', publisherId = 'test-windows', username = 'internal_test', userId = '12345', token = publisherToken, enabled = true } = {}) {
    assert.equal((await call('registerInstagramPublisher', { owner_key: ownerKey, publisher_id: publisherId, publisher_token: token, label: 'Test Windows', version: '1.0.0' })).status, 200);
    assert.equal((await call('bindInstagramAccount', { owner_key: ownerKey, slug, publisher_id: publisherId, instagram_username: username, instagram_user_id: userId, enabled })).status, 200);
  }
  async function enqueue(overrides = {}) {
    return call('createStoryJob', { slug: 'internal', token: 'internal-test-token', client_request_id: 'test-request',
      menu_day_id: 'internal-menu', story_link: 'https://example.test/menu', image_base64: imageBase64, content_type: 'image/png', ...overrides });
  }
  async function claim(publisherId = 'test-windows', token = publisherToken) {
    return call('getNextInstagramStoryJob', { publisher_id: publisherId }, { token });
  }
  async function update(job, status, extra = {}, options = {}) {
    return call('updateInstagramStoryJob', { publisher_id: job.publisher_id, job_id: job.id, claim_token: job.claim_token, status, ...extra }, { token: publisherToken, ...options });
  }
  return { env, sqlite, kv, call, setupAccount, enqueue, claim, update };
}

async function requestConnection(f) {
  return f.call('requestInstagramConnection', { owner_key: ownerKey, slug: 'internal', password: 'FICTIONAL_PASSWORD_123' });
}
async function claimConnection(f, token = publisherToken, publisher_id = 'test-windows') {
  return f.call('claimInstagramConnection', { publisher_id }, { token });
}
test('Instagram credentials are owner-only, encrypted and delivered once to the assigned publisher', async t => {
  const f = fixture(t);
  await f.setupAccount({ enabled: false });
  assert.equal((await f.call('requestInstagramConnection', { slug: 'internal', token: 'internal-test-token', password: 'fake' })).status, 401);
  assert.equal((await f.call('getInstagramSessionStatus', { slug: 'internal', token: 'internal-test-token' })).status, 401);
  const created = await requestConnection(f);
  assert.equal(created.status, 200);
  assert.doesNotMatch(JSON.stringify(created.data), /FICTIONAL_PASSWORD/);
  const stored = f.sqlite.prepare('SELECT encrypted_password FROM instagram_connection_requests').get();
  assert.ok(stored.encrypted_password);
  assert.doesNotMatch(stored.encrypted_password, /FICTIONAL_PASSWORD/);
  assert.equal((await claimConnection(f, secondToken)).status, 401);
  const results = await Promise.all([claimConnection(f), claimConnection(f)]);
  const claims = results.map(r => r.data.connection).filter(Boolean);
  assert.equal(claims.length, 1);
  assert.equal(claims[0].password, 'FICTIONAL_PASSWORD_123');
  assert.equal(f.sqlite.prepare('SELECT encrypted_password FROM instagram_connection_requests').get().encrypted_password, null);
  assert.equal((await claimConnection(f)).data.connection, null);
  const status = await f.call('getInstagramSessionStatus', { slug: 'internal' }, { token: ownerKey });
  assert.equal(status.data.session.request_status, 'processing');
  assert.equal(status.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(JSON.stringify(status.data), /password|claim_token|encrypted|FICTIONAL/);
  assert.equal(f.sqlite.prepare('SELECT enabled FROM instagram_account_bindings').get().enabled, 0);
});
test('connection expiration erases credentials and rate limiting includes a retry delay', async t => {
  const f = fixture(t);
  await f.setupAccount();
  await requestConnection(f);
  const again = await requestConnection(f);
  assert.equal(again.status, 429);
  assert.ok(Number(again.headers.get('retry-after')) > 0);
  f.sqlite.prepare("UPDATE instagram_connection_requests SET expires_at='2000-01-01'").run();
  assert.equal((await claimConnection(f)).data.connection, null);
  assert.deepEqual({ ...f.sqlite.prepare('SELECT status,encrypted_password FROM instagram_connection_requests').get() }, { status: 'expired', encrypted_password: null });
});
test('connection results and local reports are bound to the publisher and immutable account', async t => {
  const f = fixture(t);
  await f.setupAccount();
  await requestConnection(f);
  const connection = (await claimConnection(f)).data.connection;
  const data = { publisher_id: 'test-windows', id: connection.id, claim_token: connection.claim_token, state: 'connected' };
  assert.equal((await f.call('completeInstagramConnection', { ...data, claim_token: 'wrong' }, { token: publisherToken })).status, 409);
  assert.equal((await f.call('completeInstagramConnection', data, { token: publisherToken })).status, 200);
  assert.equal((await f.call('completeInstagramConnection', data, { token: publisherToken })).status, 200);
  const status = () => f.call('getInstagramSessionStatus', { slug: 'internal' }, { token: ownerKey });
  assert.equal((await status()).data.session.state, 'connected');
  await f.call('reportInstagramSessions', { publisher_id: 'test-windows', sessions: [{ restaurant_slug: 'internal', instagram_username: 'internal_test', instagram_user_id: '999', state: 'suspended' }] }, { token: publisherToken });
  assert.equal((await status()).data.session.state, 'connected');
  await f.call('reportInstagramSessions', { publisher_id: 'test-windows', sessions: [{ restaurant_slug: 'internal', instagram_username: 'internal_test', instagram_user_id: '12345', state: 'verification_required' }] }, { token: publisherToken });
  assert.equal((await status()).data.session.state, 'verification_required');
  f.sqlite.prepare("UPDATE instagram_publishers SET last_seen_at='2000-01-01'").run();
  assert.equal((await status()).data.session.publisher_online, false);
});
test('changed binding cancels pending credential delivery and hides stale status', async t => {
  const f = fixture(t);
  await f.setupAccount();
  await requestConnection(f);
  await f.setupAccount({ username: 'different', userId: '56789' });
  assert.equal((await claimConnection(f)).data.connection, null);
  const status = (await f.call('getInstagramSessionStatus', { slug: 'internal' }, { token: ownerKey })).data.session;
  assert.equal(status.request_status, null);
  assert.equal(status.state, 'unknown');
  assert.equal(f.sqlite.prepare('SELECT encrypted_password FROM instagram_connection_requests').get().encrypted_password, null);
});
test('expired in-flight connection can acknowledge once without replaying credentials', async t => {
  const f = fixture(t);
  await f.setupAccount();
  await requestConnection(f);
  const connection = (await claimConnection(f)).data.connection;
  f.sqlite.prepare("UPDATE instagram_connection_requests SET expires_at='2000-01-01'").run();
  const result = await f.call('completeInstagramConnection', { publisher_id: 'test-windows', id: connection.id, claim_token: connection.claim_token, state: 'review_required' }, { token: publisherToken });
  assert.equal(result.status, 200);
  assert.equal(f.sqlite.prepare('SELECT status FROM instagram_connection_requests').get().status, 'completed');
});

test('migration is retry-safe, disables Android and never imports its queue', async t => {
  const f = fixture(t);
  assert.equal(f.sqlite.prepare('SELECT is_active FROM story_agents').get().is_active, 0);
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM story_publish_jobs').get().n, 1);
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM instagram_story_jobs').get().n, 0);
  for (const action of ['registerStoryAgent', 'getAgentRelease', 'getNextStoryJob', 'updateStoryJob', 'getStoryMedia']) {
    const result = await f.call(action, {}, { method: action.startsWith('register') || action.startsWith('update') ? 'POST' : 'GET' });
    assert.equal(result.status, 410);
    assert.equal(result.data.error, 'android_story_agent_retired');
  }
});

test('first publisher registration and account binding both require owner authorization', async t => {
  const f = fixture(t);
  const registration = { publisher_id: 'test-windows', publisher_token: publisherToken };
  assert.equal((await f.call('registerInstagramPublisher', registration)).status, 401);
  assert.equal((await f.call('registerInstagramPublisher', { ...registration, owner_key: 'wrong' })).status, 401);
  await f.setupAccount();
  assert.notEqual(f.sqlite.prepare('SELECT token_hash FROM instagram_publishers').get().token_hash, publisherToken);
  const binding = { slug: 'internal', publisher_id: 'test-windows', instagram_username: 'internal_test', instagram_user_id: '12345', enabled: true };
  assert.equal((await f.call('bindInstagramAccount', binding)).status, 401);
  assert.equal((await f.call('bindInstagramAccount', { ...binding, owner_key: ownerKey, instagram_user_id: 'not-an-id' })).status, 400);
  assert.equal((await f.call('getStoryPublishingConfig', { slug: 'internal', token: 'wrong' })).status, 401);
});

test('enqueue requires an enabled restaurant binding and exposes no private claim/media storage credentials', async t => {
  const f = fixture(t);
  assert.equal((await f.enqueue()).data.error, 'instagram_account_not_ready');
  await f.setupAccount({ enabled: false });
  assert.equal((await f.enqueue()).status, 409);
  await f.setupAccount();
  const result = await f.enqueue();
  assert.equal(result.status, 201);
  assert.equal(result.data.job.instagram_user_id, '12345');
  assert.equal(result.data.job.instagram_username, 'internal_test');
  assert.equal(result.data.job.provider, 'private_api');
  assert.equal('claim_token' in result.data.job, false);
  assert.equal('media_key' in result.data.job, false);
  assert.equal('request_sha256' in result.data.job, false);
  assert.equal((await f.enqueue({ token: 'wrong' })).status, 401);
  const other = await f.call('getStoryJob', { slug: 'other', token: 'other-test-token', job: result.data.job.id });
  assert.equal(other.data.job, null);
});

test('concurrent duplicate submissions return one job while changed payload conflicts', async t => {
  const f = fixture(t);
  await f.setupAccount();
  const results = await Promise.all([f.enqueue(), f.enqueue(), f.enqueue()]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 200, 201]);
  assert.equal(new Set(results.map(result => result.data.job.id)).size, 1);
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM instagram_story_jobs').get().n, 1);
  assert.equal([...f.kv.keys()].filter(key => key.startsWith('instagram-stories/')).length, 1);
  assert.equal((await f.enqueue({ story_link: 'https://example.test/changed' })).data.error, 'idempotency_key_conflict');
  assert.equal((await f.enqueue({ client_request_id: '' })).status, 400);
});

test('media and link validation rejects invalid bytes, unsupported schemes and over-limit input', async t => {
  const f = fixture(t);
  await f.setupAccount();
  assert.equal((await f.enqueue({ image_base64: Buffer.from('not a png').toString('base64') })).status, 415);
  assert.equal((await f.enqueue({ content_type: 'image/jpeg' })).status, 415);
  assert.equal((await f.enqueue({ content_type: '__proto__' })).status, 415);
  assert.equal((await f.enqueue({ content_type: 'constructor' })).status, 415);
  assert.equal((await f.enqueue({ image_base64: '***' })).status, 400);
  assert.equal((await f.enqueue({ story_link: 'http://example.test/menu' })).status, 400);
  assert.equal((await f.enqueue({ story_link: 'https://user:password@example.test/menu' })).status, 400);
  assert.equal((await f.enqueue({ image_base64: 'A'.repeat(8 * 1024 * 1024 + 4) })).status, 413);
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM instagram_story_jobs').get().n, 0);
});

test('claims are account scoped and concurrent workers cannot claim multiple jobs for one publisher', async t => {
  const f = fixture(t);
  await f.setupAccount();
  await f.setupAccount({ slug: 'other', publisherId: 'second-publisher', username: 'other_test', userId: '67890', token: secondToken });
  await f.enqueue();
  await f.enqueue({ client_request_id: 'second-request' });
  const otherJob = await f.enqueue({ slug: 'other', token: 'other-test-token', client_request_id: 'other-request' });
  const claims = await Promise.all([f.claim(), f.claim(), f.claim()]);
  assert.ok(claims.every(result => result.status === 200));
  assert.equal(new Set(claims.map(result => result.data.job.id)).size, 1);
  assert.ok(claims.every(result => result.data.job.restaurant_slug === 'internal'));
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM instagram_story_jobs WHERE status='claimed' AND publisher_id='test-windows'").get().n, 1);
  const secondClaim = await f.claim('second-publisher', secondToken);
  assert.equal(secondClaim.data.job.id, otherJob.data.job.id);
  assert.equal((await f.claim('test-windows', secondToken)).status, 401);
});

test('private job and media require the assigned publisher and claim token', async t => {
  const f = fixture(t);
  await f.setupAccount();
  await f.setupAccount({ slug: 'other', publisherId: 'second-publisher', username: 'other_test', userId: '67890', token: secondToken });
  await f.enqueue();
  const job = (await f.claim()).data.job;
  const query = { publisher_id: job.publisher_id, job_id: job.id };
  assert.equal((await f.call('getInstagramStoryMedia', query, { token: publisherToken })).status, 409);
  assert.equal((await f.call('getInstagramPublisherJob', query, { token: publisherToken, claimToken: 'wrong' })).status, 409);
  assert.equal((await f.call('getInstagramStoryMedia', { ...query, publisher_id: 'second-publisher' }, { token: secondToken, claimToken: job.claim_token })).status, 409);
  const media = await f.call('getInstagramStoryMedia', query, { token: publisherToken, claimToken: job.claim_token });
  assert.equal(media.status, 200);
  assert.equal(media.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(media.bytes), Buffer.from(imageBase64, 'base64'));
  const mediaUrl = new URL(job.media_url);
  assert.equal(mediaUrl.origin, 'https://worker.example.test');
  assert.equal(mediaUrl.searchParams.has('token'), false);
  assert.equal(mediaUrl.searchParams.has('claim_token'), false);
  const publicResult = await f.call('getStoryJob', { slug: 'internal', token: 'internal-test-token', job: job.id });
  assert.equal('claim_token' in publicResult.data.job, false);
});

test('publishing permission is atomic, one-use, audited and cannot be retried', async t => {
  const f = fixture(t);
  await f.setupAccount(); await f.enqueue();
  const job = (await f.claim()).data.job;
  assert.equal((await f.update(job, 'preparing')).status, 200);
  const permissions = await Promise.all([f.update(job, 'publishing'), f.update(job, 'publishing'), f.update(job, 'publishing')]);
  assert.deepEqual(permissions.map(result => result.status).sort(), [200, 409, 409]);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM instagram_story_job_events WHERE status='publishing'").get().n, 1);
  assert.equal((await f.update(job, 'preparing')).status, 409);
  assert.equal((await f.update(job, 'failed_attention')).status, 409);
  assert.equal((await f.update(job, 'retry')).status, 400);
  assert.equal((await f.update(job, '__proto__')).status, 400);
  assert.equal((await f.claim()).data.job.status, 'publishing');
});

test('completion acknowledgement is idempotent and completed jobs never return to the queue', async t => {
  const f = fixture(t);
  await f.setupAccount(); await f.enqueue();
  const job = (await f.claim()).data.job;
  assert.equal((await f.update(job, 'completed', { media_id: '999_12345' })).status, 409);
  await f.update(job, 'publishing');
  assert.equal((await f.update(job, 'completed')).status, 400);
  const complete = await f.update(job, 'completed', { media_id: '999_12345' });
  assert.equal(complete.status, 200);
  const ack = await f.update(job, 'completed', { media_id: '999_12345' });
  assert.equal(ack.status, 200);
  assert.equal(ack.data.duplicate, true);
  assert.equal((await f.update(job, 'completed', { media_id: '888_12345' })).status, 409);
  assert.equal((await f.update(job, 'publishing')).status, 409);
  assert.equal((await f.claim()).data.job, null);
  assert.equal((await f.enqueue({ retry_failed: true })).data.job.id, job.id);
});

test('failed preflight acknowledgements may repeat without creating a new publication attempt', async t => {
  const f = fixture(t);
  await f.setupAccount(); await f.enqueue();
  const job = (await f.claim()).data.job;
  const acknowledgements = await Promise.all([
    f.update(job, 'failed_attention', { error_code: 'image_invalid' }),
    f.update(job, 'failed_attention', { error_code: 'image_invalid' }),
  ]);
  assert.ok(acknowledgements.every(result => result.status === 200));
  assert.equal((await f.update(job, 'failed_attention')).data.duplicate, true);
  assert.equal((await f.update(job, 'publishing')).status, 409);
  assert.equal((await f.claim()).data.job, null);
  assert.equal((await f.enqueue({ retry_failed: true })).data.job.id, job.id);
});

test('publishing permission rolls back if its audit event cannot be persisted', async t => {
  const f = fixture(t);
  await f.setupAccount(); await f.enqueue();
  const job = (await f.claim()).data.job;
  f.sqlite.exec(`CREATE TRIGGER reject_publish_event BEFORE INSERT ON instagram_story_job_events
    WHEN NEW.status = 'publishing' BEGIN SELECT RAISE(ABORT, 'simulated audit failure'); END;`);
  const result = await f.update(job, 'publishing');
  assert.equal(result.status, 500);
  assert.equal(result.data.error, 'instagram_story_internal_error');
  assert.equal(f.sqlite.prepare('SELECT status FROM instagram_story_jobs WHERE id = ?').get(job.id).status, 'claimed');
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM instagram_story_job_events WHERE status='publishing'").get().n, 0);
});

test('a pause arriving between preflight and atomic permission still prevents publishing', async t => {
  const f = fixture(t);
  await f.setupAccount(); await f.enqueue();
  const job = (await f.claim()).data.job;
  const original = f.env.DB.batch;
  f.env.DB.batch = statements => {
    f.sqlite.exec("UPDATE instagram_account_bindings SET enabled = 0 WHERE restaurant_id = 'r-internal'");
    return original(statements);
  };
  assert.equal((await f.update(job, 'publishing')).status, 409);
  assert.equal(f.sqlite.prepare('SELECT status FROM instagram_story_jobs WHERE id = ?').get(job.id).status, 'claimed');
});

test('enqueue refuses a stale account snapshot if the binding changes before insertion', async t => {
  const f = fixture(t);
  await f.setupAccount();
  const original = f.env.DB.batch;
  f.env.DB.batch = statements => {
    f.sqlite.exec("UPDATE instagram_account_bindings SET instagram_user_id = '99999', instagram_username = 'changed_account'");
    return original(statements);
  };
  assert.equal((await f.enqueue()).status, 409);
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM instagram_story_jobs').get().n, 0);
  assert.equal([...f.kv.keys()].filter(key => key.startsWith('instagram-stories/')).length, 0);
});

test('account reassignment cannot race a newly enqueued unresolved job', async t => {
  const f = fixture(t);
  await f.setupAccount();
  const original = f.env.DB.prepare;
  f.env.DB.prepare = sql => {
    const statement = original(sql);
    if (sql.startsWith('INSERT INTO instagram_account_bindings')) {
      const run = statement.run;
      statement.run = () => {
        f.sqlite.exec(`INSERT INTO instagram_story_jobs(id,restaurant_id,restaurant_slug,publisher_id,instagram_username,instagram_user_id,
          story_link,media_key,media_sha256,content_type,media_bytes,client_request_id,request_sha256,queued_at,created_at,updated_at)
          VALUES ('racing-job','r-internal','internal','test-windows','internal_test','12345','https://example.test/menu',
          'test-media','hash','image/png',1,'race-request','hash','2026-01-01','2026-01-01','2026-01-01')`);
        return run();
      };
    }
    return statement;
  };
  const result = await f.call('bindInstagramAccount', { owner_key: ownerKey, slug: 'internal', publisher_id: 'test-windows',
    instagram_username: 'new_account', instagram_user_id: '99999', enabled: true });
  assert.equal(result.status, 409);
  assert.equal(f.sqlite.prepare('SELECT instagram_user_id FROM instagram_account_bindings').get().instagram_user_id, '12345');
});

test('uncertain publication blocks the account and is only cleared by a confirmed completion', async t => {
  const f = fixture(t);
  await f.setupAccount(); await f.enqueue();
  await f.enqueue({ client_request_id: 'queued-second' });
  const job = (await f.claim()).data.job;
  await f.update(job, 'publishing');
  assert.equal((await f.update(job, 'outcome_unknown', { error_code: 'publish_response_lost' })).status, 200);
  assert.equal((await f.update(job, 'outcome_unknown', { error_code: 'publish_response_lost' })).status, 200);
  assert.equal((await f.claim()).data.job, null);
  const config = await f.call('getStoryPublishingConfig', { slug: 'internal', token: 'internal-test-token' });
  assert.equal(config.data.publishing.enabled, false);
  assert.equal(config.data.publishing.state, 'outcome_unknown');
  assert.equal((await f.enqueue({ client_request_id: 'another-new-request' })).data.error, 'instagram_outcome_unknown');
  assert.equal((await f.update(job, 'failed_attention')).status, 409);
  assert.equal((await f.update(job, 'completed', { media_id: 'confirmed_12345' })).status, 200);
  // Reconciliation clears uncertainty, but cannot waive the daily buffer.
  assert.equal((await f.claim()).data.job, null);
  f.sqlite.prepare('UPDATE instagram_story_jobs SET started_at = ?, completed_at = ? WHERE id = ?')
    .run(new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), job.id);
  assert.equal((await f.claim()).data.job.status, 'claimed');
});

test('daily account buffer blocks new submissions and queued jobs but preserves idempotent completion', async t => {
  const f = fixture(t);
  await f.setupAccount(); await f.enqueue();
  await f.enqueue({ client_request_id: 'already-queued' });
  const job = (await f.claim()).data.job;
  assert.equal((await f.update(job, 'publishing')).status, 200);
  const active = await f.call('getInstagramPublisherJob', { publisher_id: job.publisher_id, job_id: job.id }, { token: publisherToken, claimToken: job.claim_token });
  assert.equal(active.data.can_publish, true); // Its own permit must not freeze its guard.
  assert.equal((await f.update(job, 'completed', { media_id: 'confirmed-123' })).status, 200);
  const config = (await f.call('getStoryPublishingConfig', { slug: 'internal', token: 'internal-test-token' })).data.publishing;
  assert.equal(config.enabled, false);
  assert.equal(config.state, 'cooldown');
  assert.ok(config.retry_after_seconds > 86390 && config.retry_after_seconds <= 86400);
  const blocked = await f.enqueue({ client_request_id: 'too-soon' });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.data.error, 'instagram_publication_cooldown');
  assert.equal(Number(blocked.headers.get('retry-after')), blocked.data.retry_after_seconds);
  assert.equal((await f.claim()).data.job, null);
  assert.equal((await f.update(job, 'completed', { media_id: 'confirmed-123' })).data.duplicate, true);
  assert.equal((await f.enqueue()).data.job.id, job.id);
  const expired = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  f.sqlite.prepare('UPDATE instagram_story_jobs SET started_at = ?, completed_at = ? WHERE id = ?').run(expired, expired, job.id);
  const next = (await f.claim()).data.job;
  assert.equal(next.client_request_id, 'already-queued');
  assert.equal((await f.update(next, 'publishing')).status, 200);
});

test('atomic permission rejects a publication entering the daily window after preflight', async t => {
  const f = fixture(t);
  await f.setupAccount(); await f.enqueue();
  await f.enqueue({ client_request_id: 'already-queued' });
  const first = (await f.claim()).data.job;
  await f.update(first, 'publishing');
  await f.update(first, 'completed', { media_id: 'confirmed-123' });
  const expired = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  f.sqlite.prepare('UPDATE instagram_story_jobs SET started_at = ?, completed_at = ? WHERE id = ?').run(expired, expired, first.id);
  const second = (await f.claim()).data.job;
  const original = f.env.DB.batch;
  f.env.DB.batch = statements => {
    f.sqlite.prepare('UPDATE instagram_story_jobs SET completed_at = ? WHERE id = ?').run(new Date().toISOString(), first.id);
    return original(statements);
  };
  assert.equal((await f.update(second, 'publishing')).status, 409);
  assert.equal(f.sqlite.prepare('SELECT status FROM instagram_story_jobs WHERE id = ?').get(second.id).status, 'claimed');
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM instagram_story_job_events WHERE status='publishing'").get().n, 1);
});

test('publication window follows immutable Instagram identity after a restaurant rebind', async t => {
  const f = fixture(t);
  await f.setupAccount(); await f.enqueue();
  const job = (await f.claim()).data.job;
  await f.update(job, 'publishing');
  await f.update(job, 'completed', { media_id: 'confirmed-123' });
  await f.setupAccount({ slug: 'other', username: 'other_test', userId: '67890' });
  assert.equal((await f.call('getStoryPublishingConfig', { slug: 'other', token: 'other-test-token' })).data.publishing.state, 'ready');
  f.sqlite.exec("DELETE FROM instagram_account_bindings WHERE restaurant_id = 'r-internal'");
  await f.setupAccount({ slug: 'other', username: 'internal_test', userId: '12345' });
  assert.equal((await f.call('getStoryPublishingConfig', { slug: 'other', token: 'other-test-token' })).data.publishing.state, 'cooldown');
  assert.equal((await f.enqueue({ slug: 'other', token: 'other-test-token', client_request_id: 'rebind-attempt' })).status, 429);
});

test('ambiguous permission transport failure can conservatively freeze a job before publishing state', async t => {
  const f = fixture(t);
  await f.setupAccount(); await f.enqueue();
  const job = (await f.claim()).data.job;
  assert.equal((await f.update(job, 'outcome_unknown', { error_code: 'permission_response_lost' })).status, 200);
  assert.equal((await f.update(job, 'publishing')).status, 409);
  assert.equal((await f.claim()).data.job, null);
});

test('disabled binding prevents publication but still accepts safe reconciliation', async t => {
  const f = fixture(t);
  await f.setupAccount(); await f.enqueue();
  const job = (await f.claim()).data.job;
  await f.update(job, 'preparing');
  await f.setupAccount({ enabled: false });
  const check = await f.call('getInstagramPublisherJob', { publisher_id: job.publisher_id, job_id: job.id }, { token: publisherToken, claimToken: job.claim_token });
  assert.equal(check.data.can_publish, false);
  assert.equal(check.data.publishing.enabled, false);
  assert.equal((await f.update(job, 'publishing')).status, 409);
  await f.setupAccount();
  await f.update(job, 'publishing');
  await f.setupAccount({ enabled: false });
  assert.equal((await f.update(job, 'completed', { media_id: 'confirmed_12345' })).status, 200);
});

test('binding identity cannot be switched under unresolved jobs and duplicate Instagram ownership is rejected', async t => {
  const f = fixture(t);
  await f.setupAccount(); await f.enqueue();
  const binding = { owner_key: ownerKey, slug: 'internal', publisher_id: 'test-windows', instagram_username: 'other_account', instagram_user_id: '44444', enabled: true };
  assert.equal((await f.call('bindInstagramAccount', binding)).data.error, 'account_has_unresolved_jobs');
  assert.equal((await f.call('bindInstagramAccount', { ...binding, slug: 'other', instagram_user_id: '12345' })).data.error, 'instagram_account_already_bound');
});

test('global pause prevents claim and permission while leaving job inspection available', async t => {
  const f = fixture(t);
  await f.setupAccount(); await f.enqueue();
  f.env.INSTAGRAM_PUBLISHING_ENABLED = 'false';
  assert.equal((await f.claim()).data.job, null);
  f.env.INSTAGRAM_PUBLISHING_ENABLED = 'true';
  const job = (await f.claim()).data.job;
  f.env.INSTAGRAM_PUBLISHING_ENABLED = 'false';
  assert.equal((await f.update(job, 'publishing')).status, 409);
  const check = await f.call('getInstagramPublisherJob', { publisher_id: job.publisher_id, job_id: job.id }, { token: publisherToken, claimToken: job.claim_token });
  assert.equal(check.status, 200);
  assert.equal(check.data.can_publish, false);
});

test('real Worker dispatch retires Android and bounds bodies with or without Content-Length', async t => {
  const f = fixture(t);
  const worker = (await workerPromise).default;
  const { MAX_STORY_REQUEST_BYTES } = await modulePromise;
  const context = { waitUntil() {} };
  const retired = await worker.fetch(new Request('https://worker.example.test/?action=getNextStoryJob'), f.env, context);
  assert.equal(retired.status, 410);
  const declared = new Request('https://worker.example.test/', { method: 'POST', headers: { 'content-length': String(MAX_STORY_REQUEST_BYTES + 1) }, body: '{}' });
  assert.equal((await worker.fetch(declared, f.env, context)).status, 413);
  const chunked = new Request('https://worker.example.test/', { method: 'POST', body: 'x'.repeat(MAX_STORY_REQUEST_BYTES + 1) });
  assert.equal((await worker.fetch(chunked, f.env, context)).status, 413);
  const realConfig = await worker.fetch(new Request('https://worker.example.test/?action=getStoryPublishingConfig&slug=internal&token=internal-test-token'), f.env, context);
  assert.equal(realConfig.status, 200);
  assert.equal((await realConfig.json()).publishing.state, 'unconfigured');
});

async function planCall(f, action, data = {}, method = 'POST') {
  const worker = (await workerPromise).default;
  const url = new URL('https://worker.example.test/');
  url.searchParams.set('action', action);
  if (method === 'GET') Object.entries(data).forEach(([key, value]) => url.searchParams.set(key, value));
  const request = new Request(url, { method, ...(method === 'POST' ? { body: JSON.stringify(data), headers: { 'content-type': 'application/json' } } : {}) });
  const response = await worker.fetch(request, f.env, { waitUntil() {} });
  return { status: response.status, data: await response.json(), headers: response.headers };
}

test('owner password rotation invalidates every owner authorization path and preserves restaurant access', async t => {
  const f = fixture(t);
  const next = 'a-new-test-password-with-spaces 42';
  assert.equal((await planCall(f, 'changeOwnerPassword', { current_password: 'wrong', new_password: next })).status, 401);
  assert.equal((await planCall(f, 'changeOwnerPassword', { current_password: ownerKey, new_password: 'short' })).status, 400);
  assert.equal((await planCall(f, 'changeOwnerPassword', { current_password: ownerKey, new_password: ownerKey })).status, 400);
  assert.equal((await planCall(f, 'changeOwnerPassword', { current_password: ownerKey, new_password: next }, 'GET')).status, 405);
  const changed = await planCall(f, 'changeOwnerPassword', { current_password: ownerKey, new_password: next });
  assert.equal(changed.status, 200);
  assert.equal(changed.headers.get('cache-control'), 'no-store');
  assert.deepEqual(changed.data, { ok: true });
  assert.equal((await planCall(f, 'verifyOwnerAccess', { owner_key: ownerKey })).status, 401);
  assert.equal((await planCall(f, 'verifyOwnerAccess', { owner_key: next })).status, 200);
  assert.equal((await planCall(f, 'listRestaurantPlans', { key: ownerKey }, 'GET')).status, 401);
  assert.equal((await planCall(f, 'getAnalyticsHealth', { key: ownerKey }, 'GET')).status, 401);
  assert.equal((await planCall(f, 'getAnalyticsHealth', { key: next }, 'GET')).status, 200);
  assert.equal((await f.call('registerInstagramPublisher', { owner_key: ownerKey, publisher_id: 'blocked', publisher_token: publisherToken })).status, 401);
  assert.equal((await f.call('registerInstagramPublisher', { owner_key: next, publisher_id: 'allowed', publisher_token: publisherToken })).status, 200);
  assert.equal((await planCall(f, 'getRestaurantPlan', { slug: 'internal', token: 'internal-test-token' }, 'GET')).status, 200);
  assert.equal(f.sqlite.prepare("SELECT admin_token FROM restaurants WHERE slug='internal'").get().admin_token, 'internal-test-token');
});

test('password changes work without D1; unavailable auth storage never falls back to bootstrap access', async t => {
  const f = fixture(t);
  f.env.DB.prepare = () => { throw new Error('D1 daily row read limit exceeded'); };
  assert.equal((await planCall(f, 'changeOwnerPassword', { current_password: ownerKey, new_password: 'offline-d1-new-password' })).status, 200);
  assert.equal((await planCall(f, 'verifyOwnerAccess', { owner_key: 'offline-d1-new-password' })).status, 200);
  delete f.env.OWNER_AUTH;
  assert.equal((await planCall(f, 'verifyOwnerAccess', { owner_key: ownerKey })).status, 503);
});

test('concurrent password changes admit one winner and reject replay of the old credential', async t => {
  const f = fixture(t);
  const candidates = ['first-concurrent-password', 'second-concurrent-password'];
  const results = await Promise.all(candidates.map(new_password => planCall(f, 'changeOwnerPassword', { current_password: ownerKey, new_password })));
  assert.equal(results.filter(result => result.status === 200).length, 1);
  const winner = results.findIndex(result => result.status === 200);
  assert.equal((await planCall(f, 'verifyOwnerAccess', { owner_key: candidates[winner] })).status, 200);
  assert.equal((await planCall(f, 'verifyOwnerAccess', { owner_key: candidates[1 - winner] })).status, 401);
});

test('repeated incorrect owner passwords are rate limited', async t => {
  const f = fixture(t);
  for (let i = 0; i < 10; i++) assert.equal((await planCall(f, 'verifyOwnerAccess', { owner_key: 'wrong-password' })).status, 401);
  assert.equal((await planCall(f, 'verifyOwnerAccess', { owner_key: 'wrong-password' })).status, 429);
});

test('owner password storage survives recreation without keeping plaintext or reactivating bootstrap', async t => {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  const sql = { exec(query, ...values) { const rows = db.prepare(query).all(...values); return { toArray: () => rows }; } };
  const { OwnerCredentialStore } = await ownerStorePromise;
  const first = new OwnerCredentialStore(sql, ownerKey);
  const password = 'Senha de gestão com acentos 789!';
  assert.equal((await first.change(ownerKey, password, 'test-client')).ok, true);
  const stored = JSON.stringify(db.prepare('SELECT * FROM owner_credential').all());
  assert.ok(!stored.includes(password) && !stored.includes(ownerKey));
  const reloaded = new OwnerCredentialStore(sql, 'a-different-bootstrap-secret');
  assert.equal((await reloaded.verify(password, 'test-client')).ok, true);
  assert.equal((await reloaded.verify('a-different-bootstrap-secret', 'test-client')).ok, false);
});

test('only the authenticated owner can list or change plans; unknown plans and clients fail closed', async t => {
  const f = fixture(t);
  assert.equal((await planCall(f, 'listRestaurantPlans', {}, 'GET')).status, 401);
  assert.equal((await planCall(f, 'setRestaurantPlan', { slug: 'internal', plan: 'performance', token: 'internal-test-token' })).status, 401);
  assert.equal((await planCall(f, 'setRestaurantPlan', { owner_key: ownerKey, slug: 'internal', plan: '__proto__' })).status, 400);
  assert.equal((await planCall(f, 'setRestaurantPlan', { owner_key: ownerKey, slug: 'missing', plan: 'cardapio' })).status, 404);
  assert.equal((await planCall(f, 'verifyOwnerAccess', { owner_key: ownerKey })).status, 200);
  assert.equal((await planCall(f, 'verifyOwnerAccess', { owner_key: 'qrstack-berna-2026' })).status, 401);
  assert.equal((await planCall(f, 'listRestaurantPlans', { key: ownerKey }, 'GET')).data.restaurants.length, 2);
  assert.equal((await planCall(f, 'getRestaurantPlan', { slug: 'other', token: 'internal-test-token' }, 'GET')).status, 401);
});

test('plan defaults and upgrades unlock exactly the requested capabilities and retain an audit trail', async t => {
  const f = fixture(t);
  f.sqlite.exec('DELETE FROM restaurant_plans');
  const basic = (await planCall(f, 'getRestaurantPlan', { slug: 'internal', token: 'internal-test-token' }, 'GET')).data.entitlement;
  assert.equal(basic.plan, 'cardapio');
  assert.deepEqual(basic.features, { menu: true, story: false, autopublish: false, analytics: false });
  const promotional = (await planCall(f, 'setRestaurantPlan', { owner_key: ownerKey, slug: 'internal', plan: 'divulgacao' })).data.entitlement;
  assert.deepEqual(promotional.features, { menu: true, story: true, autopublish: false, analytics: false });
  const performance = (await planCall(f, 'setRestaurantPlan', { owner_key: ownerKey, slug: 'internal', plan: 'performance' })).data.entitlement;
  assert.deepEqual(performance.features, { menu: true, story: true, autopublish: true, analytics: true });
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM restaurant_plan_events').get().n, 2);
});

test('downgrade cancels pending Stories and rejects direct publication requests despite an enabled binding', async t => {
  const f = fixture(t); await f.setupAccount(); await f.enqueue();
  await planCall(f, 'setRestaurantPlan', { owner_key: ownerKey, slug: 'internal', plan: 'divulgacao' });
  assert.equal(f.sqlite.prepare('SELECT status FROM instagram_story_jobs').get().status, 'cancelled');
  assert.equal((await f.enqueue({ client_request_id: 'new-request' })).status, 409);
  assert.equal((await f.claim()).data.job, null);
  const config = await f.call('getStoryPublishingConfig', { slug: 'internal', token: 'internal-test-token' });
  assert.equal(config.data.publishing.state, 'plan_required');
  await planCall(f, 'setRestaurantPlan', { owner_key: ownerKey, slug: 'internal', plan: 'performance' });
  assert.equal((await f.claim()).data.job, null);
});

test('downgrade after claim blocks the publication permit and after publishing blocks subsequent requests but permits ACK', async t => {
  const f = fixture(t); await f.setupAccount(); await f.enqueue();
  const job = (await f.claim()).data.job;
  await planCall(f, 'setRestaurantPlan', { owner_key: ownerKey, slug: 'internal', plan: 'cardapio' });
  assert.equal((await f.update(job, 'publishing')).status, 409);
  await planCall(f, 'setRestaurantPlan', { owner_key: ownerKey, slug: 'internal', plan: 'performance' });
  assert.equal((await f.update(job, 'publishing')).status, 200);
  await planCall(f, 'setRestaurantPlan', { owner_key: ownerKey, slug: 'internal', plan: 'cardapio' });
  const result = await f.call('getInstagramPublisherJob', { publisher_id: job.publisher_id, job_id: job.id }, { token: publisherToken, claimToken: job.claim_token });
  assert.equal(result.data.can_publish, false);
  assert.equal((await f.update(job, 'completed', { media_id: '12345' })).status, 200);
});

test('analytics checks entitlement before serving even cached data and never returns public cache headers', async t => {
  const f = fixture(t);
  f.env.INSIGHTS_CACHE.get = async key => key.startsWith('insights:v') ? { ok: true, generated_at: new Date().toISOString(), insights: { total_accesses: 42 } } : null;
  assert.equal((await planCall(f, 'getInsights', { slug: 'internal', token: 'wrong' }, 'GET')).status, 401);
  const response = await planCall(f, 'getInsights', { slug: 'internal', token: 'internal-test-token' }, 'GET');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.data.insights.total_accesses, 42);
  await planCall(f, 'setRestaurantPlan', { owner_key: ownerKey, slug: 'internal', plan: 'divulgacao' });
  assert.equal((await planCall(f, 'getInsights', { slug: 'internal', token: 'internal-test-token' }, 'GET')).status, 403);
  assert.equal((await planCall(f, 'getInsights', { slug: 'internal', key: ownerKey }, 'GET')).status, 200);
});

test('plans remain editable through KV during D1 quota exhaustion and sync the latest selection after recovery', async t => {
  const f = fixture(t);
  await planCall(f, 'listRestaurantPlans', { key: ownerKey }, 'GET');
  const originalPrepare = f.env.DB.prepare;
  f.env.DB.prepare = () => { throw new Error("D1_ERROR: Your account has exceeded D1's free tier daily row read limit"); };
  const changed = await planCall(f, 'setRestaurantPlan', { owner_key: ownerKey, slug: 'internal', plan: 'divulgacao' });
  assert.equal(changed.status, 200);
  assert.equal(changed.data.entitlement.plan, 'divulgacao');
  const listing = await planCall(f, 'listRestaurantPlans', { key: ownerKey }, 'GET');
  assert.equal(listing.status, 200);
  assert.equal(listing.data.restaurants.find(row => row.slug === 'internal').plan, 'divulgacao');
  assert.equal((await planCall(f, 'getInsights', { slug: 'internal', token: 'internal-test-token' }, 'GET')).status, 403);
  await planCall(f, 'setRestaurantPlan', { owner_key: ownerKey, slug: 'internal', plan: 'cardapio' });
  f.env.DB.prepare = originalPrepare;
  await planCall(f, 'getRestaurantPlan', { slug: 'internal', token: 'internal-test-token' }, 'GET');
  assert.equal(f.sqlite.prepare("SELECT plan FROM restaurant_plans WHERE restaurant_id='r-internal'").get().plan, 'cardapio');
});

async function autoConnection(f, slug = 'internal', username = '@New_Restaurant') {
  await f.call('registerInstagramPublisher', {owner_key:ownerKey,publisher_id:'test-windows',publisher_token:publisherToken,version:'0.2.0'});
  const result = await f.call('requestInstagramConnection', {owner_key:ownerKey,slug,instagram_username:username,password:'FICTIONAL_PASSWORD'});
  assert.equal(result.status,200,JSON.stringify(result.data));
  return (await claimConnection(f)).data.connection;
}
function finishConnection(f, c, instagram_user_id = '45678') {
  return f.call('completeInstagramConnection',{publisher_id:'test-windows',id:c.id,claim_token:c.claim_token,state:'connected',instagram_user_id,verified_at:new Date().toISOString()},{token:publisherToken});
}
test('owner supplies only username and password; verified login creates the enabled binding atomically', async t => {
  const f=fixture(t), c=await autoConnection(f);
  assert.equal(c.instagram_username,'new_restaurant');
  assert.equal(c.instagram_user_id,'');
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM instagram_account_bindings').get().n,0);
  const done=await finishConnection(f,c);
  assert.equal(done.status,200,JSON.stringify(done.data)); assert.equal(done.data.accepted,true);
  const b=f.sqlite.prepare('SELECT * FROM instagram_account_bindings').get();
  assert.equal(b.instagram_user_id,'45678'); assert.equal(b.enabled,1);
  assert.equal((await finishConnection(f,c)).data.accepted,true);
  const status=(await f.call('getInstagramSessionStatus',{slug:'internal'},{token:ownerKey})).data.session;
  assert.equal(status.instagram_username,'new_restaurant'); assert.equal(status.state,'connected'); assert.equal(status.can_connect,true);
  assert.doesNotMatch(JSON.stringify(status),/password|claim_token|45678/);
});
test('automatic binding refuses an identity already assigned to another restaurant',async t=>{
  const f=fixture(t); await f.setupAccount({slug:'other',userId:'45678'});
  const c=await autoConnection(f), done=await finishConnection(f,c);
  assert.equal(done.data.accepted,false); assert.equal(done.data.state,'review_required');
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM instagram_account_bindings WHERE restaurant_slug='internal'").get().n,0);
});
test('automatic reconnect pins the known identity and rejects changes during login',async t=>{
  const f=fixture(t); await f.setupAccount({username:'new_restaurant',userId:'12345'});
  const c=await autoConnection(f);
  assert.equal(c.instagram_user_id,'12345');
  assert.equal((await finishConnection(f,c,'99999')).data.state,'identity_mismatch');
  assert.equal(f.sqlite.prepare('SELECT instagram_user_id FROM instagram_account_bindings').get().instagram_user_id,'12345');
});
test('automatic binding and acknowledgement roll back together on storage failure',async t=>{
  const f=fixture(t), c=await autoConnection(f);
  f.sqlite.exec("CREATE TRIGGER fail_session BEFORE INSERT ON instagram_session_status BEGIN SELECT RAISE(ABORT,'storage failure'); END");
  assert.equal((await finishConnection(f,c)).status,500);
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM instagram_account_bindings').get().n,0);
  assert.equal(f.sqlite.prepare('SELECT status FROM instagram_connection_requests').get().status,'processing');
  f.sqlite.exec('DROP TRIGGER fail_session');
  assert.equal((await finishConnection(f,c)).data.accepted,true);
});
test('scheduled job is unavailable early, claimed when due, and cannot receive a permit after its deadline',async t=>{
  const f=fixture(t); await f.setupAccount();
  const scheduled_at=new Date(Date.now()+3600000).toISOString();
  const created=await f.enqueue({scheduled_at}); assert.equal(created.status,201,JSON.stringify(created.data));
  assert.equal(created.data.job.scheduled_at,scheduled_at);
  assert.equal((await f.claim()).data.job,null);
  assert.equal((await f.enqueue({scheduled_at})).data.duplicate,true);
  assert.equal((await f.enqueue({scheduled_at:new Date(Date.now()+7200000).toISOString()})).status,409);
  f.sqlite.prepare('UPDATE instagram_story_jobs SET scheduled_at=?,expires_at=?').run(new Date(Date.now()-1000).toISOString(),new Date(Date.now()+60000).toISOString());
  const claimed=(await f.claim()).data.job; assert.ok(claimed);
  f.sqlite.exec("UPDATE instagram_story_jobs SET expires_at='2000-01-01'");
  assert.equal((await f.update(claimed,'publishing')).status,409);
  const inspection=await f.call('getInstagramPublisherJob',{publisher_id:'test-windows',job_id:claimed.id},{token:publisherToken,claimToken:claimed.claim_token});
  assert.equal(inspection.data.can_publish,false);
});
test('missed schedules expire without dispatch; cancellation is tenant scoped and pending only',async t=>{
  const f=fixture(t); await f.setupAccount();
  const scheduled_at=new Date(Date.now()+3600000).toISOString();
  const created=await f.enqueue({scheduled_at}), job=created.data.job;
  assert.equal((await f.call('cancelInstagramStoryJob',{slug:'other',token:'other-test-token',job_id:job.id})).status,409);
  assert.equal((await f.call('cancelInstagramStoryJob',{slug:'internal',token:'internal-test-token',job_id:job.id})).data.job.status,'cancelled');
  const second=await f.enqueue({scheduled_at,client_request_id:'second'}); assert.equal(second.status,201);
  f.sqlite.exec("UPDATE instagram_story_jobs SET expires_at='2000-01-01' WHERE status='pending'");
  assert.equal((await f.claim()).data.job,null);
  assert.equal(f.sqlite.prepare("SELECT error_code FROM instagram_story_jobs WHERE id=?").get(second.data.job.id).error_code,'schedule_missed');
});
test('scheduling validates horizon, prevents overlapping daily windows and keeps plan authorization',async t=>{
  const f=fixture(t); await f.setupAccount();
  for(const scheduled_at of ['garbage',new Date(Date.now()-1000).toISOString(),new Date(Date.now()+8*86400000).toISOString()]) assert.equal((await f.enqueue({scheduled_at})).status,400);
  assert.equal((await f.enqueue({scheduled_at:new Date(Date.now()+3600000).toISOString()})).status,201);
  const conflict=await f.enqueue({client_request_id:'conflict',scheduled_at:new Date(Date.now()+7200000).toISOString()});
  assert.equal(conflict.data.error,'story_schedule_conflict');
  f.sqlite.exec("UPDATE restaurant_plans SET plan='divulgacao'");
  assert.equal((await f.enqueue({client_request_id:'blocked',scheduled_at:new Date(Date.now()+3*86400000).toISOString()})).status,409);
});

test('D1 daily quota returns a safe temporary error and backoff without exposing database details', async t=>{
  const f=fixture(t);
  f.env.DB.prepare=()=>{throw new Error("D1_ERROR: Your account has exceeded D1's free tier daily row read limit. SECRET_SQL");};
  const result=await f.call('reportInstagramSessions',{publisher_id:'test-windows',version:'0.2.0',sessions:[]},{token:publisherToken});
  assert.equal(result.status,503);
  assert.equal(result.data.error,'instagram_storage_temporarily_unavailable');
  assert.ok(Number(result.headers.get('retry-after'))>=60);
  assert.doesNotMatch(JSON.stringify(result.data),/SECRET_SQL|D1_ERROR/);
});
