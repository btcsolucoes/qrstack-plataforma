-- The dashboard reads analytics_daily_metrics and analytics_pageview_facts.
-- Keep only the raw-event indexes required by rollup repair and session recovery.
-- Dropping indexes never removes analytics event rows.

DROP INDEX IF EXISTS idx_events_restaurant_created;
DROP INDEX IF EXISTS idx_events_slug_type_created;
DROP INDEX IF EXISTS idx_events_slug_source_created;
DROP INDEX IF EXISTS idx_events_slug_dish_created;
DROP INDEX IF EXISTS idx_events_slug_type_dish_name_created;
DROP INDEX IF EXISTS idx_events_slug_type_category_created;
