// Separate Google Apps Script project, owned and authorized by the Gmail account.
// Script Properties: QRSTACK_RELAY_SECRET (>=32 random chars), QRSTACK_RECOVERY_EMAIL.
// Deploy as a web app executing as its owner. No password or Gmail app password is used.
function doPost(event) {
  var lock = LockService.getScriptLock();
  try {
    var raw = event && event.postData && event.postData.contents;
    if (!raw || raw.length > 4096) return response_(false);
    var envelope = JSON.parse(raw);
    var properties = PropertiesService.getScriptProperties();
    var secret = properties.getProperty('QRSTACK_RELAY_SECRET') || '';
    var recipient = properties.getProperty('QRSTACK_RECOVERY_EMAIL') || '';
    if (secret.length < 32 || !recipient || typeof envelope.payload !== 'string' || !/^[a-f0-9]{64}$/.test(envelope.signature || '')) return response_(false);
    var bytes = Utilities.computeHmacSha256Signature(envelope.payload, secret, Utilities.Charset.UTF_8);
    var expected = bytes.map(function(value) { return ('0' + ((value + 256) % 256).toString(16)).slice(-2); }).join('');
    var diff = 0;
    for (var i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ envelope.signature.charCodeAt(i);
    if (diff) return response_(false);
    var payload = JSON.parse(envelope.payload);
    if (payload.to !== recipient || typeof payload.timestamp !== 'number' || Math.abs(Date.now() - payload.timestamp) > 120000 || !/^[a-f0-9-]{36}$/.test(payload.nonce || '')) return response_(false);
    if (['password_reset', 'password_changed'].indexOf(payload.kind) < 0) return response_(false);
    var reset = payload.kind === 'password_reset';
    if (reset && !/^https:\/\/btcsolucoes\.github\.io\/qrstack-plataforma\/#\/redefinir\?token=[a-f0-9]{64}$/.test(payload.link || '')) return response_(false);
    if (!lock.tryLock(5000)) return response_(false);
    var now = Date.now();
    var nonces = JSON.parse(properties.getProperty('QRSTACK_RELAY_NONCES') || '{}');
    Object.keys(nonces).forEach(function(nonce) { if (now - nonces[nonce] > 240000) delete nonces[nonce]; });
    if (Object.prototype.hasOwnProperty.call(nonces, payload.nonce) || Object.keys(nonces).length >= 100) return response_(false);
    // Reserve before the external send: an uncertain result never triggers a duplicate send.
    nonces[payload.nonce] = now;
    properties.setProperty('QRSTACK_RELAY_NONCES', JSON.stringify(nonces));
    var subject = reset ? 'Redefinir sua senha da QrStack' : 'Sua senha da QrStack foi alterada';
    var body = reset
      ? 'Recebemos um pedido para redefinir sua senha da gestão QrStack. O link abaixo vale por 15 minutos e pode ser usado uma vez:\n\n' + payload.link + '\n\nSe você não fez o pedido, ignore este e-mail. Sua senha continua igual.'
      : 'Sua senha da gestão QrStack foi alterada e as sessões anteriores foram encerradas. Se não foi você, recupere seu acesso em https://btcsolucoes.github.io/qrstack-plataforma/#/recuperar';
    MailApp.sendEmail({ to: recipient, subject: subject, body: body, name: 'QrStack' });
    return response_(true);
  } catch (_) {
    return response_(false);
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}
function response_(ok) { return ContentService.createTextOutput(JSON.stringify({ ok: ok })).setMimeType(ContentService.MimeType.JSON); }
// Run once in the Apps Script editor to grant Google's send-mail permission.
function authorizeQrStackRecovery() {
  MailApp.getRemainingDailyQuota();
  var properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('QRSTACK_RELAY_SECRET')) {
    properties.setProperty('QRSTACK_RELAY_SECRET', Utilities.getUuid() + Utilities.getUuid());
  }
  properties.setProperty('QRSTACK_RECOVERY_EMAIL', 'qrstack@gmail.com');
}
