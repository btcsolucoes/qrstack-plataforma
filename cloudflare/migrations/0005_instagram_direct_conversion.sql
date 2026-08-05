-- Speeds up source journey queries, especially Instagram -> direct conversion.

CREATE INDEX IF NOT EXISTS idx_events_slug_type_source_visitor_created
ON analytics_events(restaurant_slug, event_type, source, visitor_id, created_at);
