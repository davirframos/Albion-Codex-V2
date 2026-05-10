export { getItemCategoryLabel, itemCategoryOptions } from "../../shared/itemClassification.js";

export function formatCompactNumber(value) {
  const number = Number(value || 0);

  if (Math.abs(number) >= 1000000000) return `${(number / 1000000000).toFixed(1).replace(".0", "")}B`;
  if (Math.abs(number) >= 1000000) return `${(number / 1000000).toFixed(1).replace(".0", "")}M`;
  if (Math.abs(number) >= 1000) return `${(number / 1000).toFixed(1).replace(".0", "")}K`;
  return Math.round(number).toLocaleString("pt-BR");
}

export function formatSilver(value) {
  return formatCompactNumber(value);
}

export function formatPercent(value) {
  const number = Number(value || 0);
  return `${number.toFixed(2)}%`;
}

function newestTimestamp(values) {
  return values
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;
}

function formatFreshness(value, { now = new Date(), formatTime = (timestamp) => new Date(timestamp).toLocaleTimeString() } = {}) {
  const date = new Date(value);
  const ageMs = now.getTime() - date.getTime();

  if (!Number.isFinite(ageMs) || ageMs < 0) return formatTime(value);
  if (ageMs < 60000) return "agora";
  if (ageMs < 3600000) return `ha ${Math.floor(ageMs / 60000)} min`;
  return formatTime(value);
}

export function getDataSourceStatusRows(status, options = {}) {
  const dataStatus = status || {};
  const publicStatus = dataStatus.publicProvider || "idle";
  const privateStatus = dataStatus.privateProvider || "not_configured";
  const lastPublicOrder = dataStatus.lastOrdersReceivedAt;
  const lastPrivateUpdate = newestTimestamp([
    dataStatus.lastPrivateOrderAt,
    dataStatus.lastPrivateHistoryAt
  ]);

  return [
    {
      key: "public",
      label: publicStatus === "ready" || publicStatus === "streaming" ? "Publico ok" : publicStatus,
      detail: lastPublicOrder ? `NATS ${formatFreshness(lastPublicOrder, options)}` : "aguardando NATS",
      tone: publicStatus === "error" ? "error" : "public"
    },
    {
      key: "private",
      label: privateStatus === "ready" ? "Privada ok" : privateStatus,
      detail: lastPrivateUpdate ? `Privado ${formatFreshness(lastPrivateUpdate, options)}` : "sem captura privada",
      tone: privateStatus === "ready" ? "private" : "idle"
    }
  ];
}

export function getOpportunityEmptyState({ total = 0, filtered = 0, hasFilters = false } = {}) {
  if (total > 0 && filtered === 0 && hasFilters) {
    return {
      title: "Filtros zeraram a lista",
      detail: "Relaxe lucro, idade, tier ou quantidade para recuperar oportunidades."
    };
  }

  return {
    title: "Sem ordens suficientes",
    detail: "Aguardando Caerleon sell offers e Black Market buy orders com quantidade real."
  };
}

export function filterByRangeMode(value, mode, filterValue) {
  if (filterValue === "" || filterValue == null) return true;

  const number = Number(value);
  const limit = Number(filterValue);
  if (!Number.isFinite(number) || !Number.isFinite(limit)) return true;

  if (mode === "max") return number <= limit;
  return number >= limit;
}

export const defaultOpportunityFilters = {
  item: "",
  categories: [],
  tiers: [],
  enchantments: [],
  realOnly: true,
  maxAge: "120",
  minQuantity: "1",
  sortBy: "netProfit",
  profitMode: "min",
  profitValue: "0",
  marginMode: "min",
  marginValue: "0"
};

export function itemMatchesMetadataFilters(item, filters = defaultOpportunityFilters) {
  const enchantment = item.enchantment || 0;

  if (filters.categories?.length > 0 && !filters.categories.includes(item.category)) return false;
  if (filters.tiers?.length > 0 && !filters.tiers.includes(item.tier)) return false;
  if (filters.enchantments?.length > 0 && !filters.enchantments.includes(enchantment)) return false;
  return true;
}

export function getBuyKindLabel(kind) {
  const labels = {
    instant_buy: "comprar agora",
    buy_order: "criar ordem compra"
  };

  return labels[kind] || kind;
}

export function getSellKindLabel(kind) {
  const labels = {
    instant_sell: "vender agora",
    sell_order: "criar ordem venda"
  };

  return labels[kind] || kind;
}

export function getAuctionTypeLabel(type) {
  const labels = {
    offer: "sell offers",
    request: "buy orders"
  };

  return labels[type] || type;
}

const sourceLabels = {
  private: { label: "Privada", tone: "private" },
  public: { label: "Publica", tone: "public" },
  unknown: { label: "Legado", tone: "legacy" }
};

const sourceOrder = ["private", "public", "unknown"];
const cityOrder = ["Black Market", "Caerleon"];
const auctionTypeOrder = ["request", "offer"];

function normalizeDataSource(source) {
  const text = String(source || "unknown").toLowerCase();
  return sourceLabels[text] ? text : "unknown";
}

export function getDataSourceLabel(source) {
  return sourceLabels[normalizeDataSource(source)].label;
}

export function getDataSourceBadges(offer) {
  const sources = offer?.dataSources?.length
    ? offer.dataSources
    : [offer?.buyDataSource, offer?.sellDataSource].filter(Boolean);
  const uniqueSources = [...new Set(sources.map(normalizeDataSource))];
  const finalSources = uniqueSources.length > 0 ? uniqueSources : ["unknown"];

  return finalSources.map((source) => {
    const badge = sourceLabels[source];
    return {
      key: source,
      ...badge
    };
  });
}

export function groupDiagnosticsBySource(buckets) {
  const grouped = new Map(sourceOrder.map((source) => [source, []]));

  for (const bucket of buckets || []) {
    grouped.get(normalizeDataSource(bucket.dataSource)).push(bucket);
  }

  return sourceOrder
    .map((source) => ({
      source,
      label: sourceLabels[source].label,
      tone: sourceLabels[source].tone,
      buckets: grouped.get(source).sort((a, b) => (
        cityOrder.indexOf(a.city) - cityOrder.indexOf(b.city)
        || auctionTypeOrder.indexOf(a.auctionType) - auctionTypeOrder.indexOf(b.auctionType)
      ))
    }))
    .filter((group) => group.buckets.length > 0);
}
