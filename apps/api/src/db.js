import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDefaultV2Items } from "./itemCatalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../../..");
const dbDir = path.join(rootDir, "db");
const schemaPath = path.join(dbDir, "schema.sql");
const defaultDbPath = path.join(dbDir, "albion-codex-v2.sqlite");

export function createRepository(dbPath = defaultDbPath) {
  if (dbPath !== ":memory:") fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(fs.readFileSync(schemaPath, "utf8"));

  const columns = db.prepare("PRAGMA table_info(market_orders)").all().map((column) => column.name);
  if (!columns.includes("data_source")) {
    db.exec("ALTER TABLE market_orders ADD COLUMN data_source TEXT NOT NULL DEFAULT 'unknown'");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_key TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  const privatePriceScaleMigration = "2026-05-07-private-price-scale";
  const privatePriceScaleApplied = db.prepare(`
    SELECT 1 FROM schema_migrations WHERE migration_key = ?
  `).get(privatePriceScaleMigration);
  if (!privatePriceScaleApplied) {
    db.exec(`
      UPDATE market_orders
      SET unit_price = max(1, round(unit_price / 10000.0))
      WHERE data_source = 'private'
        AND unit_price >= 100000000
    `);
    db.prepare("INSERT INTO schema_migrations (migration_key) VALUES (?)").run(privatePriceScaleMigration);
  }
  const privateLocationMigration = "2026-05-07-private-location-correction";
  const privateLocationApplied = db.prepare(`
    SELECT 1 FROM schema_migrations WHERE migration_key = ?
  `).get(privateLocationMigration);
  if (!privateLocationApplied) {
    db.exec(`
      UPDATE market_orders
      SET
        city = CASE
          WHEN city = 'Caerleon' THEN 'Black Market'
          WHEN city = 'Black Market' THEN 'Caerleon'
          ELSE city
        END,
        auction_type = CASE
          WHEN city = 'Caerleon' AND auction_type = 'offer' THEN 'request'
          WHEN city = 'Black Market' AND auction_type = 'request' THEN 'offer'
          ELSE auction_type
        END
      WHERE data_source = 'private'
        AND (
          (city = 'Caerleon' AND auction_type = 'offer')
          OR (city = 'Black Market' AND auction_type = 'request')
        )
    `);
    db.prepare("INSERT INTO schema_migrations (migration_key) VALUES (?)").run(privateLocationMigration);
  }

  const upsertItem = db.prepare(`
    INSERT INTO items (item_id, display_name, category, tier, enchantment, updated_at)
    VALUES (@itemId, @displayName, @category, @tier, @enchantment, datetime('now'))
    ON CONFLICT(item_id) DO UPDATE SET
      display_name = excluded.display_name,
      category = excluded.category,
      tier = excluded.tier,
      enchantment = excluded.enchantment,
      updated_at = datetime('now')
  `);

  const upsertOrder = db.prepare(`
    INSERT INTO market_orders (
      order_id, item_id, city, quality, auction_type, unit_price, amount, expires_at, observed_at, data_source
    )
    VALUES (
      @orderId, @itemId, @city, @quality, @auctionType, @unitPrice, @amount, @expiresAt, @observedAt, @dataSource
    )
    ON CONFLICT(order_id) DO UPDATE SET
      item_id = excluded.item_id,
      city = excluded.city,
      quality = excluded.quality,
      auction_type = excluded.auction_type,
      unit_price = excluded.unit_price,
      amount = excluded.amount,
      expires_at = excluded.expires_at,
      observed_at = excluded.observed_at,
      data_source = excluded.data_source,
      ingested_at = datetime('now')
  `);

  const pruneOrders = db.prepare(`
    DELETE FROM market_orders
    WHERE (expires_at IS NOT NULL AND datetime(expires_at) <= datetime('now'))
      OR ingested_at <= datetime('now', @staleWindow)
  `);

  const insertSnapshot = db.prepare(`
    INSERT INTO opportunity_snapshots (offer_key, status, payload_json, executed_at)
    VALUES (@offerKey, @status, @payloadJson, @executedAt)
  `);

  const upsertMarketHistory = db.prepare(`
    INSERT INTO market_histories (
      albion_id, location, quality, timescale, item_amount, silver_amount, timestamp, observed_at
    )
    VALUES (
      @albionId, @location, @quality, @timescale, @itemAmount, @silverAmount, @timestamp, @observedAt
    )
    ON CONFLICT(albion_id, location, quality, timescale, timestamp) DO UPDATE SET
      item_amount = excluded.item_amount,
      silver_amount = excluded.silver_amount,
      observed_at = excluded.observed_at,
      ingested_at = datetime('now')
  `);

  const hideOffer = db.prepare(`
    INSERT INTO hidden_offers (offer_key, reason, hidden_until)
    VALUES (@offerKey, @reason, @hiddenUntil)
    ON CONFLICT(offer_key) DO UPDATE SET
      reason = excluded.reason,
      hidden_until = excluded.hidden_until
  `);

  const seedItems = () => {
    db.exec("BEGIN");
    try {
      for (const item of getDefaultV2Items()) {
        upsertItem.run({
          itemId: item.itemId,
          displayName: item.displayName,
          category: item.category,
          tier: item.tier,
          enchantment: item.enchantment
        });
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };

  const saveMarketOrders = (orders, staleHours = 6) => {
    if (!orders?.length) return 0;
    db.exec("BEGIN");
    try {
      for (const order of orders) {
        upsertOrder.run({
          orderId: order.orderId,
          itemId: order.itemId,
          city: order.city,
          quality: order.quality,
          auctionType: order.auctionType,
          unitPrice: order.unitPrice,
          amount: order.amount,
          expiresAt: order.expiresAt || null,
          observedAt: order.observedAt,
          dataSource: order.dataSource || "unknown"
        });
      }
      pruneOrders.run({ staleWindow: `-${staleHours} hours` });
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return orders.length;
  };

  const saveMarketHistories = (histories) => {
    if (!histories?.length) return 0;
    db.exec("BEGIN");
    try {
      for (const history of histories) {
        upsertMarketHistory.run({
          albionId: history.albionId,
          location: history.location,
          quality: history.quality,
          timescale: history.timescale,
          itemAmount: history.itemAmount,
          silverAmount: history.silverAmount,
          timestamp: history.timestamp,
          observedAt: history.observedAt
        });
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return histories.length;
  };

  const getMarketOrders = () => db.prepare(`
    SELECT
      order_id AS orderId,
      item_id AS itemId,
      city,
      quality,
      auction_type AS auctionType,
      unit_price AS unitPrice,
      amount,
      expires_at AS expiresAt,
      observed_at AS observedAt,
      data_source AS dataSource
    FROM market_orders
    WHERE amount > 0
      AND city IN ('Caerleon', 'Black Market')
      AND auction_type IN ('offer', 'request')
      AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
  `).all();

  const getHiddenOfferKeys = () => new Set(db.prepare(`
    SELECT offer_key
    FROM hidden_offers
    WHERE datetime(hidden_until) > datetime('now')
  `).all().map((row) => row.offer_key));

  const getMarketHistories = ({ albionId, location, quality, timescale } = {}) => {
    const clauses = [];
    const params = {};

    if (albionId != null) {
      clauses.push("albion_id = @albionId");
      params.albionId = albionId;
    }
    if (location != null) {
      clauses.push("location = @location");
      params.location = location;
    }
    if (quality != null) {
      clauses.push("quality = @quality");
      params.quality = quality;
    }
    if (timescale != null) {
      clauses.push("timescale = @timescale");
      params.timescale = timescale;
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return db.prepare(`
      SELECT
        albion_id AS albionId,
        location,
        quality,
        timescale,
        item_amount AS itemAmount,
        silver_amount AS silverAmount,
        timestamp,
        observed_at AS observedAt
      FROM market_histories
      ${where}
      ORDER BY datetime(timestamp) DESC
    `).all(params);
  };

  const saveOfferSnapshot = (offer, status = "saved") => {
    insertSnapshot.run({
      offerKey: offer.offerKey,
      status,
      payloadJson: JSON.stringify(offer),
      executedAt: status === "executed" ? new Date().toISOString() : null
    });
  };

  const hideOfferFor = ({ offerKey, reason = "exhausted", ttlMinutes = 30 }) => {
    hideOffer.run({
      offerKey,
      reason,
      hiddenUntil: new Date(Date.now() + ttlMinutes * 60000).toISOString()
    });
  };

  seedItems();

  return {
    db,
    seedItems,
    saveMarketOrders,
    saveMarketHistories,
    getMarketOrders,
    getMarketHistories,
    getHiddenOfferKeys,
    saveOfferSnapshot,
    hideOfferFor,
    close: () => db.close()
  };
}
