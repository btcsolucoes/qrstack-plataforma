CREATE TABLE IF NOT EXISTS instagram_connection_requests (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  restaurant_slug TEXT NOT NULL,
  publisher_id TEXT NOT NULL REFERENCES instagram_publishers(publisher_id),
  instagram_username TEXT NOT NULL,
  instagram_user_id TEXT NOT NULL,
  encrypted_password TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending','processing','completed','expired')),
  claim_hash TEXT,
  result_state TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS instagram_connection_active ON instagram_connection_requests(restaurant_id) WHERE status IN ('pending','processing');
CREATE INDEX IF NOT EXISTS instagram_connection_publisher ON instagram_connection_requests(publisher_id,status,created_at);
CREATE TABLE IF NOT EXISTS instagram_session_status (
  restaurant_id TEXT PRIMARY KEY REFERENCES restaurants(id),
  publisher_id TEXT NOT NULL,
  instagram_username TEXT NOT NULL,
  instagram_user_id TEXT NOT NULL,
  state TEXT NOT NULL,
  verified_at TEXT,
  reported_at TEXT NOT NULL
);
