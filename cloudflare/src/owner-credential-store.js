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
const SESSION_MS = 4 * 60 * 60 * 1000;
const RESET_MS = 15 * 60 * 1000;
const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const passwordAllowed = password => typeof password === 'string' && password.length >= 8 && password.length <= 128 && password === password.trim();
const RATE_POLICIES = {
  login: [10, 300], legacy_auth: [120, 60], password_change: [5, 900],
  reset_request: [3, 900], reset_submit: [10, 900], reset_delivery: [3, 3600],
  tenant_write: [30, 60], tenant_read: [120, 60], public_write: [60, 60], owner_read: [180, 60],
};

export class OwnerCredentialStore {
  constructor(sql, bootstrapKey) {
    this.sql = sql;
    this.bootstrapKey = bootstrapKey;
    sql.exec('CREATE TABLE IF NOT EXISTS owner_credential (id INTEGER PRIMARY KEY CHECK(id = 1), revision INTEGER NOT NULL, salt TEXT, hash TEXT, updated_at TEXT)');
    sql.exec('INSERT OR IGNORE INTO owner_credential(id, revision) VALUES (1, 0)');
    sql.exec('CREATE TABLE IF NOT EXISTS owner_attempts (client TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL)');
    sql.exec('CREATE TABLE IF NOT EXISTS security_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL)');
    sql.exec('CREATE INDEX IF NOT EXISTS security_limits_expiry ON security_limits(expires_at)');
    sql.exec('CREATE TABLE IF NOT EXISTS owner_sessions (hash TEXT PRIMARY KEY, revision INTEGER NOT NULL, expires_at INTEGER NOT NULL)');
    sql.exec('CREATE TABLE IF NOT EXISTS owner_resets (hash TEXT PRIMARY KEY, revision INTEGER NOT NULL, expires_at INTEGER NOT NULL)');
    sql.exec('CREATE TABLE IF NOT EXISTS owner_security_events (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, created_at INTEGER NOT NULL)');
  }
  record() { return this.sql.exec('SELECT * FROM owner_credential WHERE id = 1').toArray()[0]; }
  event(kind) {
    this.sql.exec('INSERT INTO owner_security_events(kind, created_at) VALUES (?, ?)', kind, Date.now());
    this.sql.exec('DELETE FROM owner_security_events WHERE id <= (SELECT COALESCE(MAX(id), 0) - 100 FROM owner_security_events)');
  }
  async rateLimit(client, category) {
    const policy = RATE_POLICIES[category];
    if (!policy) return failure('invalid_rate_category', 400);
    const [limit, seconds] = policy;
    const key = await digest(category + ':' + String(client));
    const now = Date.now();
    this.sql.exec('DELETE FROM security_limits WHERE expires_at <= ?', now);
    const row = this.sql.exec('SELECT count, expires_at FROM security_limits WHERE key = ?', key).toArray()[0];
    if (row?.count >= limit) return { ...failure('too_many_requests', 429), retry_after: Math.max(1, Math.ceil((row.expires_at - now) / 1000)) };
    this.sql.exec('INSERT INTO security_limits(key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1', key, now + seconds * 1000);
    return { ok: true };
  }
  async verify(password, client = 'unknown') {
    const budget = await this.rateLimit(client, 'legacy_auth');
    if (!budget.ok) return budget;
    if (typeof password !== 'string' || !password || password.length > 128) return failure('unauthorized', 401);
    const clientHash = await digest(String(client));
    const now = Date.now();
    this.sql.exec('DELETE FROM owner_attempts WHERE expires_at <= ?', now);
    const attempt = this.sql.exec('SELECT count FROM owner_attempts WHERE client = ?', clientHash).toArray()[0];
    if (attempt?.count >= 10) return { ...failure('too_many_attempts', 429), retry_after: 300 };
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
    const budget = await this.rateLimit(client, 'password_change');
    if (!budget.ok) return budget;
    const verified = await this.verify(currentPassword, client);
    if (!verified.ok) return verified;
    if (!passwordAllowed(newPassword)) {
      return failure('invalid_new_password', 400);
    }
    if (currentPassword === newPassword) return failure('password_unchanged', 400);
    const salt = hex(crypto.getRandomValues(new Uint8Array(32)));
    const hash = await derive(newPassword, salt);
    // Compare-and-swap prevents two concurrent changes from both succeeding.
    const changed = this.sql.exec('UPDATE owner_credential SET revision = revision + 1, salt = ?, hash = ?, updated_at = ? WHERE id = 1 AND revision = ? RETURNING revision', salt, hash, new Date().toISOString(), verified.revision).toArray();
    if (!changed.length) return failure('credential_changed', 409);
    this.sql.exec('DELETE FROM owner_sessions');
    this.sql.exec('DELETE FROM owner_resets');
    this.event('password_changed');
    return { ok: true, revision: changed[0].revision };
  }
  async createSession(revision) {
    const token = randomToken();
    const hash = await digest(token);
    if (this.record().revision !== revision) return failure('credential_changed', 409);
    const expires = Date.now() + SESSION_MS;
    this.sql.exec('DELETE FROM owner_sessions WHERE expires_at <= ? OR revision != ?', Date.now(), revision);
    this.sql.exec('INSERT INTO owner_sessions(hash, revision, expires_at) VALUES (?, ?, ?)', hash, revision, expires);
    // Bound the number of active sessions without storing raw tokens.
    this.sql.exec('DELETE FROM owner_sessions WHERE hash NOT IN (SELECT hash FROM owner_sessions ORDER BY expires_at DESC LIMIT 10)');
    return { ok: true, session_token: token, expires_at: new Date(expires).toISOString() };
  }
  async login(password, client) {
    const budget = await this.rateLimit(client, 'login');
    if (!budget.ok) return budget;
    const checked = await this.verify(password, client);
    if (!checked.ok) return checked;
    return this.createSession(checked.revision);
  }
  async verifySession(token) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return failure('unauthorized', 401);
    const hash = await digest(token);
    const row = this.sql.exec('SELECT revision, expires_at FROM owner_sessions WHERE hash = ?', hash).toArray()[0];
    return row && row.expires_at > Date.now() && row.revision === this.record().revision ? { ok: true } : failure('unauthorized', 401);
  }
  async logout(token) {
    if (typeof token === 'string' && token.length <= 128) this.sql.exec('DELETE FROM owner_sessions WHERE hash = ?', await digest(token));
    return { ok: true };
  }
  async changeWithSession(session, current, next, client) {
    if (!(await this.verifySession(session)).ok) return failure('unauthorized', 401);
    const result = await this.change(current, next, client);
    if (!result.ok) return result;
    return this.createSession(result.revision);
  }
  async issueReset(email, expectedEmail) {
    // The HTTP request budget is checked before this asynchronous delivery phase.
    const candidate = await digest(String(email || '').trim().toLowerCase());
    const expected = await digest(String(expectedEmail || '').trim().toLowerCase());
    if (!expectedEmail || !equal(candidate, expected)) return { ok: true };
    const budget = await this.rateLimit('owner-account', 'reset_delivery');
    if (!budget.ok) return { ok: true };
    const token = randomToken();
    const hash = await digest(token);
    const revision = this.record().revision;
    this.sql.exec('DELETE FROM owner_resets WHERE expires_at <= ? OR revision != ?', Date.now(), revision);
    this.sql.exec('INSERT INTO owner_resets(hash, revision, expires_at) VALUES (?, ?, ?)', hash, revision, Date.now() + RESET_MS);
    this.event('reset_requested');
    return { ok: true, token };
  }
  async revokeReset(token) {
    this.sql.exec('DELETE FROM owner_resets WHERE hash = ?', await digest(token));
  }
  async reset(token, newPassword, client) {
    const budget = await this.rateLimit(client, 'reset_submit');
    if (!budget.ok) return budget;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return failure('invalid_reset_link', 400);
    const hash = await digest(token);
    const row = this.sql.exec('SELECT revision, expires_at FROM owner_resets WHERE hash = ?', hash).toArray()[0];
    if (!row || row.expires_at <= Date.now() || row.revision !== this.record().revision) return failure('invalid_reset_link', 400);
    if (!passwordAllowed(newPassword)) return failure('invalid_new_password', 400);
    const salt = randomToken();
    const passwordHash = await derive(newPassword, salt);
    // Credential update checks both the live token and revision in a single SQL statement.
    const changed = this.sql.exec('UPDATE owner_credential SET revision = revision + 1, salt = ?, hash = ?, updated_at = ? WHERE id = 1 AND revision = ? AND EXISTS (SELECT 1 FROM owner_resets WHERE hash = ? AND expires_at > ?) RETURNING revision', salt, passwordHash, new Date().toISOString(), row.revision, hash, Date.now()).toArray();
    if (!changed.length) return failure('invalid_reset_link', 400);
    this.sql.exec('DELETE FROM owner_sessions');
    this.sql.exec('DELETE FROM owner_resets');
    this.sql.exec('DELETE FROM owner_attempts');
    this.event('password_reset');
    return { ok: true };
  }
}
