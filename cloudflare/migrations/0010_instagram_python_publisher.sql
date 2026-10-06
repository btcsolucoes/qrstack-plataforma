-- The Python publisher owns a separate queue. No Android job is copied or resumed.
-- This prevents server authorization by retired Android agents; stop the installed
-- Android app separately because an offline device may retain its own active job.
UPDATE story_agents SET is_active = 0 WHERE is_active <> 0;

CREATE TABLE IF NOT EXISTS instagram_publishers (
  publisher_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  label TEXT NOT NULL,
  version TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS instagram_account_bindings (
  restaurant_id TEXT PRIMARY KEY REFERENCES restaurants(id) ON DELETE RESTRICT,
  restaurant_slug TEXT NOT NULL UNIQUE,
  publisher_id TEXT NOT NULL REFERENCES instagram_publishers(publisher_id) ON DELETE RESTRICT,
  instagram_username TEXT NOT NULL,
  instagram_user_id TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS instagram_story_jobs (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  restaurant_slug TEXT NOT NULL,
  publisher_id TEXT NOT NULL REFERENCES instagram_publishers(publisher_id) ON DELETE RESTRICT,
  instagram_username TEXT NOT NULL,
  instagram_user_id TEXT NOT NULL,
  menu_day_id TEXT,
  story_link TEXT NOT NULL,
  media_key TEXT NOT NULL,
  media_sha256 TEXT NOT NULL,
  content_type TEXT NOT NULL,
  media_bytes INTEGER NOT NULL,
  image_source TEXT,
  client_request_id TEXT NOT NULL,
  request_sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'claimed', 'preparing', 'publishing', 'completed', 'failed_attention', 'outcome_unknown', 'cancelled')),
  checkpoint TEXT NOT NULL DEFAULT 'queued',
  claim_token TEXT,
  media_id TEXT,
  error_code TEXT,
  queued_at TEXT NOT NULL,
  claimed_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(restaurant_id, client_request_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_instagram_single_active_publisher
ON instagram_story_jobs(publisher_id) WHERE status IN ('claimed', 'preparing', 'publishing');

CREATE INDEX IF NOT EXISTS idx_instagram_jobs_claim
ON instagram_story_jobs(publisher_id, status, queued_at);

CREATE INDEX IF NOT EXISTS idx_instagram_jobs_restaurant
ON instagram_story_jobs(restaurant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS instagram_story_job_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES instagram_story_jobs(id) ON DELETE RESTRICT,
  publisher_id TEXT,
  status TEXT NOT NULL,
  checkpoint TEXT NOT NULL,
  error_code TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_instagram_events_job
ON instagram_story_job_events(job_id, created_at);
