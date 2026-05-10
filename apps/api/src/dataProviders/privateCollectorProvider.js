import { normalizeMarketOrder } from "./albionDataPublicProvider.js";

const allowedLocations = new Set(["Caerleon", "Black Market"]);
const locationNames = {
  "3003": "Caerleon",
  "3005": "Black Market",
  Caerleon: "Caerleon",
  "Black Market": "Black Market"
};

function normalizeLocation(locationId) {
  const raw = String(locationId || "").replace(/^@/, "");
  const padded = raw.padStart(4, "0");
  return locationNames[raw] || locationNames[padded] || null;
}

function getPayloadOrders(payload) {
  if (Array.isArray(payload?.Orders)) return payload.Orders;
  if (Array.isArray(payload)) return payload;
  if (payload?.Id) return [payload];
  return [];
}

function describeOrders(orders) {
  const buckets = new Map();
  for (const order of orders || []) {
    const key = [order.city, order.auctionType].join("|");
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return [...buckets.entries()]
    .map(([key, count]) => {
      const [city, auctionType] = key.split("|");
      return `${count} ${city} ${auctionType}`;
    })
    .join(", ");
}

function remapPrivateLocation(order) {
  if (!order) return null;
  if (order.city === "Caerleon") {
    return { ...order, city: "Black Market" };
  }
  if (order.city === "Black Market") {
    return { ...order, city: "Caerleon" };
  }
  return order;
}

function normalizePrivateUnitPrice(order) {
  if (!order) return null;
  return {
    ...order,
    unitPrice: Math.max(1, Math.round(Number(order.unitPrice) / 10000))
  };
}

function ticksToIsoTimestamp(value) {
  const ticks = Number(value);
  if (!Number.isFinite(ticks) || ticks <= 0) return null;
  const epochSeconds = (ticks - 621355968000000000) / 10000000;
  const date = new Date(epochSeconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeHistoryRows(payload, observedAt) {
  const albionId = Number(payload?.AlbionId);
  const location = normalizeLocation(payload?.LocationId);
  const quality = Number(payload?.QualityLevel || 1);
  const timescale = Number(payload?.Timescale);
  const histories = Array.isArray(payload?.MarketHistories) ? payload.MarketHistories : [];

  if (!Number.isFinite(albionId) || albionId <= 0) return [];
  if (!allowedLocations.has(location)) return [];
  if (!Number.isInteger(quality) || quality < 1 || quality > 5) return [];
  if (!Number.isInteger(timescale) || timescale < 0 || timescale > 2) return [];

  return histories.map((history) => {
    const itemAmount = Number(history?.ItemAmount || 0);
    const silverAmount = Number(history?.SilverAmount || 0);
    const timestamp = ticksToIsoTimestamp(history?.Timestamp);

    if (itemAmount <= 0 || silverAmount <= 0 || !timestamp) return null;
    return {
      albionId,
      location,
      quality,
      timescale,
      itemAmount,
      silverAmount,
      timestamp,
      observedAt
    };
  }).filter(Boolean);
}

export class PrivateCollectorProvider {
  constructor({ config = {}, repository = null, logger = console } = {}) {
    this.config = config;
    this.repository = repository;
    this.logger = logger;
    this.status = {
      privateProvider: "idle",
      lastPrivateOrderAt: null,
      lastPrivateHistoryAt: null,
      privateOrdersAccepted: 0,
      privateOrdersRejected: 0,
      privateHistoriesAccepted: 0,
      privateHistoriesRejected: 0,
      lastPrivateError: null
    };
  }

  getStatus() {
    return { ...this.status };
  }

  itemIsInScope(order) {
    if (!this.config.items?.length) return true;
    return this.config.items.includes(order.itemId);
  }

  ingestMarketOrders(payload) {
    const observedAt = new Date().toISOString();
    const rawOrders = getPayloadOrders(payload);
    const normalized = rawOrders
      .map((order) => normalizeMarketOrder(order, observedAt))
      .map(remapPrivateLocation)
      .map(normalizePrivateUnitPrice)
      .map((order) => order ? { ...order, dataSource: "private" } : null)
      .filter((order) => order && allowedLocations.has(order.city) && this.itemIsInScope(order));
    const rejected = rawOrders.length - normalized.length;

    if (normalized.length > 0) {
      this.repository?.saveMarketOrders?.(normalized, this.config.marketOrderStaleHours);
      this.status.privateProvider = "ready";
      this.status.lastPrivateOrderAt = observedAt;
      this.status.privateOrdersAccepted += normalized.length;
      this.status.lastPrivateError = null;
      this.logger.info?.(
        `Received ${normalized.length} live market sell orders from private ingest (${describeOrders(normalized)}). Rejected ${rejected}.`
      );
    } else {
      this.status.lastPrivateError = "No valid private market orders received.";
      this.logger.warn?.(`Private collector rejected ${rawOrders.length} market order rows.`);
    }

    this.status.privateOrdersRejected += rejected;
    return { accepted: normalized.length, rejected };
  }

  ingestMarketHistories(payload) {
    const observedAt = new Date().toISOString();
    const rawCount = Array.isArray(payload?.MarketHistories) ? payload.MarketHistories.length : 0;
    const histories = normalizeHistoryRows(payload, observedAt);
    const rejected = rawCount - histories.length;

    if (histories.length > 0) {
      this.repository?.saveMarketHistories?.(histories);
      this.status.privateProvider = "ready";
      this.status.lastPrivateHistoryAt = observedAt;
      this.status.privateHistoriesAccepted += histories.length;
      this.status.lastPrivateError = null;
      this.logger.info?.(
        `Private collector ingested ${histories.length} market history rows for ${histories[0].location}. Rejected ${rejected}.`
      );
    } else {
      this.status.lastPrivateError = "No valid private market histories received.";
      this.logger.warn?.(`Private collector rejected ${rawCount} market history rows.`);
    }

    this.status.privateHistoriesRejected += rejected;
    return { accepted: histories.length, rejected };
  }

  async refresh() {
    return [];
  }

  async start() {
    this.status.privateProvider = "ready";
    return this.getStatus();
  }

  async stop() {
    this.status.privateProvider = "idle";
    return this.getStatus();
  }
}
