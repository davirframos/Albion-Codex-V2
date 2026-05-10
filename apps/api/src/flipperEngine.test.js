import assert from "node:assert/strict";
import test from "node:test";
import { calculateCaerleonBlackMarketOpportunities } from "./flipperEngine.js";

const now = new Date("2026-05-06T12:00:00.000Z");

const config = {
  salesTaxRate: 0.08,
  minProfit: 10000,
  minMarginPct: 8,
  maxAgeMinutes: 30,
  minQuantity: 1,
  now
};

function order(overrides) {
  return {
    orderId: Math.floor(Math.random() * 1000000),
    itemId: "T8_MAIN_SWORD@4",
    city: "Caerleon",
    quality: 1,
    auctionType: "offer",
    unitPrice: 100000,
    amount: 3,
    observedAt: "2026-05-06T11:55:00.000Z",
    ...overrides
  };
}

test("calculates profitable Caerleon sell order into Black Market buy order after tax", () => {
  const opportunities = calculateCaerleonBlackMarketOpportunities([
    order({ orderId: 1, city: "Caerleon", auctionType: "offer", unitPrice: 100000, amount: 4 }),
    order({ orderId: 2, city: "Black Market", auctionType: "request", unitPrice: 130000, amount: 2 })
  ], config);

  assert.equal(opportunities.length, 1);
  assert.equal(opportunities[0].quantity, 2);
  assert.equal(opportunities[0].totalCost, 200000);
  assert.equal(opportunities[0].grossRevenue, 260000);
  assert.equal(opportunities[0].tax, 20800);
  assert.equal(opportunities[0].netProfit, 39200);
  assert.equal(opportunities[0].marginPct, 19.6);
});

test("matches Albion market's 8 percent sales tax shown in the sell order UI", () => {
  const opportunities = calculateCaerleonBlackMarketOpportunities([
    order({ orderId: 1, city: "Caerleon", auctionType: "offer", unitPrice: 155000, amount: 1 }),
    order({ orderId: 2, city: "Black Market", auctionType: "request", unitPrice: 184987, amount: 1 })
  ], config);

  assert.equal(opportunities.length, 1);
  assert.equal(opportunities[0].grossRevenue, 184987);
  assert.equal(opportunities[0].tax, 14799);
  assert.equal(opportunities[0].revenueAfterTax, 170188);
  assert.equal(opportunities[0].netProfit, 15188);
});

test("uses the cheapest Caerleon offer and highest Black Market request per item quality", () => {
  const opportunities = calculateCaerleonBlackMarketOpportunities([
    order({ orderId: 1, city: "Caerleon", auctionType: "offer", unitPrice: 105000, amount: 10 }),
    order({ orderId: 2, city: "Caerleon", auctionType: "offer", unitPrice: 99000, amount: 1 }),
    order({ orderId: 3, city: "Black Market", auctionType: "request", unitPrice: 125000, amount: 3 }),
    order({ orderId: 4, city: "Black Market", auctionType: "request", unitPrice: 133000, amount: 5 })
  ], config);

  assert.equal(opportunities.length, 1);
  assert.equal(opportunities[0].buyOrderId, 2);
  assert.equal(opportunities[0].sellOrderId, 4);
  assert.equal(opportunities[0].quantity, 1);
});

test("rejects opportunities below profit, margin, age or quantity thresholds", () => {
  assert.equal(calculateCaerleonBlackMarketOpportunities([
    order({ city: "Caerleon", auctionType: "offer", unitPrice: 100000, amount: 2 }),
    order({ city: "Black Market", auctionType: "request", unitPrice: 106000, amount: 2 })
  ], config).length, 0);

  assert.equal(calculateCaerleonBlackMarketOpportunities([
    order({ city: "Caerleon", auctionType: "offer", unitPrice: 500000, amount: 10 }),
    order({ city: "Black Market", auctionType: "request", unitPrice: 545000, amount: 10 })
  ], config).length, 0);

  assert.equal(calculateCaerleonBlackMarketOpportunities([
    order({ city: "Caerleon", auctionType: "offer", observedAt: "2026-05-06T11:00:00.000Z" }),
    order({ city: "Black Market", auctionType: "request", unitPrice: 130000 })
  ], config).length, 0);

  assert.equal(calculateCaerleonBlackMarketOpportunities([
    order({ city: "Caerleon", auctionType: "offer", amount: 0 }),
    order({ city: "Black Market", auctionType: "request", unitPrice: 130000 })
  ], config).length, 0);
});

test("calculates item qualities separately", () => {
  const opportunities = calculateCaerleonBlackMarketOpportunities([
    order({ orderId: 1, city: "Caerleon", quality: 1, auctionType: "offer", unitPrice: 100000 }),
    order({ orderId: 2, city: "Black Market", quality: 1, auctionType: "request", unitPrice: 130000 }),
    order({ orderId: 3, city: "Caerleon", quality: 2, auctionType: "offer", unitPrice: 150000 }),
    order({ orderId: 4, city: "Black Market", quality: 2, auctionType: "request", unitPrice: 200000 })
  ], config);

  assert.deepEqual(opportunities.map((offer) => offer.quality).sort(), [1, 2]);
});

test("can require real order quantities to reduce synthetic snapshot opportunities", () => {
  const synthetic = calculateCaerleonBlackMarketOpportunities([
    order({ orderId: -1, city: "Caerleon", auctionType: "offer", unitPrice: 100000, amount: 1 }),
    order({ orderId: 2, city: "Black Market", auctionType: "request", unitPrice: 140000, amount: 4 })
  ], { ...config, requireRealOrderQuantities: true });

  assert.equal(synthetic.length, 0);

  const real = calculateCaerleonBlackMarketOpportunities([
    order({ orderId: 1, city: "Caerleon", auctionType: "offer", unitPrice: 100000, amount: 3 }),
    order({ orderId: 2, city: "Black Market", auctionType: "request", unitPrice: 140000, amount: 4 })
  ], { ...config, requireRealOrderQuantities: true });

  assert.equal(real.length, 1);
  assert.equal(real[0].hasOrderQuantities, true);
  assert.equal(real[0].originQuantity, 3);
  assert.equal(real[0].destinationQuantity, 4);
  assert.equal(real[0].buyKind, "instant_buy");
  assert.equal(real[0].sellKind, "instant_sell");
});

test("reports the data source for each side of an opportunity", () => {
  const opportunities = calculateCaerleonBlackMarketOpportunities([
    order({ orderId: 1, city: "Caerleon", auctionType: "offer", unitPrice: 100000, amount: 3, dataSource: "private" }),
    order({ orderId: 2, city: "Black Market", auctionType: "request", unitPrice: 140000, amount: 4, dataSource: "public" })
  ], config);

  assert.equal(opportunities.length, 1);
  assert.equal(opportunities[0].buyDataSource, "private");
  assert.equal(opportunities[0].sellDataSource, "public");
  assert.deepEqual(opportunities[0].dataSources, ["private", "public"]);
});
