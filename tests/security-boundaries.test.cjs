const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const workerPromise = import(pathToFileURL(path.join(root, 'cloudflare/src/worker.js')).href);

function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(fs.readFileSync(path.join(root, 'cloudflare/migrations/0001_qrstack_core.sql'), 'utf8'));
  sqlite.exec(`INSERT INTO restaurants(id,slug,name,admin_token) VALUES
    ('alpha-id','alpha','Alpha','alpha-private-token'), ('beta-id','beta','Beta','beta-private-token');
    INSERT INTO catalog_items(id,restaurant_id,section_id,section_title,name) VALUES ('beta-item','beta-id','food','Food','Beta original');
    INSERT INTO menu_days(id,restaurant_id,date,title,is_published,notes) VALUES ('beta-menu','beta-id','2026-10-07','Beta original',1,'private internal note');
    INSERT INTO menu_items(id,menu_day_id,name,category) VALUES ('beta-child','beta-menu','Beta dish','Food');`);
  const kv = new Map();
  const env = {
    OWNER_AUTH: { getByName() { return {
      async verify(value) { return { ok: value === 'owner-test-secret' }; },
      async verifySession(value) { return { ok: value === 'owner-session' }; },
      async rateLimit() { return { ok: true }; },
    }; } },
    DB: {
      prepare(sql) {
        let values = [];
        const statement = {
          bind(...args) { values = args; return statement; },
          run() { const value = sqlite.prepare(sql).run(...values); return { meta: { changes: Number(value.changes) } }; },
          first() { return sqlite.prepare(sql).get(...values) || null; },
          all() { return { results: sqlite.prepare(sql).all(...values) }; },
        }; return statement;
      },
      batch(statements) {
        sqlite.exec('BEGIN');
        try { const result = statements.map(value => value.run()); sqlite.exec('COMMIT'); return result; }
        catch (error) { sqlite.exec('ROLLBACK'); throw error; }
      },
    },
    INSIGHTS_CACHE: {
      async get(key, type) { const value = kv.get(key); return value && type === 'json' ? JSON.parse(value) : value || null; },
      async put(key, value) { kv.set(key, value); },
    },
    ANALYTICS_RETRY_QUEUE: { async send() {} },
  };
  async function call(action, data = {}, { method = 'GET', headers = {} } = {}) {
    const url = new URL('https://worker.test/'); url.searchParams.set('action', action);
    if (method === 'GET') Object.entries(data).forEach(([key, value]) => url.searchParams.set(key, value));
    const request = new Request(url, { method, headers, ...(method === 'POST' ? { body: JSON.stringify({ action, ...data }) } : {}) });
    const response = await (await workerPromise).default.fetch(request, env, { waitUntil() {} });
    return { status: response.status, headers: response.headers, data: await response.json() };
  }
  return { env, sqlite, kv, call };
}

test('public restaurant/catalog/menu responses never return credentials or internal source fields', async t => {
  const f = fixture(t);
  for (const action of ['getRestaurant', 'getCatalog', 'getMenu']) {
    const result = await f.call(action, { slug: 'beta', date: '2026-10-07' });
    assert.equal(result.status, 200);
    const serialized = JSON.stringify(result.data);
    assert.doesNotMatch(serialized, /admin_token|beta-private-token|private internal note|live_menu_endpoint/);
    assert.equal(result.data.restaurant.slug, 'beta');
  }
});

test('previously cached catalog/menu credentials are redacted at response boundary', async t => {
  const f = fixture(t);
  const restaurant = { id: 'beta-id', slug: 'beta', name: 'Beta', admin_token: 'cached-secret', live_menu_endpoint: 'https://private.test/' };
  f.kv.set('catalog:v1-resilient-catalog:beta', JSON.stringify({ restaurant, items: [{ id: 'i', name: 'Dish', secret: 'unexpected' }], assets: [], cached_at: new Date().toISOString() }));
  f.kv.set('menu:v1-unified-responses:beta:2026-10-07', JSON.stringify({ restaurant, menu: { id: 'm', is_published: 1, notes: 'private-note' }, items: [] }));
  for (const action of ['getRestaurant', 'getCatalog', 'getMenu']) {
    const result = await f.call(action, { slug: 'beta', date: '2026-10-07' });
    assert.equal(result.status, 200);
    assert.doesNotMatch(JSON.stringify(result.data), /cached-secret|admin_token|private\.test|private-note|unexpected/);
  }
});

test('unpublished menus are never exposed publicly even from an old KV record', async t => {
  const f = fixture(t);
  f.kv.set('menu:v1-unified-responses:beta:2026-10-07', JSON.stringify({ restaurant: { slug: 'beta' }, menu: { id: 'draft', is_published: 0, title: 'Draft secret' }, items: [{ name: 'Draft dish' }] }));
  const result = await f.call('getMenu', { slug: 'beta', date: '2026-10-07' });
  assert.equal(result.status, 200);
  assert.equal(result.data.menu, null);
  assert.deepEqual(result.data.items, []);
});

test('tenant authentication cannot use another tenant token and explicit owner reveal is protected', async t => {
  const f = fixture(t);
  assert.equal((await f.call('verifyClientAccess', { slug: 'beta', token: 'alpha-private-token' }, { method: 'POST' })).status, 401);
  assert.equal((await f.call('verifyClientAccess', { slug: 'beta' }, { method: 'POST', headers: { 'X-Client-Token': 'beta-private-token' } })).status, 200);
  assert.equal((await f.call('getRestaurantAccess', { slug: 'beta' }, { headers: { 'X-Client-Token': 'beta-private-token' } })).status, 401);
  const owner = await f.call('getRestaurantAccess', { slug: 'beta' }, { headers: { 'X-Owner-Key': 'owner-test-secret' } });
  assert.equal(owner.status, 200);
  assert.equal(owner.data.token, 'beta-private-token');
  assert.equal(owner.headers.get('cache-control'), 'no-store');
});

test('tenant cannot rewrite another restaurant menu or delete its child items by supplied ID', async t => {
  const f = fixture(t);
  const result = await f.call('saveMenuDay', { slug: 'alpha', menu_id: 'beta-menu', date: '2026-10-07', title: 'Attack', items: [{ name: 'Injected dish' }] },
    { method: 'POST', headers: { 'X-Client-Token': 'alpha-private-token' } });
  assert.equal(result.status, 200);
  assert.equal(result.data.menu.id, 'menu_alpha_2026-10-07');
  assert.equal(f.sqlite.prepare("SELECT title FROM menu_days WHERE id='beta-menu'").get().title, 'Beta original');
  assert.deepEqual(f.sqlite.prepare("SELECT id,name FROM menu_items WHERE menu_day_id='beta-menu'").all().map(row => ({ ...row })), [{ id: 'beta-child', name: 'Beta dish' }]);
});

test('owner session can access tenant management without revealing or submitting client credential', async t => {
  const f = fixture(t);
  const good = { method: 'POST', headers: { 'X-Owner-Session': 'owner-session' } };
  assert.equal((await f.call('verifyClientAccess', { slug: 'alpha' }, good)).status, 200);
  const result = await f.call('saveMenuDay', { slug: 'alpha', date: '2026-10-07', title: 'Owner update', items: [] }, good);
  assert.equal(result.status, 200);
  assert.doesNotMatch(JSON.stringify(result.data), /alpha-private-token|admin_token/);
  const denied = await f.call('verifyClientAccess', { slug: 'alpha' }, { method: 'POST', headers: { 'X-Owner-Session': 'expired-session' } });
  assert.equal(denied.status, 401);
});

test('rate limited private requests stop before database access and return Retry-After', async t => {
  const f = fixture(t);
  f.env.OWNER_AUTH = { getByName() { return { async rateLimit() { return { ok: false, status: 429, error: 'too_many_requests', retry_after: 42 }; } }; } };
  f.env.DB.prepare = () => { throw new Error('Database must not be touched'); };
  const result = await f.call('verifyClientAccess', { slug: 'alpha', token: 'alpha-private-token' }, { method: 'POST' });
  assert.equal(result.status, 429);
  assert.equal(result.headers.get('retry-after'), '42');
  assert.equal(result.headers.get('access-control-expose-headers'), 'Retry-After');
});

test('catalog updates reject IDs belonging to another tenant even when forged creation flag supplied', async t => {
  const f = fixture(t);
  const result = await f.call('saveCatalogItem', { slug: 'alpha', id: 'beta-item', name: 'Injected', allow_create_with_id: true },
    { method: 'POST', headers: { 'X-Client-Token': 'alpha-private-token' } });
  assert.equal(result.status, 404);
  assert.equal(f.sqlite.prepare("SELECT name FROM catalog_items WHERE id='beta-item'").get().name, 'Beta original');
});

test('unauthorized writes fail before modifying public KV snapshots during D1 fallback', async t => {
  const f = fixture(t);
  f.kv.set('plans:tenant:amaro', JSON.stringify({ id: 'rest_amaro', slug: 'amaro', admin_token: 'new-private-token' }));
  f.env.DB.prepare = () => { throw new Error('D1 free tier daily row read limit'); };
  for (const action of ['saveMenuDay', 'saveCatalogItem']) {
    const result = await f.call(action, { slug: 'amaro', token: 'qrstack-amaro-2026', date: '2026-10-07', name: 'Unauthorized', items: [{ name: 'Unauthorized' }] }, { method: 'POST' });
    assert.equal(result.status, 401);
  }
  assert.deepEqual([...f.kv.keys()], ['plans:tenant:amaro']);
});

test('unexpected SQL errors are redacted and private JSONP is disabled', async t => {
  const f = fixture(t);
  f.env.DB.prepare = () => { throw new Error('SQL secret_database_column private-key-value'); };
  const response = await f.call('getRestaurant', { slug: 'alpha' });
  assert.equal(response.status, 500);
  assert.equal(response.data.error, 'service_unavailable');
  const denied = await f.call('getMenuResponses', { slug: 'alpha', callback: 'steal' });
  assert.equal(denied.status, 401);
  assert.match(denied.headers.get('content-type'), /application\/json/);
  assert.equal(denied.headers.get('cache-control'), 'no-store');
});

test('public catalog and menu lookups never create unregistered tenants', async t => {
  const f = fixture(t);
  for (const action of ['getCatalog', 'getMenu']) {
    assert.equal((await f.call(action, { slug: 'invented-tenant' })).status, 404);
  }
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS total FROM restaurants WHERE slug='invented-tenant'").get().total, 0);
});

function legacyFixture() {
  const context = vm.createContext({
    PropertiesService: { getScriptProperties() { return { getProperty() { return 'worker-private-service-token'.repeat(2); } }; } },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest(algorithm, value) { return [...require('node:crypto').createHash('sha256').update(value).digest()]; },
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput(body) { return { body, setMimeType() { return this; } }; } },
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/Code.gs'), 'utf8'), context);
  context.readObjects = name => name === 'restaurants' ? [{ id: 'r', slug: 'amaro', name: 'Restaurant', admin_token: 'legacy-private-client-token', live_menu_endpoint: 'https://private.test/' }] : [];
  return context;
}

test('legacy Apps Script source also redacts public restaurant data and removes JSONP', () => {
  const context = legacyFixture();
  const response = context.doGet({ parameter: { action: 'getRestaurant', slug: 'amaro', callback: 'steal' } });
  const value = JSON.parse(response.body);
  assert.equal(value.ok, true);
  assert.doesNotMatch(response.body, /legacy-private-client-token|admin_token|live_menu_endpoint|steal/);
  assert.deepEqual(JSON.parse(context.json({ ok: true }, 'steal').body), { ok: true });
});

test('legacy management writes are retired and public callers cannot bypass Worker event rate limits', () => {
  const context = legacyFixture();
  for (const action of ['saveMenuDay', 'saveStoryAsset']) {
    const value = JSON.parse(context.doPost({ parameter: { action, slug: 'amaro', token: 'legacy-private-client-token' } }).body);
    assert.equal(value.error, 'legacy_management_retired');
  }
  const tracked = JSON.parse(context.doPost({ parameter: { action: 'trackEvent', slug: 'amaro' } }).body);
  assert.equal(tracked.error, 'request_denied');
  const oldOwner = JSON.parse(context.doGet({ parameter: { action: 'getInsights', slug: 'amaro', key: 'qrstack-berna-2026' } }).body);
  assert.equal(oldOwner.error, 'request_denied');
});

test('legacy data provider errors expose no private values', () => {
  const context = legacyFixture();
  context.readObjects = () => { throw new Error('private-sheet-key sensitive-value'); };
  const result = JSON.parse(context.doGet({ parameter: { action: 'getRestaurant', slug: 'amaro' } }).body);
  assert.deepEqual(result, { ok: false, error: 'request_denied' });
});
