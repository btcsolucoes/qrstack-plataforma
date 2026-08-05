-- Stores Instagram in-app browser banner/redirect intervention metadata.

ALTER TABLE analytics_events ADD COLUMN banner_shown INTEGER NOT NULL DEFAULT 0;
ALTER TABLE analytics_events ADD COLUMN banner_platform TEXT;

CREATE INDEX IF NOT EXISTS idx_events_slug_banner_created
ON analytics_events(restaurant_slug, banner_shown, banner_platform, created_at DESC);
