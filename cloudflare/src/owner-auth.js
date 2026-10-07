function service(env) {
  if (!env.OWNER_AUTH) throw Object.assign(new Error('owner_auth_unavailable'), { status: 503 });
  return env.OWNER_AUTH.getByName('qrstack-owner');
}
const clientId = request => request.headers.get('cf-connecting-ip') || 'unknown';
export async function verifyOwner(env, request, supplied) {
  if (!supplied && request.headers.has('x-owner-key')) {
    try { supplied = decodeURIComponent(request.headers.get('x-owner-key')); } catch { return false; }
  }
  if (typeof supplied !== 'string' || !supplied) return false;
  const result = await service(env).verify(supplied, clientId(request));
  if (result.status === 429) throw Object.assign(new Error(result.error), { status: 429 });
  return result.ok === true;
}
export async function handleOwnerPassword(request, env, payload, action) {
  if (action !== 'changeOwnerPassword') return null;
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' };
  if (request.method !== 'POST') return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { status: 405, headers });
  try {
    const result = await service(env).change(payload.current_password, payload.new_password, clientId(request));
    return new Response(JSON.stringify({ ok: result.ok, ...(result.error ? { error: result.error } : {}) }), { status: result.status || 200, headers });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'owner_auth_unavailable' }), { status: 503, headers });
  }
}
