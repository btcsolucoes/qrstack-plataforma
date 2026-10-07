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
}
