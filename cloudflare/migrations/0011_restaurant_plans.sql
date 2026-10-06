CREATE TABLE IF NOT EXISTS restaurant_plans (
  restaurant_id TEXT PRIMARY KEY REFERENCES restaurants(id) ON DELETE RESTRICT,
  plan TEXT NOT NULL CHECK(plan IN ('cardapio','divulgacao','performance')),
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS restaurant_plan_events (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  plan TEXT NOT NULL,
  created_at TEXT NOT NULL
);
