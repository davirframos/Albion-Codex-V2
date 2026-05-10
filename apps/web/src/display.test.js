import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultOpportunityFilters,
  filterByRangeMode,
  itemMatchesMetadataFilters,
  formatCompactNumber,
  formatPercent,
  getAuctionTypeLabel,
  getDataSourceBadges,
  getDataSourceLabel,
  getDataSourceStatusRows,
  getOpportunityEmptyState,
  groupDiagnosticsBySource,
  getBuyKindLabel,
  getSellKindLabel
} from "./display.js";

test("formats large silver and percent values compactly", () => {
  assert.equal(formatCompactNumber(1000000), "1M");
  assert.equal(formatCompactNumber(250000), "250K");
  assert.equal(formatCompactNumber(1500000), "1.5M");
  assert.equal(formatPercent(12.345), "12.35%");
});

test("filters values with min and max range modes", () => {
  assert.equal(filterByRangeMode(120000, "min", "100000"), true);
  assert.equal(filterByRangeMode(90000, "min", "100000"), false);
  assert.equal(filterByRangeMode(120000, "max", "100000"), false);
  assert.equal(filterByRangeMode(90000, "max", "100000"), true);
  assert.equal(filterByRangeMode(90000, "min", ""), true);
});

test("defaults to relaxed opportunity filters for private collection", () => {
  assert.equal(defaultOpportunityFilters.maxAge, "120");
  assert.equal(defaultOpportunityFilters.profitValue, "0");
  assert.equal(defaultOpportunityFilters.marginValue, "0");
  assert.deepEqual(defaultOpportunityFilters.categories, []);
});

test("filters item metadata by category and T1-T8 tiers", () => {
  assert.equal(itemMatchesMetadataFilters(
    { tier: 1, enchantment: 0, category: "resource" },
    { ...defaultOpportunityFilters, tiers: [1], categories: ["resource"] }
  ), true);
  assert.equal(itemMatchesMetadataFilters(
    { tier: 1, enchantment: 0, category: "resource" },
    { ...defaultOpportunityFilters, tiers: [4], categories: ["resource"] }
  ), false);
  assert.equal(itemMatchesMetadataFilters(
    { tier: 4, enchantment: 0, category: "equipment" },
    { ...defaultOpportunityFilters, tiers: [4], categories: ["resource"] }
  ), false);
});

test("labels V2 fixed instant sides like the V1 table", () => {
  assert.equal(getBuyKindLabel("instant_buy"), "comprar agora");
  assert.equal(getSellKindLabel("instant_sell"), "vender agora");
  assert.equal(getAuctionTypeLabel("offer"), "sell offers");
  assert.equal(getAuctionTypeLabel("request"), "buy orders");
});

test("labels opportunity data sources for item badges", () => {
  assert.deepEqual(getDataSourceBadges({ dataSources: ["private"] }), [
    { key: "private", label: "Privada", tone: "private" }
  ]);
  assert.deepEqual(getDataSourceBadges({ buyDataSource: "public", sellDataSource: "private" }), [
    { key: "public", label: "Publica", tone: "public" },
    { key: "private", label: "Privada", tone: "private" }
  ]);
  assert.deepEqual(getDataSourceBadges({}), [
    { key: "unknown", label: "Legado", tone: "legacy" }
  ]);
});

test("groups market diagnostics by private, public and legacy sources", () => {
  const groups = groupDiagnosticsBySource([
    { city: "Black Market", auctionType: "request", dataSource: "public", count: 2 },
    { city: "Caerleon", auctionType: "offer", dataSource: "private", count: 1 },
    { city: "Black Market", auctionType: "offer", dataSource: "unknown", count: 3 },
    { city: "Black Market", auctionType: "request", dataSource: "private", count: 4 }
  ]);

  assert.deepEqual(groups.map((group) => group.source), ["private", "public", "unknown"]);
  assert.deepEqual(groups[0].buckets.map((bucket) => `${bucket.city}:${bucket.auctionType}`), [
    "Black Market:request",
    "Caerleon:offer"
  ]);
  assert.equal(getDataSourceLabel("unknown"), "Legado");
});

test("summarizes public and private data source freshness", () => {
  const rows = getDataSourceStatusRows({
    publicProvider: "streaming",
    lastOrdersReceivedAt: "2026-05-08T18:30:00.000Z",
    privateProvider: "ready",
    lastPrivateOrderAt: "2026-05-08T18:31:00.000Z",
    lastPrivateHistoryAt: "2026-05-08T18:29:00.000Z"
  }, {
    now: new Date("2026-05-08T18:33:10.000Z"),
    formatTime: (value) => `hora ${value.slice(11, 16)}`
  });

  assert.deepEqual(rows, [
    { key: "public", label: "Publico ok", detail: "NATS ha 3 min", tone: "public" },
    { key: "private", label: "Privada ok", detail: "Privado ha 2 min", tone: "private" }
  ]);
});

test("falls back to exact time for older data source updates", () => {
  const rows = getDataSourceStatusRows({
    publicProvider: "ready",
    lastOrdersReceivedAt: "2026-05-08T16:10:00.000Z",
    privateProvider: "idle"
  }, {
    now: new Date("2026-05-08T18:33:10.000Z"),
    formatTime: (value) => `hora ${value.slice(11, 16)}`
  });

  assert.equal(rows[0].detail, "NATS hora 16:10");
  assert.equal(rows[1].detail, "sem captura privada");
});

test("explains empty opportunity states by data and filters", () => {
  assert.deepEqual(getOpportunityEmptyState({ total: 0, filtered: 0, hasFilters: false }), {
    title: "Sem ordens suficientes",
    detail: "Aguardando Caerleon sell offers e Black Market buy orders com quantidade real."
  });
  assert.deepEqual(getOpportunityEmptyState({ total: 12, filtered: 0, hasFilters: true }), {
    title: "Filtros zeraram a lista",
    detail: "Relaxe lucro, idade, tier ou quantidade para recuperar oportunidades."
  });
});
