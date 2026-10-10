import { enforceRateLimit } from './owner-auth.js';
export const SESSION_ACTIONS = new Set(['getInstagramSessionStatus', 'requestInstagramConnection', 'claimInstagramConnection', 'reportInstagramSessions', 'completeInstagramConnection']);
const STATES = new Set(['connected', 'disconnected', 'verification_required', 'cooldown', 'suspended', 'identity_mismatch', 'review_required', 'connection_failed']);
const stamp = () => new Date().toISOString();
function fail(message, status = 400, retryAfter = 0) { throw Object.assign(new Error(message), { status, retryAfter }); }
async function digest(text) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(b => b.toString(16).padStart(2, '0')).join(''); }
async function key(env) {
  if (!/^[a-f0-9]{64}$/.test(env.INSTAGRAM_CREDENTIAL_KEY || '')) fail('instagram_connection_unavailable', 503);
  return crypto.subtle.importKey('raw', Uint8Array.from(env.INSTAGRAM_CREDENTIAL_KEY.match(/../g), h => parseInt(h, 16)), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function encrypt(env, password, context) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(context) }, await key(env), new TextEncoder().encode(password));
  return JSON.stringify({ iv: [...iv], data: btoa(String.fromCharCode(...new Uint8Array(bytes))) });
}
async function decrypt(env, encrypted, context) {
  const value = JSON.parse(encrypted);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(value.iv), additionalData: new TextEncoder().encode(context) }, await key(env), Uint8Array.from(atob(value.data), c => c.charCodeAt(0))));
}
export async function expireInstagramConnections(env) {
  await env.DB.prepare("UPDATE instagram_connection_requests SET status = 'expired', encrypted_password = NULL, updated_at = ? WHERE status IN ('pending','processing') AND expires_at <= ?").bind(stamp(), stamp()).run();
}
function same(binding, value) {
  return binding && binding.publisher_id === value.publisher_id && binding.instagram_username === value.instagram_username && binding.instagram_user_id === value.instagram_user_id;
}
function snapshot(binding) {
  return binding ? JSON.stringify([binding.publisher_id, binding.instagram_username, binding.instagram_user_id, binding.updated_at]) : null;
}
async function automaticPublisher(env, binding) {
  if (binding?.publisher_active) {
    const assigned = await env.DB.prepare("SELECT * FROM instagram_publishers WHERE publisher_id=? AND is_active=1 AND version='0.2.0'").bind(binding.publisher_id).first();
    if (assigned) return assigned;
  }
  const available = (await env.DB.prepare("SELECT * FROM instagram_publishers WHERE is_active=1 AND version='0.2.0' ORDER BY last_seen_at DESC LIMIT 2").all()).results;
  return available.length === 1 ? available[0] : null;
}
export async function handleSessionAction(request, env, payload, action, helpers) {
  const params = new URL(request.url).searchParams;
  const ownerAction = ['getInstagramSessionStatus', 'requestInstagramConnection'].includes(action);
  if (request.method !== (action === 'getInstagramSessionStatus' ? 'GET' : 'POST')) fail('method_not_allowed', 405);
  const origin = request.headers.get('origin');
  if (ownerAction && origin && origin !== 'https://btcsolucoes.github.io'
      && !(new URL(request.url).hostname === '127.0.0.1' && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin))) fail('origin_not_allowed', 403);
  if (ownerAction) await helpers.owner(env, request, payload);
  const agent = ownerAction ? null : await helpers.publisher(env, request, payload.publisher_id);
  await expireInstagramConnections(env);
  if (ownerAction) {
    const tenant = await env.DB.prepare('SELECT id, slug FROM restaurants WHERE slug = ?').bind(String(payload.slug || params.get('slug') || '')).first();
    if (!tenant) fail('restaurant_not_found', 404);
    const binding = await helpers.bindingFor(env, tenant.id);
    if (action === 'getInstagramSessionStatus') {
      const current = await env.DB.prepare('SELECT * FROM instagram_session_status WHERE restaurant_id = ?').bind(tenant.id).first();
      let latest = await env.DB.prepare('SELECT * FROM instagram_connection_requests WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT 1').bind(tenant.id).first();
      if (latest && !latest.auto_bind && !same(binding, latest)) latest = null;
      const automatic = await automaticPublisher(env, binding);
      const runner = automatic || (binding && await env.DB.prepare('SELECT last_seen_at,is_active FROM instagram_publishers WHERE publisher_id = ?').bind(binding.publisher_id).first());
      const valid = same(binding, current || {});
      const rejected = latest?.auto_bind && latest.status === 'completed' && latest.result_state !== 'connected';
      return { session: { state: rejected ? latest.result_state : valid ? current.state : 'unknown', verified_at: valid ? current.verified_at : null,
        reported_at: valid ? current.reported_at : null, publisher_online: !!runner?.is_active && !!runner?.last_seen_at && Date.now() - Date.parse(runner.last_seen_at) < 120000,
        instagram_username: latest?.auto_bind ? latest.instagram_username : binding?.instagram_username || '', can_connect: !!automatic,
        request_status: latest?.status || null, result_state: latest?.result_state || null, configured: !!binding } };
    }
    await enforceRateLimit(env, request, 'instagram_connect');
    const auto = Object.hasOwn(payload, 'instagram_username');
    const username = auto ? String(payload.instagram_username || '').trim().replace(/^@/, '').toLowerCase() : binding?.instagram_username;
    if (auto && !/^[a-z0-9._]{1,30}$/.test(username)) fail('invalid_instagram_account');
    const selected = auto ? await automaticPublisher(env, binding) : null;
    if (auto ? !selected : !binding?.publisher_active) fail(auto ? 'instagram_publisher_unavailable' : 'instagram_binding_required', 409);
    const publisherId = auto ? selected.publisher_id : binding.publisher_id;
    const userId = !auto || binding?.instagram_username === username ? binding?.instagram_user_id || '' : '';
    const password = payload.password;
    if (typeof password !== 'string' || !password || password.length > 128) fail('invalid_instagram_password');
    const unresolved = await env.DB.prepare("SELECT id FROM instagram_story_jobs WHERE restaurant_id = ? AND status IN ('pending','claimed','preparing','publishing','outcome_unknown') LIMIT 1").bind(tenant.id).first();
    if (unresolved) fail('account_has_unresolved_jobs', 409);
    const recent = await env.DB.prepare('SELECT created_at FROM instagram_connection_requests WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT 1').bind(tenant.id).first();
    if (recent && Date.now() - Date.parse(recent.created_at) < 120000) fail('instagram_connection_wait', 429, Math.ceil((120000 - (Date.now() - Date.parse(recent.created_at))) / 1000));
    const id = crypto.randomUUID(), timestamp = stamp();
    const encrypted = await encrypt(env, password, id);
    try {
      await env.DB.prepare(`INSERT INTO instagram_connection_requests(id,restaurant_id,restaurant_slug,publisher_id,instagram_username,instagram_user_id,encrypted_password,status,created_at,expires_at,updated_at,auto_bind,binding_snapshot)
        VALUES (?,?,?,?,?,?,?,'pending',?,?,?,?,?)`).bind(id, tenant.id, tenant.slug, publisherId, username, userId, encrypted, timestamp, new Date(Date.now() + 5 * 60000).toISOString(), timestamp, auto ? 1 : 0, snapshot(binding)).run();
    } catch { fail('instagram_connection_pending', 409); }
    return { connection: { id, status: 'pending' } };
  }
  await env.DB.prepare('UPDATE instagram_publishers SET last_seen_at = ? WHERE publisher_id = ?').bind(stamp(), agent.publisher_id).run();
  if (action === 'claimInstagramConnection') {
    const row = await env.DB.prepare("SELECT * FROM instagram_connection_requests WHERE publisher_id = ? AND status = 'pending' ORDER BY created_at LIMIT 1").bind(agent.publisher_id).first();
    if (!row) return { connection: null };
    const binding = await helpers.bindingFor(env, row.restaurant_id);
    if (row.auto_bind ? snapshot(binding) !== row.binding_snapshot : !same(binding, row)) {
      await env.DB.prepare("UPDATE instagram_connection_requests SET status='expired',encrypted_password=NULL WHERE id=?").bind(row.id).run();
      return { connection: null };
    }
    const claim = crypto.randomUUID() + crypto.randomUUID();
    // Claim and erase the encrypted password atomically. A lost reply never causes another login.
    const changed = await env.DB.prepare(`UPDATE instagram_connection_requests SET status='processing',encrypted_password=NULL,claim_hash=?,updated_at=?,expires_at=? WHERE id=? AND status='pending' AND expires_at > ?
      AND (auto_bind=1 OR EXISTS (SELECT 1 FROM instagram_account_bindings b WHERE b.restaurant_id=instagram_connection_requests.restaurant_id AND b.publisher_id=instagram_connection_requests.publisher_id AND b.instagram_username=instagram_connection_requests.instagram_username AND b.instagram_user_id=instagram_connection_requests.instagram_user_id)) RETURNING id`)
      .bind(await digest(claim), stamp(), new Date(Date.now() + 15 * 60000).toISOString(), row.id, stamp()).first();
    if (!changed) return { connection: null };
    const password = await decrypt(env, row.encrypted_password, row.id);
    return { connection: { id: row.id, restaurant_slug: row.restaurant_slug, instagram_username: row.instagram_username, instagram_user_id: row.instagram_user_id, password, claim_token: claim } };
  }
  if (action === 'completeInstagramConnection') {
    const row = await env.DB.prepare('SELECT * FROM instagram_connection_requests WHERE id=? AND publisher_id=?').bind(String(payload.id || ''), agent.publisher_id).first();
    if (!row || !row.claim_hash || await digest(String(payload.claim_token || '')) !== row.claim_hash || !['processing','completed','expired'].includes(row.status)) fail('connection_not_assigned', 409);
    if (!STATES.has(payload.state)) fail('invalid_session_state');
    const binding = await helpers.bindingFor(env, row.restaurant_id);
    const newer = await env.DB.prepare('SELECT id FROM instagram_connection_requests WHERE restaurant_id=? AND created_at > ? LIMIT 1').bind(row.restaurant_id, row.created_at).first();
    if (row.auto_bind) return completeAutomatic(env, row, binding, newer, payload);
    if (!same(binding, row) || newer || row.status === 'completed') return { completed: true };
    await env.DB.batch([
      env.DB.prepare("UPDATE instagram_connection_requests SET status='completed',result_state=?,updated_at=? WHERE id=? AND status IN ('processing','expired')").bind(payload.state, stamp(), row.id),
      statusStatement(env, { ...row, state: payload.state, verified_at: payload.state === 'connected' ? verifiedAt(payload.verified_at) : null })
    ]);
    return { completed: true };
  }
  if (!Array.isArray(payload.sessions) || payload.sessions.length > 100) fail('invalid_sessions');
  if (payload.version === '0.2.0') await env.DB.prepare('UPDATE instagram_publishers SET version=? WHERE publisher_id=?').bind(payload.version, agent.publisher_id).run();
  for (const session of payload.sessions) {
    if (!STATES.has(session.state)) fail('invalid_session_state');
    const binding = await env.DB.prepare('SELECT * FROM instagram_account_bindings WHERE restaurant_slug=? AND publisher_id=?').bind(String(session.restaurant_slug || ''), agent.publisher_id).first();
    if (!same(binding, { ...session, publisher_id: agent.publisher_id })) continue;
    await saveStatus(env, { ...binding, state: session.state, verified_at: verifiedAt(session.verified_at) });
  }
  return { reported: true };
}
async function completeAutomatic(env, row, binding, newer, payload) {
  if (row.status === 'completed') return { completed: true, accepted: row.result_state === 'connected', state: row.result_state };
  let state = payload.state;
  const userId = String(payload.instagram_user_id || '');
  if (newer || snapshot(binding) !== row.binding_snapshot) state = 'review_required';
  if (state === 'connected' && (!/^[1-9][0-9]{0,30}$/.test(userId) || (row.instagram_user_id && row.instagram_user_id !== userId))) state = 'identity_mismatch';
  if (state === 'connected') {
    // A concurrent binding/job must never be replaced by the result of an older login.
    const timestamp = stamp();
    await env.DB.batch([env.DB.prepare(`INSERT INTO instagram_account_bindings(restaurant_id,restaurant_slug,publisher_id,instagram_username,instagram_user_id,enabled,created_at,updated_at,connection_request_id)
      SELECT ?,?,?,?,?,1,?,?,? WHERE
      NOT EXISTS(SELECT 1 FROM instagram_story_jobs WHERE restaurant_id=? AND status IN ('pending','claimed','preparing','publishing','outcome_unknown'))
      AND NOT EXISTS(SELECT 1 FROM instagram_account_bindings WHERE instagram_user_id=? AND restaurant_id<>?)
      AND COALESCE((SELECT updated_at FROM instagram_account_bindings WHERE restaurant_id=?),'')=?
      AND EXISTS(SELECT 1 FROM instagram_connection_requests WHERE id=? AND status IN ('processing','expired'))
      ON CONFLICT(restaurant_id) DO UPDATE SET publisher_id=excluded.publisher_id,instagram_username=excluded.instagram_username,instagram_user_id=excluded.instagram_user_id,enabled=1,updated_at=excluded.updated_at,connection_request_id=excluded.connection_request_id`)
      .bind(row.restaurant_id,row.restaurant_slug,row.publisher_id,row.instagram_username,userId,timestamp,timestamp,row.id,row.restaurant_id,userId,row.restaurant_id,row.restaurant_id,binding?.updated_at || '',row.id),
      statusStatement(env, {...row,instagram_user_id:userId,state,verified_at:verifiedAt(payload.verified_at)}, row.id),
      env.DB.prepare(`UPDATE instagram_connection_requests SET status='completed',result_state=CASE WHEN EXISTS(SELECT 1 FROM instagram_account_bindings WHERE restaurant_id=? AND connection_request_id=?) THEN 'connected' ELSE 'review_required' END,updated_at=? WHERE id=? AND status IN ('processing','expired')`).bind(row.restaurant_id,row.id,timestamp,row.id)
    ]);
  } else {
    await env.DB.prepare("UPDATE instagram_connection_requests SET status='completed',result_state=?,updated_at=? WHERE id=? AND status IN ('processing','expired')").bind(state,stamp(),row.id).run();
  }
  state = (await env.DB.prepare('SELECT result_state FROM instagram_connection_requests WHERE id=?').bind(row.id).first()).result_state;
  return { completed: true, accepted: state === 'connected', state };
}
function verifiedAt(value) {
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) && parsed <= Date.now() + 60000 ? new Date(parsed).toISOString() : null;
}
async function saveStatus(env, value) {
  await statusStatement(env, value).run();
}
function statusStatement(env, value, connectionId = null) {
  return env.DB.prepare(`INSERT INTO instagram_session_status(restaurant_id,publisher_id,instagram_username,instagram_user_id,state,verified_at,reported_at) SELECT ?,?,?,?,?,?,? WHERE ? IS NULL OR EXISTS(SELECT 1 FROM instagram_account_bindings WHERE restaurant_id=? AND connection_request_id=?)
    ON CONFLICT(restaurant_id) DO UPDATE SET publisher_id=excluded.publisher_id,instagram_username=excluded.instagram_username,instagram_user_id=excluded.instagram_user_id,state=excluded.state,verified_at=excluded.verified_at,reported_at=excluded.reported_at`)
    .bind(value.restaurant_id, value.publisher_id, value.instagram_username, value.instagram_user_id, value.state, value.verified_at || null, stamp(),connectionId,value.restaurant_id,connectionId);
}
