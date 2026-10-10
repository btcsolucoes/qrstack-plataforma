ALTER TABLE instagram_connection_requests ADD COLUMN auto_bind INTEGER NOT NULL DEFAULT 0;
ALTER TABLE instagram_connection_requests ADD COLUMN binding_snapshot TEXT;
ALTER TABLE instagram_account_bindings ADD COLUMN connection_request_id TEXT;
ALTER TABLE instagram_story_jobs ADD COLUMN scheduled_at TEXT;
ALTER TABLE instagram_story_jobs ADD COLUMN expires_at TEXT;
CREATE INDEX IF NOT EXISTS instagram_story_schedule ON instagram_story_jobs(publisher_id,status,scheduled_at);
