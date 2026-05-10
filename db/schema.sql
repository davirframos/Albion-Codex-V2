PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS items (
  item_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  tier INTEGER NOT NULL,
  enchantment INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS market_orders (
  order_id INTEGER PRIMARY KEY,
  item_id TEXT NOT NULL,
  city TEXT NOT NULL,
  quality INTEGER NOT NULL,
  auction_type TEXT NOT NULL CHECK(auction_type IN ('offer', 'request')),
  unit_price INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  expires_at TEXT,
  observed_at TEXT NOT NULL,
  data_source TEXT NOT NULL DEFAULT 'unknown',
  ingested_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_market_orders_lookup
ON market_orders(item_id, city, quality, auction_type, unit_price);

CREATE INDEX IF NOT EXISTS idx_market_orders_stale
ON market_orders(expires_at, ingested_at);

CREATE TABLE IF NOT EXISTS market_histories (
  albion_id INTEGER NOT NULL,
  location TEXT NOT NULL,
  quality INTEGER NOT NULL,
  timescale INTEGER NOT NULL,
  item_amount INTEGER NOT NULL,
  silver_amount INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (albion_id, location, quality, timescale, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_market_histories_lookup
ON market_histories(albion_id, location, quality, timescale, timestamp);

CREATE TABLE IF NOT EXISTS opportunity_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('saved', 'executed')),
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  executed_at TEXT
);

CREATE TABLE IF NOT EXISTS hidden_offers (
  offer_key TEXT PRIMARY KEY,
  reason TEXT NOT NULL DEFAULT 'exhausted',
  hidden_until TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
