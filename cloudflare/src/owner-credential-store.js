// One strongly consistent store for the QrStack owner account, independent of D1 quotas.
const ITERATIONS = 100000;
const encoder = new TextEncoder();
const hex = bytes => [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
async function digest(value) { return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
async function derive(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: ITERATIONS }, key, 256));
}
function equal(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
const failure = (error, status) => ({ ok: false, error, status });

export class OwnerCredentialStore {
  constructor(sql, bootstrapKey) {
    this.sql = sql;
    this.bootstrapKey = bootstrapKey;
    sql.exec('CREATE TABLE IF NOT EXISTS owner_credential (id INTEGER PRIMARY KEY CHECK(id = 1), revision INTEGER NOT NULL, salt TEXT, hash TEXT, updated_at TEXT)');
    sql.exec('INSERT OR IGNORE INTO owner_credential(id, revision) VALUES (1, 0)');
    sql.exec('CREATE TABLE IF NOT EXISTS owner_attempts (client TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL)');
  }
  record() { return this.sql.exec('SELECT * FROM owner_credential WHERE id = 1').toArray()[0]; }
  async verify(password, client = 'unknown') {
    if (typeof password !== 'string' || !password || password.length > 128) return failure('unauthorized', 401);
    const clientHash = await digest(String(client));
    const now = Date.now();
    this.sql.exec('DELETE FROM owner_attempts WHERE expires_at <= ?', now);
    const attempt = this.sql.exec('SELECT count FROM owner_attempts WHERE client = ?', clientHash).toArray()[0];
    if (attempt?.count >= 10) return failure('too_many_attempts', 429);
    // Reserve an attempt before async hashing, so simultaneous requests cannot bypass the limit.
    this.sql.exec('INSERT INTO owner_attempts(client, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(client) DO UPDATE SET count = count + 1', clientHash, now + 5 * 60 * 1000);
    const record = this.record();
    const valid = record.hash
      ? equal(await derive(password, record.salt), record.hash)
      : Boolean(this.bootstrapKey) && equal(await digest(password), await digest(this.bootstrapKey));
    if (!valid || record.revision !== this.record().revision) return failure('unauthorized', 401);
    this.sql.exec('DELETE FROM owner_attempts WHERE client = ?', clientHash);
    return { ok: true, revision: record.revision };
  }
  async change(currentPassword, newPassword, client) {
    const verified = await this.verify(currentPassword, client);
    if (!verified.ok) return verified;
    if (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 128 || newPassword !== newPassword.trim()) {
      return failure('invalid_new_password', 400);
    }
    if (currentPassword === newPassword) return failure('password_unchanged', 400);
    const salt = hex(crypto.getRandomValues(new Uint8Array(32)));
    const hash = await derive(newPassword, salt);
    // Compare-and-swap prevents two concurrent changes from both succeeding.
    const changed = this.sql.exec('UPDATE owner_credential SET revision = revision + 1, salt = ?, hash = ?, updated_at = ? WHERE id = 1 AND revision = ? RETURNING revision', salt, hash, new Date().toISOString(), verified.revision).toArray();
    return changed.length ? { ok: true } : failure('credential_changed', 409);
  }
}
