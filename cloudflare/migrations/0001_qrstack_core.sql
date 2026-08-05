-- QrStack D1 core schema.
-- D1 replaces Google Sheets for platform management and analytics.
-- Google Forms -> Sheets -> Apps Script can keep running only for menu automation.

CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  logo_url TEXT,
  symbol_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#0b3422',
  secondary_color TEXT NOT NULL DEFAULT '#bd8732',
  accent_color TEXT NOT NULL DEFAULT '#d2a14c',
  whatsapp_number TEXT,
  instagram_url TEXT,
  maps_url TEXT,
  address TEXT,
  github_repo TEXT,
  github_pages_url TEXT,
  assets_base_url TEXT,
  manifest_url TEXT,
  catalog_url TEXT,
  sections_url TEXT,
  live_menu_endpoint TEXT,
  analytics_endpoint TEXT,
  story_link TEXT,
  admin_token TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS catalog_items (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  section_title TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  price TEXT,
  image_url TEXT,
  source_repo TEXT,
  source_path TEXT,
  source_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS restaurant_assets (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  catalog_item_id TEXT REFERENCES catalog_items(id) ON DELETE SET NULL,
  asset_type TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  source_repo TEXT,
  source_path TEXT,
  source_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS menu_days (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  price TEXT,
  service_hours TEXT,
  story_link TEXT,
  notes TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  menu_day_id TEXT NOT NULL REFERENCES menu_days(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  price TEXT,
  image_url TEXT,
  is_highlight INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  restaurant_slug TEXT NOT NULL,
  menu_day_id TEXT,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'direct',
  source_detail TEXT,
  url TEXT,
  path TEXT,
  referrer TEXT,
  user_agent TEXT,
  language TEXT,
  session_id TEXT,
  visitor_id TEXT,
  dish_name TEXT,
  dish_key TEXT,
  dish_category TEXT,
  duration_ms INTEGER,
  observe_seconds INTEGER,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  screen TEXT,
  viewport TEXT,
  timezone_offset TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_catalog_restaurant_section ON catalog_items(restaurant_id, section_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_assets_restaurant_type ON restaurant_assets(restaurant_id, asset_type);
CREATE INDEX IF NOT EXISTS idx_menu_days_restaurant_date ON menu_days(restaurant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_menu_items_day_order ON menu_items(menu_day_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_events_restaurant_created ON analytics_events(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_slug_created ON analytics_events(restaurant_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_slug_type_created ON analytics_events(restaurant_slug, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_slug_source_created ON analytics_events(restaurant_slug, source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_slug_dish_created ON analytics_events(restaurant_slug, dish_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_slug_session ON analytics_events(restaurant_slug, session_id);

INSERT OR IGNORE INTO restaurants (
  id, slug, name, logo_url, primary_color, secondary_color, accent_color,
  whatsapp_number, instagram_url, maps_url, address, github_repo,
  github_pages_url, assets_base_url, manifest_url, catalog_url, sections_url,
  live_menu_endpoint, story_link, admin_token
) VALUES (
  'rest_amaro',
  'amaro',
  'Amaro Café',
  'https://btcsolucoes.github.io/carda-pio/assets/amaro/amaro-logo-transparent.png',
  '#0b3422',
  '#bd8732',
  '#d2a14c',
  '5581999999999',
  'https://instagram.com/amarocafe',
  'https://maps.google.com/?q=R.%20do%20Apolo%2C%20182%20-%20Recife%20Antigo%2C%20Recife%20-%20PE',
  'R. do Apolo, 182 - Recife Antigo, Recife - PE',
  'btcsolucoes/carda-pio',
  'https://btcsolucoes.github.io/carda-pio/',
  'https://btcsolucoes.github.io/carda-pio/',
  'https://btcsolucoes.github.io/carda-pio/qrstack/amaro-manifest.json',
  'https://btcsolucoes.github.io/carda-pio/qrstack/amaro-catalog.json',
  'https://btcsolucoes.github.io/carda-pio/qrstack/amaro-sections.json',
  'https://script.google.com/macros/s/AKfycbzm64OAl5G59pLyzl_bEPt64NwFohyhdBFTI_44Zu2UDF4gTpwaSuGcPAV-I3U57nHy/exec',
  'https://tinyurl.com/amaromenu',
  'qrstack-amaro-2026'
);
