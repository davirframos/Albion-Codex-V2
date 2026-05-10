const serverHosts = {
  west: "https://west.albion-online-data.com",
  east: "https://east.albion-online-data.com",
  europe: "https://europe.albion-online-data.com"
};

const natsServers = {
  west: "nats://nats.albion-online-data.com:4222",
  east: "nats://nats.albion-online-data.com:24222",
  europe: "nats://nats.albion-online-data.com:34222"
};

const marketOrdersTopic = "marketorders.deduped";
const maxUrlLength = 4096;
const locations = ["Caerleon", "Black Market"];
const qualities = [1, 2, 3, 4, 5];

const locationNames = {
  "3003": "Caerleon",
  "3005": "Black Market",
  Caerleon: "Caerleon",
  "Black Market": "Black Market"
};

function toUtcIsoTimestamp(value) {
  if (!value) return new Date().toISOString();
  const text = String(value);
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  const date = new Date(hasZone ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeLocation(locationId) {
  const raw = String(locationId || "").replace(/^@/, "");
  const padded = raw.padStart(4, "0");
  return locationNames[raw] || locationNames[padded] || null;
}

function normalizeItemId(order) {
  const baseItemId = order.ItemTypeId;
  const enchantment = Number(order.EnchantmentLevel || 0);
  if (!baseItemId || baseItemId.includes("@") || enchantment <= 0) return baseItemId;
  return `${baseItemId}@${enchantment}`;
}

function getPayloadOrders(payload) {
  if (Array.isArray(payload?.Orders)) return payload.Orders;
  if (Array.isArray(payload)) return payload;
  if (payload?.Id) return [payload];
  return [];
}

function stableSyntheticOrderId(parts) {
  const text = parts.join("|");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return -Math.abs(hash || 1);
}

function makePriceUrl(host, itemBatch) {
  const itemPath = itemBatch.map(encodeURIComponent).join(",");
  const locationQuery = locations.map(encodeURIComponent).join(",");
  return `${host}/api/v2/stats/prices/${itemPath}.json?locations=${locationQuery}&qualities=${qualities.join(",")}`;
}

function buildPriceRequests({ server, items }) {
  const host = serverHosts[server] || serverHosts.west;
  const requests = [];
  let itemBatch = [];

  for (const item of items) {
    const nextBatch = [...itemBatch, item];
    const nextUrl = makePriceUrl(host, nextBatch);

    if (itemBatch.length > 0 && nextUrl.length > maxUrlLength) {
      requests.push(makePriceUrl(host, itemBatch));
      itemBatch = [item];
    } else {
      itemBatch = nextBatch;
    }
  }

  if (itemBatch.length > 0) requests.push(makePriceUrl(host, itemBatch));
  return requests;
}

export function normalizeMarketOrder(order, observedAt = new Date().toISOString()) {
  const city = normalizeLocation(order.LocationId);
  const itemId = normalizeItemId(order);
  const auctionType = String(order.AuctionType || "").toLowerCase();
  const orderId = Number(order.Id);
  const amount = Number(order.Amount || 0);
  const unitPrice = Number(order.UnitPriceSilver || 0);

  if (!city || !itemId || !Number.isFinite(orderId) || amount <= 0 || unitPrice <= 0) return null;
  if (auctionType !== "offer" && auctionType !== "request") return null;

  return {
    orderId,
    itemId,
    city,
    quality: Number(order.QualityLevel || 1),
    auctionType,
    unitPrice,
    amount,
    expiresAt: toUtcIsoTimestamp(order.Expires),
    observedAt,
    dataSource: order.dataSource || "public"
  };
}

export function normalizePriceRowsAsOrders(rows) {
  const orders = [];

  for (const row of rows || []) {
    const city = row.city;
    const itemId = row.item_id;
    const quality = Number(row.quality || 1);

    if (city === "Caerleon" && row.sell_price_min > 0) {
      orders.push({
        orderId: stableSyntheticOrderId([itemId, quality, city, "offer"]),
        itemId,
        city,
        quality,
        auctionType: "offer",
        unitPrice: Number(row.sell_price_min),
        amount: 1,
        expiresAt: null,
        observedAt: toUtcIsoTimestamp(row.sell_price_min_date),
        dataSource: "public"
      });
    }

    if (city === "Black Market" && row.buy_price_max > 0) {
      orders.push({
        orderId: stableSyntheticOrderId([itemId, quality, city, "request"]),
        itemId,
        city,
        quality,
        auctionType: "request",
        unitPrice: Number(row.buy_price_max),
        amount: 1,
        expiresAt: null,
        observedAt: toUtcIsoTimestamp(row.buy_price_max_date),
        dataSource: "public"
      });
    }
  }

  return orders;
}

export class AlbionDataPublicProvider {
  constructor({ config, repository, logger = console }) {
    this.config = config;
    this.repository = repository;
    this.logger = logger;
    this.status = {
      publicProvider: "idle",
      lastRefreshAt: null,
      lastOrdersReceivedAt: null,
      lastError: null
    };
    this.natsConnection = null;
  }

  getStatus() {
    return { ...this.status };
  }

  async refresh() {
    const requests = buildPriceRequests({
      server: this.config.albionServer,
      items: this.config.items
    });
    const rows = [];

    this.status.publicProvider = "refreshing";

    for (const url of requests) {
      const response = await fetch(url, { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`Albion Data returned ${response.status} ${response.statusText}`);
      rows.push(...await response.json());
    }

    const orders = normalizePriceRowsAsOrders(rows);
    this.repository.saveMarketOrders(orders, this.config.marketOrderStaleHours);
    this.status.publicProvider = "ready";
    this.status.lastRefreshAt = new Date().toISOString();
    this.status.lastError = null;
    return orders;
  }

  async startOrderStream(onOrders) {
    if (this.natsConnection) return this.natsConnection;

    const { connect, StringCodec } = await import("nats");
    const codec = StringCodec();
    const server = natsServers[this.config.albionServer] || natsServers.west;
    const connection = await connect({
      servers: server,
      user: "public",
      pass: "thenewalbiondata",
      reconnect: true,
      maxReconnectAttempts: -1
    });

    this.natsConnection = connection;
    this.status.publicProvider = "streaming";
    const subscription = connection.subscribe(marketOrdersTopic);

    (async () => {
      for await (const message of subscription) {
        try {
          const payload = JSON.parse(codec.decode(message.data));
          const observedAt = new Date().toISOString();
          const orders = getPayloadOrders(payload)
            .map((order) => normalizeMarketOrder(order, observedAt))
            .filter((order) => order && locations.includes(order.city));

          if (orders.length > 0) {
            this.repository.saveMarketOrders(orders, this.config.marketOrderStaleHours);
            this.status.lastOrdersReceivedAt = observedAt;
            this.status.lastError = null;
            onOrders?.(orders);
          }
        } catch (error) {
          this.status.lastError = error.message;
          this.logger.warn?.({ err: error }, "Failed to process V2 market order update");
        }
      }
    })().catch((error) => {
      this.status.publicProvider = "error";
      this.status.lastError = error.message;
      this.logger.error?.({ err: error }, "V2 market order stream stopped");
    });

    return connection;
  }

  async stop() {
    if (this.natsConnection) {
      await this.natsConnection.close();
      this.natsConnection = null;
    }
    this.status.publicProvider = "idle";
  }
}
