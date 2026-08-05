-- Speeds up the QrStack insights dashboard as analytics volume grows.

CREATE INDEX IF NOT EXISTS idx_events_slug_type_dish_name_created
ON analytics_events(restaurant_slug, event_type, dish_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_slug_type_category_created
ON analytics_events(restaurant_slug, event_type, dish_category, created_at DESC);

UPDATE restaurants
SET analytics_endpoint = 'https://qrstack-api.qrstack.workers.dev',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE slug = 'amaro';
