-- Compact analytics read model for the QrStack dashboard.
-- This migration is additive: raw analytics_events remain untouched.

CREATE TABLE IF NOT EXISTS analytics_daily_metrics (
  restaurant_slug TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  metric TEXT NOT NULL,
  dimension TEXT NOT NULL DEFAULT '',
  value REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (restaurant_slug, metric_date, metric, dimension)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS analytics_session_facts (
  restaurant_slug TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  session_id TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  PRIMARY KEY (restaurant_slug, metric_date, session_id)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS analytics_pageview_facts (
  restaurant_slug TEXT NOT NULL,
  event_id TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  session_id TEXT,
  visitor_id TEXT,
  source TEXT NOT NULL DEFAULT 'direct',
  source_detail TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  banner_shown INTEGER NOT NULL DEFAULT 0,
  banner_platform TEXT,
  PRIMARY KEY (restaurant_slug, event_id)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_rollup_pageviews_date_visitor
ON analytics_pageview_facts(restaurant_slug, metric_date, visitor_id, source, created_at, session_id);

CREATE TABLE IF NOT EXISTS analytics_rollup_dates (
  restaurant_slug TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  source_event_count INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT NOT NULL,
  PRIMARY KEY (restaurant_slug, metric_date)
) WITHOUT ROWID;
