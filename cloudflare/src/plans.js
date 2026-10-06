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
  return same(supplied || bearer(request), env.OWNER_ACCESS_TOKEN);
}
export async function entitlement(db, restaurantId) {
  const row = await db.prepare('SELECT plan FROM restaurant_plans WHERE restaurant_id = ?').bind(restaurantId).first();
  const plan = Object.hasOwn(PLANS, row?.plan || '') ? row.plan : 'cardapio';
  return { plan, ...PLANS[plan] };
}
export async function authorizeInsights(env, request, params) {
  if (await isOwner(env, request, params.get('key') || params.get('owner_key'))) return;
  const tenant = await env.DB.prepare('SELECT id, admin_token FROM restaurants WHERE slug = ?').bind(params.get('slug') || 'amaro').first();
  if (!tenant || !await same(params.get('token') || bearer(request), tenant.admin_token)) deny('unauthorized', 401);
  if (!(await entitlement(env.DB, tenant.id)).features.analytics) deny('plan_performance_required');
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
      const rows = (await env.DB.prepare('SELECT r.*, p.plan FROM restaurants r LEFT JOIN restaurant_plans p ON p.restaurant_id = r.id ORDER BY r.name').all()).results || [];
      result.restaurants = rows.map(row => ({ ...row, plan: row.plan || 'cardapio' }));
    } else if (action !== 'verifyOwnerAccess') {
      const slug = String(payload.slug || params.get('slug') || '');
      const tenant = await env.DB.prepare('SELECT id, admin_token FROM restaurants WHERE slug = ?').bind(slug).first();
      if (!tenant) deny('restaurant_not_found', 404);
      if (!owner && !await same(params.get('token') || bearer(request), tenant.admin_token)) deny('unauthorized', 401);
      if (action === 'setRestaurantPlan') {
        if (!Object.hasOwn(PLANS, payload.plan || '')) deny('invalid_plan', 400);
        const timestamp = new Date().toISOString();
        await env.DB.batch([
          env.DB.prepare('INSERT INTO restaurant_plans(restaurant_id, plan, updated_at) VALUES (?, ?, ?) ON CONFLICT(restaurant_id) DO UPDATE SET plan = excluded.plan, updated_at = excluded.updated_at').bind(tenant.id, payload.plan, timestamp),
          env.DB.prepare('INSERT INTO restaurant_plan_events(id, restaurant_id, plan, created_at) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), tenant.id, payload.plan, timestamp),
          // Pending work never survives a downgrade to be replayed after an upgrade.
          env.DB.prepare("UPDATE instagram_story_jobs SET status = 'cancelled', checkpoint = 'plan_changed', updated_at = ? WHERE restaurant_id = ? AND status = 'pending' AND ? <> 'performance'").bind(timestamp, tenant.id, payload.plan),
        ]);
      }
      result.entitlement = await entitlement(env.DB, tenant.id);
    }
    return new Response(JSON.stringify({ ok: true, ...result }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.status ? error.message : 'plan_service_unavailable' }), { status: error.status || 500, headers });
  }
}
