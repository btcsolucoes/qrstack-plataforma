-- Recovery page views are inserted through an atomic NOT EXISTS guard in the Worker.
-- Existing rows remain preserved; analytics ignores the auxiliary recovery row when
-- a confirmed page_view exists for the same session.
CREATE INDEX IF NOT EXISTS idx_analytics_page_view_session_guard
ON analytics_events(restaurant_slug, session_id, event_type, id);
