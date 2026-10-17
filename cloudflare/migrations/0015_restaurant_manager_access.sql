-- The existing restaurant admin_token is now kitchen-only. Manager access is separate.
CREATE TABLE IF NOT EXISTS restaurant_manager_access (
  restaurant_id TEXT PRIMARY KEY REFERENCES restaurants(id),
  token_hash TEXT NOT NULL UNIQUE,
  updated_at TEXT NOT NULL
);
