import { verifyOwner } from './owner-auth.js';

function unauthorized() { const error = new Error('unauthorized'); error.status = 401; throw error; }
export function tenantSlug(value) {
  const slug = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) unauthorized();
  return slug;
}
export async function equalTenantToken(received, expected) {
  if (!received || !expected) return false;
  const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value))));
  const [a, b] = await Promise.all([digest(received), digest(expected)]);
  if (typeof crypto.subtle.timingSafeEqual === 'function') return crypto.subtle.timingSafeEqual(a, b);
  let difference = 0; for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
export function clientToken(request, supplied = '') {
  return request.headers.get('x-client-token') || supplied || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
}
export async function getTenant(env, slugValue) {
  const slug = tenantSlug(slugValue);
  // This is a private auth cache, never the public restaurant/catalog snapshot.
  const cached = await env.INSIGHTS_CACHE?.get('plans:tenant:' + slug, 'json');
  if (cached?.slug === slug && cached.id && cached.admin_token) return cached;
  const row = await env.DB.prepare('SELECT id, slug, admin_token FROM restaurants WHERE slug = ?').bind(slug).first();
  if (row && env.INSIGHTS_CACHE) await env.INSIGHTS_CACHE.put('plans:tenant:' + slug, JSON.stringify(row));
  return row;
}
export async function authorizeTenant(env, request, slug, supplied = '') {
  const tenant = await getTenant(env, slug);
  if (!tenant) unauthorized();
  if (await verifyOwner(env, request)) return tenant;
  if (!await equalTenantToken(clientToken(request, supplied), tenant.admin_token)) unauthorized();
  return tenant;
}

const RESTAURANT_PUBLIC_FIELDS = ['id', 'slug', 'name', 'logo_url', 'symbol_url', 'primary_color', 'secondary_color', 'accent_color', 'whatsapp_number', 'instagram_url', 'maps_url', 'address', 'github_pages_url', 'assets_base_url', 'manifest_url', 'catalog_url', 'sections_url', 'story_link'];
const CATALOG_PUBLIC_FIELDS = ['id', 'restaurant_id', 'section_id', 'section_title', 'name', 'category', 'description', 'price', 'image_url', 'sort_order', 'is_active'];
const ASSET_PUBLIC_FIELDS = ['id', 'restaurant_id', 'catalog_item_id', 'asset_type', 'label', 'url'];
const MENU_PUBLIC_FIELDS = ['id', 'restaurant_id', 'date', 'title', 'price', 'service_hours', 'story_link', 'is_published', 'published_at'];
const ITEM_PUBLIC_FIELDS = ['id', 'menu_day_id', 'name', 'category', 'description', 'price', 'image_url', 'is_highlight', 'sort_order'];
function selectFields(value, fields) {
  if (!value) return value;
  return Object.fromEntries(fields.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));
}
export function publicRestaurant(value) { return selectFields(value, RESTAURANT_PUBLIC_FIELDS); }
export function publicRestaurantResult(value) { return { restaurant: publicRestaurant(value.restaurant), restaurant_source: value.restaurant_source }; }
export function publicCatalogResult(value) {
  return { restaurant: publicRestaurant(value.restaurant), items: (value.items || []).map(row => selectFields(row, CATALOG_PUBLIC_FIELDS)),
    assets: (value.assets || []).map(row => selectFields(row, ASSET_PUBLIC_FIELDS)), catalog_source: value.catalog_source, cached_at: value.cached_at };
}
export function publicMenuResult(value) {
  const published = Number(value.menu?.is_published) === 1;
  return { restaurant: publicRestaurant(value.restaurant), menu: published ? selectFields(value.menu, MENU_PUBLIC_FIELDS) : null,
    items: published ? (value.items || []).map(row => selectFields(row, ITEM_PUBLIC_FIELDS)) : [] };
}
