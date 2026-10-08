import { DurableObject } from 'cloudflare:workers';
import { OwnerCredentialStore } from './owner-credential-store.js';
export { default } from './worker.js';

export class OwnerCredentials extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.credentials = new OwnerCredentialStore(ctx.storage.sql, env.OWNER_ACCESS_TOKEN);
  }
  verify(password, client) { return this.credentials.verify(password, client); }
  change(currentPassword, newPassword, client) { return this.credentials.change(currentPassword, newPassword, client); }
  rateLimit(client, category) { return this.credentials.rateLimit(client, category); }
  login(password, client) { return this.credentials.login(password, client); }
  verifySession(token) { return this.credentials.verifySession(token); }
  logout(token) { return this.credentials.logout(token); }
  changeWithSession(session, current, next, client) { return this.credentials.changeWithSession(session, current, next, client); }
  issueReset(email, expectedEmail) { return this.credentials.issueReset(email, expectedEmail); }
  revokeReset(token) { return this.credentials.revokeReset(token); }
  reset(token, password, client) { return this.credentials.reset(token, password, client); }
}
