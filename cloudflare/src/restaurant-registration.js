function invalid(code, status = 400) { const error = new Error(code); error.status = status; throw error; }
const plans = ['cardapio', 'divulgacao', 'performance'];

export function registrationFields(payload) {
  const text = (key, max) => {
    const value = String(payload[key] || '').trim();
    if (value.length > max || /[\u0000-\u001f<>"`]/.test(value)) invalid('invalid_' + key);
    return value;
  };
  const name = text('name', 120);
  const slug = text('slug', 80).toLowerCase();
  if (name.length < 2) invalid('invalid_name');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) invalid('invalid_slug');
  const plan = payload.plan || 'cardapio';
  if (!plans.includes(plan)) invalid('invalid_plan');
  const url = key => {
    const value = text(key, 2048);
    if (!value) return '';
    try { if (new URL(value).protocol === 'https:') return value; } catch {}
    invalid('invalid_' + key);
  };
  const phone = text('whatsapp_number', 30).replace(/[\s()+-]/g, '');
  if (phone && !/^\d{10,15}$/.test(phone)) invalid('invalid_whatsapp_number');
  return { name, slug, plan, address: text('address', 300), whatsapp_number: phone,
    instagram_url: url('instagram_url'), github_pages_url: url('github_pages_url') };
}

export async function createRestaurant(env, payload) {
  const fields = registrationFields(payload);
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  // The unique slug and atomic batch prevent duplicate or partially created clients.
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO restaurants (id, slug, name, address, whatsapp_number, instagram_url, github_pages_url, admin_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, fields.slug, fields.name, fields.address, fields.whatsapp_number, fields.instagram_url, fields.github_pages_url, crypto.randomUUID() + crypto.randomUUID()),
      env.DB.prepare('INSERT INTO restaurant_plans (restaurant_id, plan, updated_at) VALUES (?, ?, ?)').bind(id, fields.plan, timestamp),
      env.DB.prepare('INSERT INTO restaurant_plan_events (id, restaurant_id, plan, created_at) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), id, fields.plan, timestamp),
    ]);
  } catch (error) {
    if (/UNIQUE constraint failed: restaurants.slug/i.test(error.message)) invalid('restaurant_slug_exists', 409);
    throw error;
  }
  return { id, ...fields };
}
