import { verifyOwner } from './owner-auth.js';
export const PLANS = Object.freeze({
  cardapio: { name: 'RSTACK CARDÁPIO', features: { menu: true, story: false, autopublish: false, analytics: false } },
  divulgacao: { name: 'QRSTACK DIVULGAÇÃO', features: { menu: true, story: true, autopublish: false, analytics: false } },
  performance: { name: 'QRSTACK PERFORMANCE', features: { menu: true, story: true, autopublish: true, analytics: true } },
});
function deny(code, status = 403) { const error = new Error(code); error.status = status; throw error; }
async function same(a, b) {
  if (!a || !b) return false;
  const hash = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value))));
  const [left, right] = await Promise.all([hash(a), hash(b)]);
  let diff = 0; for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}
function bearer(request) { return request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''; }
export async function isOwner(env, request, supplied = '') {
  return verifyOwner(env, request, supplied || bearer(request));
}
function capacity(error) { return /row read limit|rows read|daily.*limit|quota|exceeded.*D1/i.test(String(error?.message || '')); }
async function cached(env, key) { return env.INSIGHTS_CACHE?.get ? env.INSIGHTS_CACHE.get(key, 'json') : null; }
async function saveCache(env, key, value) { if (env.INSIGHTS_CACHE) await env.INSIGHTS_CACHE.put(key, JSON.stringify(value)); }
async function tenantFor(env, slug) {
  const saved = await cached(env, 'plans:tenant:' + slug);
  if (saved) return saved;
  const row = await env.DB.prepare('SELECT id, slug, admin_token FROM restaurants WHERE slug = ?').bind(slug).first();
  if (row) await saveCache(env, 'plans:tenant:' + slug, row);
  return row;
}
async function syncPlan(env, record) {
  const timestamp = record.updated_at;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO restaurant_plans(restaurant_id, plan, updated_at) VALUES (?, ?, ?) ON CONFLICT(restaurant_id) DO UPDATE SET plan = excluded.plan, updated_at = excluded.updated_at WHERE excluded.updated_at > restaurant_plans.updated_at').bind(record.restaurant_id, record.plan, timestamp),
    env.DB.prepare('INSERT OR IGNORE INTO restaurant_plan_events(id, restaurant_id, plan, created_at) VALUES (?, ?, ?, ?)').bind(record.id, record.restaurant_id, record.plan, timestamp),
    env.DB.prepare("UPDATE instagram_story_jobs SET status = 'cancelled', checkpoint = 'plan_changed', updated_at = ? WHERE restaurant_id = ? AND status = 'pending' AND queued_at <= ?").bind(timestamp, record.restaurant_id, record.cancel_pending_before || ''),
  ]);
}
export async function entitlement(env, restaurantId) {
  let row = await cached(env, 'plans:access:' + restaurantId);
  if (row?.d1_sync_pending) {
    try { await syncPlan(env, row); } catch { /* D1 is optional for plan management, mandatory for publication. */ }
  }
  if (!row) {
    try { row = await env.DB.prepare('SELECT plan FROM restaurant_plans WHERE restaurant_id = ?').bind(restaurantId).first(); }
    catch (error) { if (!capacity(error)) throw error; row = null; }
  }
  const plan = Object.hasOwn(PLANS, row?.plan || '') ? row.plan : 'cardapio';
  return { plan, ...PLANS[plan] };
}
export async function authorizeInsights(env, request, params) {
  if (await isOwner(env, request, params.get('key') || params.get('owner_key'))) return;
  const tenant = await tenantFor(env, params.get('slug') || 'amaro');
  if (!tenant || !await same(params.get('token') || bearer(request), tenant.admin_token)) deny('unauthorized', 401);
  if (!(await entitlement(env, tenant.id)).features.analytics) deny('plan_performance_required');
}
export async function handlePlans(request, env, payload, action) {
  if (!['verifyOwnerAccess', 'listRestaurantPlans', 'getRestaurantPlan', 'setRestaurantPlan'].includes(action)) return null;
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' };
  try {
    const params = new URL(request.url).searchParams;
    const write = ['verifyOwnerAccess', 'setRestaurantPlan'].includes(action);
    if (request.method !== (write ? 'POST' : 'GET')) deny('method_not_allowed', 405);
    const owner = await isOwner(env, request, payload.owner_key || params.get('key'));
    if (action !== 'getRestaurantPlan' && !owner) deny('unauthorized', 401);
    let result = {};
    if (action === 'listRestaurantPlans') {
      let rows;
      try {
        rows = (await env.DB.prepare('SELECT r.*, p.plan FROM restaurants r LEFT JOIN restaurant_plans p ON p.restaurant_id = r.id ORDER BY r.name').all()).results || [];
        await saveCache(env, 'plans:restaurants', rows);
        for (const row of rows) await saveCache(env, 'plans:tenant:' + row.slug, { id: row.id, slug: row.slug, admin_token: row.admin_token });
      } catch (error) {
        if (!capacity(error)) throw error;
        rows = await cached(env, 'plans:restaurants');
        if (!rows) throw error;
      }
      result.restaurants = await Promise.all(rows.map(async row => ({ ...row, plan: (await entitlement(env, row.id)).plan })));
    } else if (action !== 'verifyOwnerAccess') {
      const slug = String(payload.slug || params.get('slug') || '');
      const tenant = await tenantFor(env, slug);
      if (!tenant) deny('restaurant_not_found', 404);
      if (!owner && !await same(params.get('token') || bearer(request), tenant.admin_token)) deny('unauthorized', 401);
      if (action === 'setRestaurantPlan') {
        if (!Object.hasOwn(PLANS, payload.plan || '')) deny('invalid_plan', 400);
        const previous = await cached(env, 'plans:access:' + tenant.id);
        const timestamp = new Date(Math.max(Date.now(), (Date.parse(previous?.updated_at || '') || 0) + 1)).toISOString();
        const record = { id: crypto.randomUUID(), restaurant_id: tenant.id, plan: payload.plan, updated_at: timestamp, d1_sync_pending: true,
          cancel_pending_before: payload.plan === 'performance' ? previous?.cancel_pending_before || '' : timestamp };
        await saveCache(env, 'plans:access:' + tenant.id, record);
        try { await syncPlan(env, record); } catch { /* KV already durably saved the owner's selection; mirror it when D1 recovers. */ }
      }
      result.entitlement = await entitlement(env, tenant.id);
    }
    return new Response(JSON.stringify({ ok: true, ...result }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.status ? error.message : 'plan_service_unavailable' }), { status: error.status || 500, headers });
  }
}
