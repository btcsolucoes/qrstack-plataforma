import { recoveryMailConfigured, sendRecoveryMail } from './recovery-mail.js';
function service(env) {
  if (!env.OWNER_AUTH) throw Object.assign(new Error('owner_auth_unavailable'), { status: 503 });
  return env.OWNER_AUTH.getByName('qrstack-owner');
}
const clientId = request => request.headers.get('cf-connecting-ip') || 'unknown';
function assertBudget(result) {
  if (!result.ok) throw Object.assign(new Error(result.error || 'too_many_requests'), { status: result.status || 429, retryAfter: result.retry_after || 300 });
}
export async function enforceRateLimit(env, request, category) {
  assertBudget(await service(env).rateLimit(clientId(request), category));
}
export async function verifyOwner(env, request, supplied) {
  const session = request.headers.get('x-owner-session');
  if (session) {
    await enforceRateLimit(env, request, 'owner_read');
    return (await service(env).verifySession(session)).ok === true;
  }
  if (!supplied && request.headers.has('x-owner-key')) {
    try { supplied = decodeURIComponent(request.headers.get('x-owner-key')); } catch { return false; }
  }
  if (typeof supplied !== 'string' || !supplied) return false;
  const result = await service(env).verify(supplied, clientId(request));
  if (result.status === 429) assertBudget(result);
  return result.ok === true;
}
const ACTIONS = new Set(['loginOwner', 'logoutOwner', 'changeOwnerPassword', 'requestOwnerPasswordReset', 'resetOwnerPassword']);
export async function handleOwnerPassword(request, env, payload, action, ctx) {
  if (!ACTIONS.has(action)) return null;
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Retry-After', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
  const respond = (result, status = result.status || 200) => new Response(JSON.stringify({ ok: result.ok, ...(result.error ? { error: result.error } : {}), ...(result.session_token ? { session_token: result.session_token, expires_at: result.expires_at } : {}) }), { status, headers: { ...headers, ...(result.status === 429 ? { 'retry-after': String(result.retry_after || 300) } : {}) } });
  if (request.method !== 'POST') return respond({ ok: false, error: 'method_not_allowed' }, 405);
  const origin = request.headers.get('origin');
  if (origin && origin !== 'https://btcsolucoes.github.io' && !(new URL(request.url).hostname === '127.0.0.1' && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin))) return respond({ ok: false, error: 'origin_not_allowed' }, 403);
  try {
    const auth = service(env);
    const client = clientId(request);
    if (action === 'logoutOwner' || action === 'changeOwnerPassword') await enforceRateLimit(env, request, 'owner_read');
    if (action === 'loginOwner') return respond(await auth.login(payload.password, client));
    if (action === 'logoutOwner') return respond(await auth.logout(request.headers.get('x-owner-session')));
    if (action === 'changeOwnerPassword') {
      const session = request.headers.get('x-owner-session');
      const result = session ? await auth.changeWithSession(session, payload.current_password, payload.new_password, client) : await auth.change(payload.current_password, payload.new_password, client);
      if (result.ok && recoveryMailConfigured(env) && ctx?.waitUntil) ctx.waitUntil(sendRecoveryMail(env).catch(() => console.warn('owner_password_notification_failed')));
      return respond(result);
    }
    if (action === 'requestOwnerPasswordReset') {
      const budget = await auth.rateLimit(client, 'reset_request');
      if (!budget.ok) return respond(budget);
      if (!recoveryMailConfigured(env) || !ctx?.waitUntil) return respond({ ok: false, error: 'recovery_unavailable' }, 503);
      ctx.waitUntil((async () => {
        const reset = await auth.issueReset(typeof payload.email === 'string' ? payload.email.slice(0, 254) : '', env.OWNER_RECOVERY_EMAIL);
        if (!reset.token) return;
        try { await sendRecoveryMail(env, reset.token); }
        catch { await auth.revokeReset(reset.token); console.warn('owner_reset_delivery_failed'); }
      })().catch(() => console.warn('owner_reset_request_failed')));
      return respond({ ok: true }, 202);
    }
    const result = await auth.reset(payload.token, payload.new_password, client);
    if (result.ok && recoveryMailConfigured(env) && ctx?.waitUntil) ctx.waitUntil(sendRecoveryMail(env).catch(() => console.warn('owner_password_notification_failed')));
    return respond(result);
  } catch (error) {
    if (error.status === 429) return respond({ ok: false, error: 'too_many_requests', status: 429, retry_after: error.retryAfter });
    return respond({ ok: false, error: 'owner_auth_unavailable' }, 503);
  }
}
