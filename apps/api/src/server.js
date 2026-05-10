import Fastify from "fastify";
import { WebSocketServer } from "ws";
import { pathToFileURL } from "node:url";
import { config as defaultConfig } from "./config.js";
import { createRepository } from "./db.js";
import { calculateCaerleonBlackMarketOpportunities } from "./flipperEngine.js";
import { AlbionDataPublicProvider } from "./dataProviders/albionDataPublicProvider.js";
import { PrivateCollectorProvider } from "./dataProviders/privateCollectorProvider.js";

const strategyBuckets = new Set([
  "Caerleon|offer",
  "Black Market|request"
]);

function makeMarketDiagnostics(orders) {
  const buckets = new Map();
  const usefulPairs = new Map();

  for (const order of orders || []) {
    const dataSource = order.dataSource || "unknown";
    const bucketKey = [order.city, order.auctionType, dataSource].join("|");
    buckets.set(bucketKey, {
      city: order.city,
      auctionType: order.auctionType,
      dataSource,
      count: (buckets.get(bucketKey)?.count || 0) + 1,
      usefulForStrategy: strategyBuckets.has([order.city, order.auctionType].join("|"))
    });

    if (strategyBuckets.has([order.city, order.auctionType].join("|"))) {
      const pairKey = `${order.itemId}|${order.quality}`;
      const pair = usefulPairs.get(pairKey) || { caerleonOffer: false, blackMarketRequest: false };
      if (order.city === "Caerleon" && order.auctionType === "offer") pair.caerleonOffer = true;
      if (order.city === "Black Market" && order.auctionType === "request") pair.blackMarketRequest = true;
      usefulPairs.set(pairKey, pair);
    }
  }

  const byBucket = [...buckets.values()].sort((a, b) => (
    a.city.localeCompare(b.city)
    || a.auctionType.localeCompare(b.auctionType)
    || a.dataSource.localeCompare(b.dataSource)
  ));
  const usefulOrders = byBucket
    .filter((bucket) => bucket.usefulForStrategy)
    .reduce((sum, bucket) => sum + bucket.count, 0);
  const totalOrders = byBucket.reduce((sum, bucket) => sum + bucket.count, 0);
  const pairableItemQualities = [...usefulPairs.values()]
    .filter((pair) => pair.caerleonOffer && pair.blackMarketRequest)
    .length;

  return {
    totalOrders,
    usefulOrders,
    unusedOrders: totalOrders - usefulOrders,
    pairableItemQualities,
    byBucket
  };
}

function makeSnapshot(repository, config, dataSourceStatus = {}) {
  const hiddenOfferKeys = repository.getHiddenOfferKeys();
  const marketOrders = repository.getMarketOrders();
  const opportunities = calculateCaerleonBlackMarketOpportunities(
    marketOrders,
    { ...config, requireRealOrderQuantities: false },
    hiddenOfferKeys
  );
  const realQuantityCount = opportunities.filter((offer) => offer.hasOrderQuantities).length;

  return {
    type: "opportunities",
    generatedAt: new Date().toISOString(),
    count: opportunities.length,
    opportunities,
    opportunityStats: {
      total: opportunities.length,
      realQuantity: realQuantityCount,
      estimated: opportunities.length - realQuantityCount
    },
    marketDiagnostics: makeMarketDiagnostics(marketOrders),
    dataSourceStatus: {
      publicProvider: "idle",
      privateProvider: "not_configured",
      ...dataSourceStatus
    }
  };
}

export function createApp({ repository, provider, privateProvider, config = defaultConfig }) {
  const app = Fastify({ logger: false });
  const clients = new Set();
  let rebuildTimer = null;
  const publicProvider = provider;
  const localPrivateProvider = privateProvider || new PrivateCollectorProvider({
    config,
    repository,
    logger: console
  });

  const getDataSourceStatus = () => ({
    ...(publicProvider?.getStatus?.() || {}),
    ...(localPrivateProvider?.getStatus?.() || {})
  });

  const broadcast = (payload) => {
    const message = JSON.stringify(payload);
    for (const client of clients) {
      if (client.readyState === client.OPEN) client.send(message);
    }
  };

  const getSnapshot = () => makeSnapshot(repository, config, getDataSourceStatus());

  const rebuildAndBroadcast = () => {
    const snapshot = getSnapshot();
    broadcast(snapshot);
    return snapshot;
  };

  const scheduleRebuild = () => {
    if (rebuildTimer) return;
    rebuildTimer = setTimeout(() => {
      rebuildTimer = null;
      rebuildAndBroadcast();
    }, Number(config.rebuildDebounceMs || 250));
  };

  app.addHook("onClose", async () => {
    if (rebuildTimer) {
      clearTimeout(rebuildTimer);
      rebuildTimer = null;
    }
  });

  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    const allowedOrigins = new Set([
      config.webOrigin,
      "http://localhost:5174",
      "http://127.0.0.1:5174"
    ]);

    reply.header("access-control-allow-origin", allowedOrigins.has(origin) ? origin : config.webOrigin);
    reply.header("access-control-allow-methods", "GET,POST,OPTIONS");
    reply.header("access-control-allow-headers", "content-type");

    if (request.method === "OPTIONS") return reply.code(204).send();
  });

  app.get("/", async () => ({
    name: "Albion Codex V2 API",
    ok: true,
    mechanic: "Caerleon -> Black Market"
  }));

  app.get("/health", async () => ({
    ok: true,
    generatedAt: new Date().toISOString(),
    config: {
      port: config.port,
      albionServer: config.albionServer,
      itemCount: config.items?.length || 0,
      minProfit: config.minProfit,
      minMarginPct: config.minMarginPct,
      maxAgeMinutes: config.maxAgeMinutes
    }
  }));

  app.get("/api/opportunities", async () => getSnapshot());

  app.post("/api/refresh", async (request, reply) => {
    try {
      if (!publicProvider?.refresh) {
        return { ok: true, snapshot: rebuildAndBroadcast(), message: "No public provider configured." };
      }
      await publicProvider.refresh();
      return { ok: true, snapshot: rebuildAndBroadcast() };
    } catch (error) {
      reply.code(500);
      return { ok: false, message: error.message, snapshot: rebuildAndBroadcast() };
    }
  });

  const handlePrivateMarketOrders = async (request, reply, successCode = 202) => {
    try {
      const result = localPrivateProvider.ingestMarketOrders(request.body);
      if (result.accepted <= 0) {
        reply.code(400);
        return {
          ok: false,
          message: "No valid private market orders received.",
          ...result,
          status: localPrivateProvider.getStatus()
        };
      }

      scheduleRebuild();
      reply.code(successCode);
      return {
        ok: true,
        ...result,
        status: localPrivateProvider.getStatus()
      };
    } catch (error) {
      reply.code(500);
      return {
        ok: false,
        message: error.message,
        status: localPrivateProvider.getStatus()
      };
    }
  };

  const handlePrivateMarketHistories = async (request, reply, successCode = 202) => {
    try {
      const result = localPrivateProvider.ingestMarketHistories(request.body);
      if (result.accepted <= 0) {
        reply.code(400);
        return {
          ok: false,
          message: "No valid private market histories received.",
          ...result,
          status: localPrivateProvider.getStatus()
        };
      }

      scheduleRebuild();
      reply.code(successCode);
      return {
        ok: true,
        ...result,
        status: localPrivateProvider.getStatus()
      };
    } catch (error) {
      reply.code(500);
      return {
        ok: false,
        message: error.message,
        status: localPrivateProvider.getStatus()
      };
    }
  };

  app.get("/api/private/status", async () => localPrivateProvider.getStatus());
  app.post("/api/private/market-orders", (request, reply) => handlePrivateMarketOrders(request, reply));
  app.post("/api/private/marketorders.ingest", (request, reply) => handlePrivateMarketOrders(request, reply, 200));
  app.post("/api/private/market-histories", (request, reply) => handlePrivateMarketHistories(request, reply));
  app.post("/api/private/markethistories.ingest", (request, reply) => handlePrivateMarketHistories(request, reply, 200));

  app.post("/api/offers/save", async (request, reply) => {
    repository.saveOfferSnapshot(request.body, "saved");
    repository.hideOfferFor({
      offerKey: request.body.offerKey,
      reason: "saved",
      ttlMinutes: Number(request.body.ttlMinutes || 30)
    });
    reply.code(201);
    return { ok: true, snapshot: rebuildAndBroadcast() };
  });

  app.post("/api/offers/hide", async (request) => {
    repository.hideOfferFor({
      offerKey: request.body.offerKey,
      reason: request.body.reason || "exhausted",
      ttlMinutes: Number(request.body.ttlMinutes || 30)
    });
    return { ok: true, snapshot: rebuildAndBroadcast() };
  });

  app.post("/api/offers/execute", async (request, reply) => {
    repository.saveOfferSnapshot(request.body, "executed");
    repository.hideOfferFor({
      offerKey: request.body.offerKey,
      reason: "executed",
      ttlMinutes: Number(request.body.ttlMinutes || 30)
    });
    reply.code(201);
    return { ok: true, snapshot: rebuildAndBroadcast() };
  });

  app.decorate("attachWebSocketServer", (server) => {
    const wss = new WebSocketServer({ server, path: "/ws" });
    wss.on("connection", (socket) => {
      clients.add(socket);
      socket.send(JSON.stringify(getSnapshot()));
      socket.on("close", () => clients.delete(socket));
    });
    app.addHook("onClose", async () => {
      for (const client of clients) client.close();
      wss.close();
    });
    return wss;
  });

  app.decorate("rebuildAndBroadcast", rebuildAndBroadcast);
  app.decorate("scheduleRebuild", scheduleRebuild);

  return app;
}

async function start() {
  const repository = createRepository();
  const provider = new AlbionDataPublicProvider({
    config: defaultConfig,
    repository,
    logger: console
  });
  const privateProvider = new PrivateCollectorProvider({
    config: defaultConfig,
    repository,
    logger: console
  });
  const app = createApp({ repository, provider, privateProvider, config: defaultConfig });

  app.attachWebSocketServer(app.server);
  const address = await app.listen({ host: "127.0.0.1", port: defaultConfig.port });

  if (defaultConfig.marketOrdersEnabled) {
    provider.startOrderStream(() => app.scheduleRebuild()).catch((error) => {
      app.log.error(error);
    });
  }

  provider.refresh().then(() => app.rebuildAndBroadcast()).catch((error) => {
    app.log.error(error);
  });

  app.log.info(`Albion Codex V2 API listening at ${address}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
