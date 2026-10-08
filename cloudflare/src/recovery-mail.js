const SITE = 'https://btcsolucoes.github.io/qrstack-plataforma/';
export function recoveryMailConfigured(env) {
  return Boolean(env.OWNER_RECOVERY_EMAIL && ((env.RECOVERY_EMAIL && env.RECOVERY_FROM_EMAIL) || (env.GMAIL_RELAY_URL && env.GMAIL_RELAY_SECRET)));
}
export async function sendRecoveryMail(env, token = null) {
  const link = token ? `${SITE}#/redefinir?token=${encodeURIComponent(token)}` : null;
  if (env.GMAIL_RELAY_URL && env.GMAIL_RELAY_SECRET) {
    // Optional Apps Script relay sends from the owner's Gmail without a custom domain.
    const endpoint = new URL(env.GMAIL_RELAY_URL);
    if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'script.google.com' || !/^\/macros\/s\/[^/]+\/exec$/.test(endpoint.pathname)) throw new Error('invalid_mail_relay');
    const payload = JSON.stringify({ kind: token ? 'password_reset' : 'password_changed', to: env.OWNER_RECOVERY_EMAIL, link, timestamp: Date.now(), nonce: crypto.randomUUID() });
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.GMAIL_RELAY_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))].map(value => value.toString(16).padStart(2, '0')).join('');
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ payload, signature }), signal: AbortSignal.timeout(15000) });
    if (!response.ok || !(await response.json()).ok) throw new Error('mail_delivery_failed');
    return;
  }
  if (!env.RECOVERY_EMAIL || !env.RECOVERY_FROM_EMAIL) throw new Error('mail_not_configured');
  const subject = token ? 'Redefinir sua senha da QrStack' : 'Sua senha da QrStack foi alterada';
  const text = token
    ? `Recebemos um pedido para redefinir sua senha da gestão QrStack. Use este link, válido por 15 minutos e apenas uma vez:\n${link}\nSe você não fez o pedido, ignore este e-mail. Sua senha continua igual.`
    : `Sua senha da gestão QrStack foi alterada. As sessões anteriores foram encerradas. Se não foi você, abra ${SITE}#/recuperar para recuperar seu acesso.`;
  await env.RECOVERY_EMAIL.send({ to: env.OWNER_RECOVERY_EMAIL, from: { email: env.RECOVERY_FROM_EMAIL, name: 'QrStack' }, subject, text,
    html: token ? `<p>Recebemos um pedido para redefinir sua senha da gestão QrStack.</p><p><a href="${link}">Redefinir senha</a></p><p>O link vale por 15 minutos e pode ser usado uma vez. Se não fez o pedido, ignore este e-mail.</p>` : `<p>Sua senha da gestão QrStack foi alterada e as sessões anteriores foram encerradas.</p><p>Se não foi você, <a href="${SITE}#/recuperar">recupere seu acesso</a>.</p>` });
}
