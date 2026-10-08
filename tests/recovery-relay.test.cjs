const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHmac, randomUUID } = require('node:crypto');
const vm = require('node:vm');
const code = readFileSync(require('node:path').join(__dirname, '../apps-script-recovery/Code.gs'), 'utf8');
function fixture({ sendFails = false } = {}) {
  const secret = 'test-only-relay-key-0123456789abcdef';
  const properties = new Map([['QRSTACK_RELAY_SECRET', secret], ['QRSTACK_RECOVERY_EMAIL', 'qrstack@gmail.com']]);
  const sent = []; let locked = false;
  const context = vm.createContext({
    LockService: { getScriptLock: () => ({ tryLock: () => (locked = true), hasLock: () => locked, releaseLock: () => { locked = false; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties.get(key), setProperty: (key, value) => properties.set(key, value) }) },
    Utilities: { Charset: { UTF_8: 'utf8' }, computeHmacSha256Signature: (message, key) => [...createHmac('sha256', key).update(message).digest()], getUuid: randomUUID },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: value => ({ setMimeType: () => JSON.parse(value) }) },
    MailApp: { sendEmail: mail => { sent.push(mail); if (sendFails) throw new Error('uncertain send'); } },
  });
  vm.runInContext(code, context);
  function envelope(changes = {}) {
    const payload = JSON.stringify({ to: 'qrstack@gmail.com', timestamp: Date.now(), nonce: randomUUID(), kind: 'password_reset', link: 'https://btcsolucoes.github.io/qrstack-plataforma/#/redefinir?token=' + 'a'.repeat(64), ...changes });
    return { payload, signature: createHmac('sha256', secret).update(payload).digest('hex') };
  }
  return { sent, envelope, post: value => context.doPost({ postData: { contents: JSON.stringify(value) } }) };
}
test('signed reset sends only the fixed recipient and rejects replay', () => {
  const f = fixture(), e = f.envelope(); assert.equal(f.post(e).ok, true); assert.equal(f.post(e).ok, false);
  assert.equal(f.sent.length, 1); assert.equal(f.sent[0].to, 'qrstack@gmail.com'); assert.match(f.sent[0].body, /15 minutos/);
});
test('invalid signature cannot send mail', () => {
  const f = fixture(), e = f.envelope(); e.signature = '0'.repeat(64); assert.equal(f.post(e).ok, false); assert.equal(f.sent.length, 0);
});
test('signed requests cannot redirect mail or the recovery link', () => {
  const f = fixture();
  for (const change of [{ to: 'other@example.com' }, { link: 'https://example.com/' }, { kind: 'arbitrary_mail' }]) assert.equal(f.post(f.envelope(change)).ok, false);
  assert.equal(f.sent.length, 0);
});
test('expired, future and malformed requests are rejected', () => {
  const f = fixture();
  for (const change of [{ timestamp: Date.now() - 130000 }, { timestamp: Date.now() + 130000 }, { nonce: 'bad' }]) assert.equal(f.post(f.envelope(change)).ok, false);
  assert.equal(f.post({ payload: 'x'.repeat(4097) }).ok, false); assert.equal(f.sent.length, 0);
});
test('uncertain delivery consumes the nonce and is never sent twice', () => {
  const f = fixture({ sendFails: true }), e = f.envelope();
  assert.equal(f.post(e).ok, false); assert.equal(f.post(e).ok, false); assert.equal(f.sent.length, 1);
});
test('password-change notification contains no recovery token', () => {
  const f = fixture(); assert.equal(f.post(f.envelope({ kind: 'password_changed' })).ok, true);
  assert.doesNotMatch(f.sent[0].body, /token=/); assert.match(f.sent[0].body, /sessões anteriores/);
});
