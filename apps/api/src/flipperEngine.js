export function getPriceAgeMinutes(observedAt, now = new Date()) {
  const observed = new Date(observedAt).getTime();
  const current = new Date(now).getTime();
  if (Number.isNaN(observed) || Number.isNaN(current)) return null;
  return Math.max(0, Math.round((current - observed) / 60000));
}

function pairKey(order) {
  return `${order.itemId}|${order.quality}`;
}

function isFresh(order, maxAgeMinutes, now) {
  const ageMinutes = getPriceAgeMinutes(order.observedAt, now);
  return ageMinutes != null && ageMinutes <= maxAgeMinutes;
}

function betterCaerleonOffer(current, candidate) {
  if (!current) return candidate;
  if (candidate.unitPrice !== current.unitPrice) {
    return candidate.unitPrice < current.unitPrice ? candidate : current;
  }
  return new Date(candidate.observedAt) > new Date(current.observedAt) ? candidate : current;
}

function betterBlackMarketRequest(current, candidate) {
  if (!current) return candidate;
  if (candidate.unitPrice !== current.unitPrice) {
    return candidate.unitPrice > current.unitPrice ? candidate : current;
  }
  return new Date(candidate.observedAt) > new Date(current.observedAt) ? candidate : current;
}

function offerKeyFor(itemId, quality, buyOrderId, sellOrderId) {
  return [itemId, quality, "Caerleon", buyOrderId, "Black Market", sellOrderId].join("|");
}

function hasRealOrderQuantity(order) {
  return Number(order?.orderId) > 0 && Number(order?.amount) > 0;
}

function normalizeDataSource(source) {
  const text = String(source || "unknown").toLowerCase();
  if (text === "private" || text === "public") return text;
  return "unknown";
}

function opportunityDataSources(buyOrder, sellOrder) {
  const sources = [
    normalizeDataSource(buyOrder?.dataSource),
    normalizeDataSource(sellOrder?.dataSource)
  ];
  return [...new Set(sources)];
}

export function calculateCaerleonBlackMarketOpportunities(
  orders,
  config,
  hiddenOfferKeys = new Set()
) {
  const now = config.now || new Date();
  const maxAgeMinutes = Number(config.maxAgeMinutes ?? 30);
  const minProfit = Number(config.minProfit ?? 10000);
  const minMarginPct = Number(config.minMarginPct ?? 8);
  const minQuantity = Number(config.minQuantity ?? 1);
  const salesTaxRate = Number(config.salesTaxRate ?? 0.08);
  const caerleonOffers = new Map();
  const blackMarketRequests = new Map();

  for (const order of orders || []) {
    if (!order?.itemId || !order?.quality || !order?.auctionType) continue;
    if (Number(order.amount) <= 0 || Number(order.unitPrice) <= 0) continue;
    if (!isFresh(order, maxAgeMinutes, now)) continue;

    const key = pairKey(order);
    if (order.city === "Caerleon" && order.auctionType === "offer") {
      caerleonOffers.set(key, betterCaerleonOffer(caerleonOffers.get(key), order));
    }
    if (order.city === "Black Market" && order.auctionType === "request") {
      blackMarketRequests.set(key, betterBlackMarketRequest(blackMarketRequests.get(key), order));
    }
  }

  const opportunities = [];

  for (const [key, buyOrder] of caerleonOffers.entries()) {
    const sellOrder = blackMarketRequests.get(key);
    if (!sellOrder) continue;

    const quantity = Math.min(Number(buyOrder.amount), Number(sellOrder.amount));
    if (quantity < minQuantity) continue;

    const itemId = buyOrder.itemId;
    const quality = Number(buyOrder.quality);
    const hasOrderQuantities = hasRealOrderQuantity(buyOrder) && hasRealOrderQuantity(sellOrder);
    if (config.requireRealOrderQuantities && !hasOrderQuantities) continue;

    const totalCost = Number(buyOrder.unitPrice) * quantity;
    const grossRevenue = Number(sellOrder.unitPrice) * quantity;
    const tax = Math.round(grossRevenue * salesTaxRate);
    const revenueAfterTax = grossRevenue - tax;
    const netProfit = revenueAfterTax - totalCost;
    const marginPct = totalCost > 0 ? Number(((netProfit / totalCost) * 100).toFixed(2)) : 0;
    const offerKey = offerKeyFor(itemId, quality, buyOrder.orderId, sellOrder.orderId);

    if (hiddenOfferKeys.has(offerKey)) continue;
    if (netProfit < minProfit) continue;
    if (marginPct < minMarginPct) continue;

    const buyAgeMinutes = getPriceAgeMinutes(buyOrder.observedAt, now);
    const sellAgeMinutes = getPriceAgeMinutes(sellOrder.observedAt, now);
    const buyDataSource = normalizeDataSource(buyOrder.dataSource);
    const sellDataSource = normalizeDataSource(sellOrder.dataSource);

    opportunities.push({
      offerKey,
      itemId,
      quality,
      sourceCity: "Caerleon",
      destinationCity: "Black Market",
      originCity: "Caerleon",
      buyKind: "instant_buy",
      sellKind: "instant_sell",
      buyOrderId: buyOrder.orderId,
      sellOrderId: sellOrder.orderId,
      buyDataSource,
      sellDataSource,
      dataSources: opportunityDataSources(buyOrder, sellOrder),
      unitCost: Number(buyOrder.unitPrice),
      unitRevenue: Number(sellOrder.unitPrice),
      quantity,
      hasOrderQuantities,
      originQuantity: hasRealOrderQuantity(buyOrder) ? Number(buyOrder.amount) : null,
      destinationQuantity: hasRealOrderQuantity(sellOrder) ? Number(sellOrder.amount) : null,
      totalCost,
      grossRevenue,
      revenueAfterTax,
      tax,
      grossSpread: Number(sellOrder.unitPrice) - Number(buyOrder.unitPrice),
      netProfit,
      marginPct,
      buyAgeMinutes,
      sellAgeMinutes,
      originAgeMinutes: buyAgeMinutes,
      destinationAgeMinutes: sellAgeMinutes,
      ageMinutes: Math.max(buyAgeMinutes, sellAgeMinutes),
      observedAt: [buyOrder.observedAt, sellOrder.observedAt].sort().at(-1)
    });
  }

  return opportunities.sort((a, b) => b.netProfit - a.netProfit);
}
