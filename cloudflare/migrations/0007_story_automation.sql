-- Durable Story publication queue for the private QrStack Android agent.
-- This migration is additive and never deletes or rewrites analytics data.

CREATE TABLE IF NOT EXISTS story_agents (
  device_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  app_version TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS story_publish_jobs (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  restaurant_slug TEXT NOT NULL,
  menu_day_id TEXT,
  story_link TEXT NOT NULL,
  media_key TEXT NOT NULL,
  media_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  checkpoint TEXT NOT NULL DEFAULT 'queued',
  assigned_device_id TEXT REFERENCES story_agents(device_id) ON DELETE SET NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  interruption_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  client_request_id TEXT,
  queued_at TEXT NOT NULL,
  claimed_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(restaurant_id, client_request_id)
);

CREATE TABLE IF NOT EXISTS story_job_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES story_publish_jobs(id) ON DELETE RESTRICT,
  device_id TEXT,
  event_type TEXT NOT NULL,
  checkpoint TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_story_jobs_status_queued
ON story_publish_jobs(status, queued_at);

CREATE INDEX IF NOT EXISTS idx_story_jobs_restaurant_created
ON story_publish_jobs(restaurant_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_story_jobs_device_status
ON story_publish_jobs(assigned_device_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_story_job_events_job_created
ON story_job_events(job_id, created_at DESC);
