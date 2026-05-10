import assert from "node:assert/strict";
import test from "node:test";
import { createRepository } from "./db.js";
import { createApp } from "./server.js";
import { PrivateCollectorProvider } from "./dataProviders/privateCollectorProvider.js";

const testConfig = {
  webOrigin: "http://127.0.0.1:5174",
  salesTaxRate: 0.08,
  minProfit: 0,
  minMarginPct: 0,
  maxAgeMinutes: 120,
  minQuantity: 1,
  marketOrderStaleHours: 6
};
const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

test("GET /api/opportunities returns a stable empty shape", async () => {
  const repository = createRepository(":memory:");
  const app = createApp({ repository, provider: null, config: testConfig });

  const response = await app.inject({ method: "GET", url: "/api/opportunities" });
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(payload.type, "opportunities");
  assert.deepEqual(payload.opportunities, []);
  assert.equal(typeof payload.generatedAt, "string");
  assert.equal(payload.dataSourceStatus.publicProvider, "idle");

  await app.close();
  repository.close();
});

test("GET /health exposes relaxed default opportunity filters", async () => {
  const repository = createRepository(":memory:");
  const app = createApp({ repository, provider: null, config: testConfig });

  const response = await app.inject({ method: "GET", url: "/health" });
  const payload = JSON.parse(response.body);

  assert.equal(payload.config.minProfit, 0);
  assert.equal(payload.config.minMarginPct, 0);
  assert.equal(payload.config.maxAgeMinutes, 120);

  await app.close();
  repository.close();
});

test("POST /api/offers/hide removes an active offer from output", async () => {
  const repository = createRepository(":memory:");
  repository.saveMarketOrders([
    {
      orderId: 1,
      itemId: "T8_MAIN_SWORD@4",
      city: "Caerleon",
      quality: 1,
      auctionType: "offer",
      unitPrice: 100000,
      amount: 2,
      observedAt: new Date().toISOString()
    },
    {
      orderId: 2,
      itemId: "T8_MAIN_SWORD@4",
      city: "Black Market",
      quality: 1,
      auctionType: "request",
      unitPrice: 130000,
      amount: 2,
      observedAt: new Date().toISOString()
    }
  ], 6);

  const app = createApp({ repository, provider: null, config: testConfig });
  const before = await app.inject({ method: "GET", url: "/api/opportunities" });
  const offer = JSON.parse(before.body).opportunities[0];

  const hidden = await app.inject({
    method: "POST",
    url: "/api/offers/hide",
    payload: { offerKey: offer.offerKey, ttlMinutes: 30 }
  });

  assert.equal(hidden.statusCode, 200);
  assert.equal(JSON.parse(hidden.body).snapshot.opportunities.length, 0);

  await app.close();
  repository.close();
});

test("POST /api/offers action endpoints return a fresh snapshot without the acted offer", async () => {
  const actionCases = [
    { endpoint: "/api/offers/save", status: "saved" },
    { endpoint: "/api/offers/hide", status: null },
    { endpoint: "/api/offers/execute", status: "executed" }
  ];

  for (const actionCase of actionCases) {
    const repository = createRepository(":memory:");
    repository.saveMarketOrders([
      {
        orderId: 1,
        itemId: "T8_MAIN_SWORD@4",
        city: "Caerleon",
        quality: 1,
        auctionType: "offer",
        unitPrice: 100000,
        amount: 2,
        observedAt: new Date().toISOString()
      },
      {
        orderId: 2,
        itemId: "T8_MAIN_SWORD@4",
        city: "Black Market",
        quality: 1,
        auctionType: "request",
        unitPrice: 130000,
        amount: 2,
        observedAt: new Date().toISOString()
      }
    ], 6);

    const app = createApp({ repository, provider: null, config: testConfig });
    const before = await app.inject({ method: "GET", url: "/api/opportunities" });
    const offer = JSON.parse(before.body).opportunities[0];

    const response = await app.inject({
      method: "POST",
      url: actionCase.endpoint,
      payload: { ...offer, ttlMinutes: 30 }
    });
    const payload = JSON.parse(response.body);

    assert.equal(response.statusCode, actionCase.endpoint === "/api/offers/save" || actionCase.endpoint === "/api/offers/execute" ? 201 : 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.snapshot.type, "opportunities");
    assert.equal(payload.snapshot.opportunities.some((item) => item.offerKey === offer.offerKey), false);

    await app.close();
    repository.close();
  }
});

test("GET /api/opportunities includes estimated opportunities but reports real quantity stats", async () => {
  const repository = createRepository(":memory:");
  repository.saveMarketOrders([
    {
      orderId: -1,
      itemId: "T8_MAIN_SWORD@4",
      city: "Caerleon",
      quality: 1,
      auctionType: "offer",
      unitPrice: 100000,
      amount: 1,
      observedAt: new Date().toISOString()
    },
    {
      orderId: -2,
      itemId: "T8_MAIN_SWORD@4",
      city: "Black Market",
      quality: 1,
      auctionType: "request",
      unitPrice: 130000,
      amount: 1,
      observedAt: new Date().toISOString()
    }
  ], 6);

  const app = createApp({ repository, provider: null, config: { ...testConfig, requireRealOrderQuantities: true } });
  const response = await app.inject({ method: "GET", url: "/api/opportunities" });
  const payload = JSON.parse(response.body);

  assert.equal(payload.opportunities.length, 1);
  assert.equal(payload.opportunities[0].hasOrderQuantities, false);
  assert.deepEqual(payload.opportunityStats, {
    total: 1,
    realQuantity: 0,
    estimated: 1
  });

  await app.close();
  repository.close();
});

test("GET /api/opportunities includes market order diagnostics by useful side", async () => {
  const repository = createRepository(":memory:");
  repository.saveMarketOrders([
    {
      orderId: 1,
      itemId: "T8_MAIN_SWORD@4",
      city: "Caerleon",
      quality: 1,
      auctionType: "offer",
      unitPrice: 100000,
      amount: 2,
      observedAt: new Date().toISOString(),
      dataSource: "private"
    },
    {
      orderId: 2,
      itemId: "T8_MAIN_SWORD@4",
      city: "Black Market",
      quality: 1,
      auctionType: "request",
      unitPrice: 130000,
      amount: 2,
      observedAt: new Date().toISOString(),
      dataSource: "public"
    },
    {
      orderId: 3,
      itemId: "T8_MAIN_SWORD@4",
      city: "Caerleon",
      quality: 1,
      auctionType: "request",
      unitPrice: 90000,
      amount: 1,
      observedAt: new Date().toISOString(),
      dataSource: "private"
    }
  ], 6);

  const app = createApp({ repository, provider: null, config: testConfig });
  const response = await app.inject({ method: "GET", url: "/api/opportunities" });
  const payload = JSON.parse(response.body);

  assert.equal(payload.marketDiagnostics.totalOrders, 3);
  assert.equal(payload.marketDiagnostics.usefulOrders, 2);
  assert.equal(payload.marketDiagnostics.unusedOrders, 1);
  assert.equal(payload.marketDiagnostics.pairableItemQualities, 1);
  assert.deepEqual(payload.marketDiagnostics.byBucket, [
    { city: "Black Market", auctionType: "request", dataSource: "public", count: 1, usefulForStrategy: true },
    { city: "Caerleon", auctionType: "offer", dataSource: "private", count: 1, usefulForStrategy: true },
    { city: "Caerleon", auctionType: "request", dataSource: "private", count: 1, usefulForStrategy: false }
  ]);

  await app.close();
  repository.close();
});

test("POST /api/private/market-orders ingests valid private orders and rejects invalid rows", async () => {
  const repository = createRepository(":memory:");
  const logs = [];
  const privateProvider = new PrivateCollectorProvider({
    config: testConfig,
    repository,
    logger: { info: (message) => logs.push(message), warn: (message) => logs.push(message) }
  });
  const app = createApp({ repository, provider: null, privateProvider, config: testConfig });

  const response = await app.inject({
    method: "POST",
    url: "/api/private/market-orders",
    payload: {
      Orders: [
        {
          Id: 101,
          ItemTypeId: "T8_MAIN_SWORD",
          LocationId: "3005",
          QualityLevel: 2,
          EnchantmentLevel: 4,
          UnitPriceSilver: 1000000000,
          Amount: 3,
          AuctionType: "offer",
          Expires: futureExpiry
        },
        {
          Id: 202,
          ItemTypeId: "T8_MAIN_SWORD",
          LocationId: "3003",
          QualityLevel: 2,
          EnchantmentLevel: 4,
          UnitPriceSilver: 1320000000,
          Amount: 2,
          AuctionType: "request",
          Expires: futureExpiry
        },
        {
          Id: 303,
          ItemTypeId: "T8_MAIN_SWORD",
          LocationId: "9999",
          QualityLevel: 2,
          EnchantmentLevel: 4,
          UnitPriceSilver: 1,
          Amount: 1,
          AuctionType: "offer"
        },
        {
          Id: 404,
          ItemTypeId: "T8_MAIN_SWORD",
          LocationId: "3003",
          QualityLevel: 2,
          EnchantmentLevel: 4,
          UnitPriceSilver: 0,
          Amount: 1,
          AuctionType: "offer"
        }
      ]
    }
  });

  const payload = JSON.parse(response.body);
  const orders = repository.getMarketOrders();

  assert.equal(response.statusCode, 202);
  assert.equal(payload.ok, true);
  assert.equal(payload.accepted, 2);
  assert.equal(payload.rejected, 2);
  assert.equal(orders.length, 2);
  assert.equal(orders[0].itemId, "T8_MAIN_SWORD@4");
  assert.equal(orders[0].dataSource, "private");
  assert.equal(orders.find((order) => order.city === "Caerleon").unitPrice, 100000);
  assert.equal(orders.find((order) => order.city === "Black Market").unitPrice, 132000);
  assert.equal(orders.find((order) => order.city === "Caerleon").auctionType, "offer");
  assert.equal(orders.find((order) => order.city === "Black Market").auctionType, "request");

  const opportunities = await app.inject({ method: "GET", url: "/api/opportunities" });
  const opportunity = JSON.parse(opportunities.body).opportunities[0];
  assert.equal(opportunity.hasOrderQuantities, true);
  assert.equal(opportunity.quantity, 2);
  assert.deepEqual(opportunity.dataSources, ["private"]);
  assert.deepEqual(logs, [
    "Received 2 live market sell orders from private ingest (1 Caerleon offer, 1 Black Market request). Rejected 2."
  ]);

  await app.close();
  repository.close();
});

test("POST /api/private/market-orders rejects empty payloads", async () => {
  const repository = createRepository(":memory:");
  const app = createApp({ repository, provider: null, config: testConfig });

  const response = await app.inject({
    method: "POST",
    url: "/api/private/market-orders",
    payload: { Orders: [] }
  });
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(payload.ok, false);
  assert.match(payload.message, /No valid private market orders/i);

  await app.close();
  repository.close();
});

test("POST /api/private/marketorders.ingest accepts official client market order topic", async () => {
  const repository = createRepository(":memory:");
  const app = createApp({ repository, provider: null, config: testConfig });

  const response = await app.inject({
    method: "POST",
    url: "/api/private/marketorders.ingest",
    payload: {
      Orders: [{
        Id: 707,
        ItemTypeId: "T8_MAIN_SWORD",
        LocationId: "3003",
        QualityLevel: 1,
        EnchantmentLevel: 4,
        UnitPriceSilver: 100000,
        Amount: 1,
        AuctionType: "offer",
        Expires: futureExpiry
      }]
    }
  });

  assert.equal(response.statusCode, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.accepted, 1);
  assert.equal(payload.snapshot, undefined);
  assert.equal(payload.status.privateProvider, "ready");
  assert.equal(repository.getMarketOrders().length, 1);

  await app.close();
  repository.close();
});

test("POST /api/private/markethistories.ingest accepts official client market history topic", async () => {
  const repository = createRepository(":memory:");
  const app = createApp({ repository, provider: null, config: testConfig });

  const response = await app.inject({
    method: "POST",
    url: "/api/private/markethistories.ingest",
    payload: {
      AlbionId: 1234,
      LocationId: "3005",
      QualityLevel: 1,
      Timescale: 0,
      MarketHistories: [
        { ItemAmount: 4, SilverAmount: 520000, Timestamp: 638181504000000000 }
      ]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).accepted, 1);
  assert.equal(repository.getMarketHistories({ albionId: 1234 }).length, 1);

  await app.close();
  repository.close();
});

test("POST /api/private/market-histories stores valid local market history rows", async () => {
  const repository = createRepository(":memory:");
  const app = createApp({ repository, provider: null, config: testConfig });

  const response = await app.inject({
    method: "POST",
    url: "/api/private/market-histories",
    payload: {
      AlbionId: 1234,
      LocationId: "3005",
      QualityLevel: 1,
      Timescale: 0,
      MarketHistories: [
        { ItemAmount: 4, SilverAmount: 520000, Timestamp: 638181504000000000 },
        { ItemAmount: 0, SilverAmount: 520000, Timestamp: 638181504000000000 }
      ]
    }
  });

  const payload = JSON.parse(response.body);
  const rows = repository.getMarketHistories({ albionId: 1234, location: "Black Market" });

  assert.equal(response.statusCode, 202);
  assert.equal(payload.ok, true);
  assert.equal(payload.accepted, 1);
  assert.equal(payload.rejected, 1);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].albionId, 1234);
  assert.equal(rows[0].location, "Black Market");
  assert.equal(rows[0].itemAmount, 4);
  assert.equal(rows[0].silverAmount, 520000);
  assert.equal(rows[0].timestamp, "2023-04-27T00:00:00.000Z");

  await app.close();
  repository.close();
});

test("GET /api/private/status reports private ingest activity", async () => {
  const repository = createRepository(":memory:");
  const app = createApp({ repository, provider: null, config: testConfig });

  const before = await app.inject({ method: "GET", url: "/api/private/status" });
  assert.equal(JSON.parse(before.body).privateProvider, "idle");

  await app.inject({
    method: "POST",
    url: "/api/private/market-orders",
    payload: {
      Orders: [{
        Id: 505,
        ItemTypeId: "T8_MAIN_SWORD",
        LocationId: "3003",
        QualityLevel: 1,
        EnchantmentLevel: 4,
        UnitPriceSilver: 100000,
        Amount: 1,
        AuctionType: "offer"
      }]
    }
  });

  const after = await app.inject({ method: "GET", url: "/api/private/status" });
  const status = JSON.parse(after.body);

  assert.equal(status.privateProvider, "ready");
  assert.equal(status.privateOrdersAccepted, 1);
  assert.equal(typeof status.lastPrivateOrderAt, "string");
  assert.equal(status.lastPrivateError, null);

  await app.close();
  repository.close();
});
