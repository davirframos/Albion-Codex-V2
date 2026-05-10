import { getDefaultV2ItemIds } from "./itemCatalog.js";

const envList = (name, fallback) => {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(",").map((value) => value.trim()).filter(Boolean);
};

export const config = {
  port: Number(process.env.PORT || 3867),
  webOrigin: process.env.WEB_ORIGIN || "http://127.0.0.1:5174",
  albionServer: process.env.ALBION_SERVER || "west",
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || 30000),
  items: envList("ITEMS", getDefaultV2ItemIds()),
  salesTaxRate: Number(process.env.SALES_TAX_RATE || 0.08),
  minProfit: Number(process.env.MIN_PROFIT || 0),
  minMarginPct: Number(process.env.MIN_MARGIN_PCT || 0),
  maxAgeMinutes: Number(process.env.MAX_AGE_MINUTES || 120),
  minQuantity: Number(process.env.MIN_QUANTITY || 1),
  requireRealOrderQuantities: process.env.REQUIRE_REAL_ORDER_QUANTITIES !== "false",
  marketOrdersEnabled: process.env.MARKET_ORDERS_ENABLED !== "false",
  marketOrderStaleHours: Number(process.env.MARKET_ORDER_STALE_HOURS || 6)
};
