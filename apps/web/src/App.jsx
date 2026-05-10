import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  filterByRangeMode,
  formatCompactNumber,
  formatPercent,
  formatSilver,
  getAuctionTypeLabel,
  getBuyKindLabel,
  getDataSourceBadges,
  getDataSourceStatusRows,
  getOpportunityEmptyState,
  groupDiagnosticsBySource,
  getSellKindLabel,
  defaultOpportunityFilters,
  getItemCategoryLabel,
  itemCategoryOptions,
  itemMatchesMetadataFilters
} from "./display.js";
import { getItemMetadata, getQualityName } from "./itemMetadata.js";
import "./styles.css";

const apiBase = "http://127.0.0.1:3867";
const wsUrl = "ws://127.0.0.1:3867/ws";
const tiers = [1, 2, 3, 4, 5, 6, 7, 8];
const enchantments = [0, 1, 2, 3, 4];
const maxProfitSlider = 250000;
const maxMarginSlider = 300;
const pageSize = 80;

const emptyFilters = defaultOpportunityFilters;

async function readJsonResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.message || fallbackMessage);
  }
  return payload;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function itemMatchesFilter(itemId, filterValue) {
  if (!filterValue) return true;

  const item = getItemMetadata(itemId);
  const needles = normalizeText(filterValue).split(/\s+/).filter(Boolean);
  const haystack = normalizeText(`${item.itemId} ${item.displayName}`);

  return needles.every((needle) => haystack.includes(needle));
}

function toggleValue(values, value) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function summarizeNumbers(label, values, emptyLabel = "Todos") {
  if (values.length === 0) return emptyLabel;
  return `${label}: ${values.join(", ")}`;
}

function sortOffers(opportunities, sortBy) {
  return [...opportunities].sort((a, b) => {
    if (sortBy === "buyAge") return (a.originAgeMinutes ?? a.ageMinutes) - (b.originAgeMinutes ?? b.ageMinutes);
    if (sortBy === "sellAge") return (a.destinationAgeMinutes ?? a.ageMinutes) - (b.destinationAgeMinutes ?? b.ageMinutes);
    if (sortBy === "marginPct") return b.marginPct - a.marginPct;
    return b.netProfit - a.netProfit;
  });
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function hasActiveFilters(filters) {
  return Boolean(
    filters.item
    || filters.categories.length
    || filters.tiers.length
    || filters.enchantments.length
    || filters.maxAge !== emptyFilters.maxAge
    || filters.minQuantity !== emptyFilters.minQuantity
    || filters.profitValue !== emptyFilters.profitValue
    || filters.marginValue !== emptyFilters.marginValue
    || filters.realOnly !== emptyFilters.realOnly
  );
}

function summarizeCategories(values) {
  if (values.length === 0) return "Todas";
  if (values.length === 1) return getItemCategoryLabel(values[0]);
  return `${values.length} categorias`;
}

function ItemSuggestion({ itemId, onSelect }) {
  const item = getItemMetadata(itemId);

  return (
    <button type="button" className="suggestion" onMouseDown={() => onSelect(item)}>
      <img alt="" src={item.iconUrl} aria-hidden="true" />
      <span>
        <strong>{item.displayName}</strong>
        <small>{item.itemId}</small>
      </span>
    </button>
  );
}

function MultiSelectPanel({ id, title, leftTitle, rightTitle, leftOptions, rightOptions, leftValues, rightValues, onLeftToggle, onRightToggle }) {
  return (
    <div id={id} className="multi-panel">
      <div>
        <h3>{leftTitle}</h3>
        {leftOptions.map((option) => (
          <label key={option} className="check-row">
            <input type="checkbox" checked={leftValues.includes(option)} onChange={() => onLeftToggle(option)} />
            <span>{option}</span>
          </label>
        ))}
      </div>
      <div>
        <h3>{rightTitle}</h3>
        {rightOptions.map((option) => (
          <label key={option} className="check-row">
            <input type="checkbox" checked={rightValues.includes(option)} onChange={() => onRightToggle(option)} />
            <span>{option}</span>
          </label>
        ))}
      </div>
      <small>{title}</small>
    </div>
  );
}

function CategoryPanel({ id, values, onToggle }) {
  return (
    <div id={id} className="multi-panel category-panel">
      <div>
        <h3>Categoria</h3>
        {itemCategoryOptions.map((option) => (
          <label key={option.key} className="check-row">
            <input type="checkbox" checked={values.includes(option.key)} onChange={() => onToggle(option.key)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <small>Multipla escolha</small>
    </div>
  );
}

function OpportunityItemCell({ offer, onCopyName }) {
  const item = getItemMetadata(offer.itemId);
  const sourceBadges = getDataSourceBadges(offer);

  return (
    <div className="opportunity-item">
      <img alt="" aria-hidden="true" className="opportunity-icon" src={item.iconUrl} loading="lazy" />
      <div>
        <span className="item-badge">
          T{item.tier}.{item.enchantment || 0} <b>|</b> {getQualityName(offer.quality)}
        </span>
        <button
          type="button"
          className="item-name-copy"
          title={`Copiar ${item.displayName}`}
          onClick={() => onCopyName(item.displayName)}
        >
          {item.displayName}
        </button>
        <small title={item.itemId}>{item.itemId}</small>
        <span className="source-badges" aria-label="Origem dos dados">
          {sourceBadges.map((badge) => (
            <span key={badge.key} className={`source-badge ${badge.tone}`}>
              {badge.label}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

function MoneyCell({ city, price, kind, quantity, ageMinutes }) {
  const hasQuantity = quantity != null && quantity !== "-";

  return (
    <div className="market-cell">
      <strong className="city-name">{city}</strong>
      <span className="money-value" title={Math.round(Number(price || 0)).toLocaleString("pt-BR")}>
        {formatSilver(price)}
      </span>
      <small>
        {hasQuantity && <b>QTD {quantity}</b>}
        <span>{kind}</span>
      </small>
      <em>{ageMinutes ?? "-"} min</em>
    </div>
  );
}

function FeeCell({ offer }) {
  return (
    <div className="fee-cell">
      <strong>{formatSilver(offer.tax)}</strong>
      <small>taxa mercado</small>
    </div>
  );
}

function MarketDiagnostics({ diagnostics }) {
  const buckets = diagnostics?.byBucket || [];
  if (!diagnostics || buckets.length === 0) return null;
  const groups = groupDiagnosticsBySource(buckets);
  const visibleGroups = groups.filter((group) => group.source !== "unknown");
  const legacyGroup = groups.find((group) => group.source === "unknown");
  const legacyCount = legacyGroup?.buckets.reduce((sum, bucket) => sum + bucket.count, 0) || 0;

  return (
    <section className="diagnostics">
      <div className="diagnostics-heading">
        <div>
          <h2>Diagnostico da coleta</h2>
          <p>Para esta mecanica contam Caerleon sell offers e Black Market buy orders.</p>
        </div>
        <div className="diagnostics-totals">
          <span>{diagnostics.usefulOrders || 0} uteis</span>
          <span>{diagnostics.pairableItemQualities || 0} pares</span>
          {legacyCount > 0 && <span>{formatCompactNumber(legacyCount)} legado</span>}
        </div>
      </div>
      <div className="diagnostics-source-grid">
        {visibleGroups.map((group) => (
          <section key={group.source} className={`diagnostics-source ${group.tone}`}>
            <h3>{group.label}</h3>
            <div className="diagnostics-grid">
              {group.buckets.map((bucket) => (
                <article
                  key={`${bucket.city}-${bucket.auctionType}-${bucket.dataSource}`}
                  className={bucket.usefulForStrategy ? "diagnostic-bucket useful" : "diagnostic-bucket"}
                >
                  <span>{bucket.city}</span>
                  <strong>{formatCompactNumber(bucket.count)}</strong>
                  <small>{getAuctionTypeLabel(bucket.auctionType)}</small>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function App() {
  const [snapshot, setSnapshot] = useState({ opportunities: [], opportunityStats: {}, marketDiagnostics: null, generatedAt: null, dataSourceStatus: {} });
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState("Conectando");
  const [pollError, setPollError] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [draftFilters, setDraftFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [openPanel, setOpenPanel] = useState(null);
  const [isItemSuggestionsOpen, setIsItemSuggestionsOpen] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(pageSize);
  const [pendingOfferKeys, setPendingOfferKeys] = useState(new Set());
  const [filtersVisible, setFiltersVisible] = useState(true);

  const ingestSnapshot = (payload) => {
    setIsInitialLoading(false);
    setSnapshot({
      opportunities: payload.opportunities || [],
      opportunityStats: payload.opportunityStats || {},
      marketDiagnostics: payload.marketDiagnostics || null,
      generatedAt: payload.generatedAt,
      dataSourceStatus: payload.dataSourceStatus || {}
    });
    setPollError(payload.dataSourceStatus?.lastError
      ? { title: "Falha ao atualizar dados", message: payload.dataSourceStatus.lastError }
      : null);
  };

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${apiBase}/api/opportunities`, { signal: controller.signal })
      .then((response) => readJsonResponse(response, "Falha ao carregar oportunidades"))
      .then(ingestSnapshot)
      .catch((error) => {
        if (error.name === "AbortError") return;
        setPollError({
          title: "API local indisponivel",
          message: `Nao consegui conectar em ${apiBase}: ${error.message}`
        });
      })
      .finally(() => setIsInitialLoading(false));

    const socket = new WebSocket(wsUrl);
    socket.onopen = () => setConnectionStatus("Online");
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "opportunities") ingestSnapshot(payload);
      } catch {
        setPollError({
          title: "Snapshot invalido",
          message: "A API local enviou uma atualizacao que nao consegui interpretar."
        });
      }
    };
    socket.onclose = () => setConnectionStatus("Offline");
    socket.onerror = () => setConnectionStatus("Erro");
    return () => {
      controller.abort();
      socket.close();
    };
  }, []);

  useEffect(() => {
    setVisibleLimit(pageSize);
  }, [appliedFilters]);

  const itemSuggestions = useMemo(() => {
    const query = draftFilters.item.trim();
    if (query.length < 2) return [];

    const activeItemIds = Array.from(new Set(snapshot.opportunities.map((offer) => offer.itemId)));
    const needles = normalizeText(query).split(/\s+/).filter(Boolean);

    return activeItemIds
      .map((itemId) => getItemMetadata(itemId))
      .filter((item) => {
        const haystack = normalizeText(`${item.displayName} ${item.itemId}`);
        return needles.every((needle) => haystack.includes(needle));
      })
      .slice(0, 8);
  }, [draftFilters.item, snapshot.opportunities]);

  const filtered = useMemo(() => {
    const filters = appliedFilters;
    const result = snapshot.opportunities.filter((offer) => {
      const item = getItemMetadata(offer.itemId);

      if (filters.realOnly && !offer.hasOrderQuantities) return false;
      if (!itemMatchesFilter(offer.itemId, filters.item)) return false;
      if (!itemMatchesMetadataFilters(item, filters)) return false;
      if (filters.maxAge && offer.ageMinutes > Number(filters.maxAge)) return false;
      if (filters.minQuantity && offer.quantity < Number(filters.minQuantity)) return false;
      if (!filterByRangeMode(offer.netProfit, filters.profitMode, filters.profitValue)) return false;
      if (!filterByRangeMode(offer.marginPct, filters.marginMode, filters.marginValue)) return false;
      return true;
    });

    return sortOffers(result, filters.sortBy);
  }, [snapshot.opportunities, appliedFilters]);

  const visibleOffers = filtered.slice(0, visibleLimit);
  const emptyState = getOpportunityEmptyState({
    total: snapshot.opportunities.length,
    filtered: filtered.length,
    hasFilters: hasActiveFilters(appliedFilters)
  });
  const bestProfit = filtered.reduce((best, offer) => Math.max(best, offer.netProfit), 0);
  const avgMargin = filtered.length
    ? filtered.reduce((sum, offer) => sum + offer.marginPct, 0) / filtered.length
    : 0;
  const realQuantityCount = snapshot.opportunityStats.realQuantity ?? snapshot.opportunities.filter((offer) => offer.hasOrderQuantities).length;
  const estimatedCount = snapshot.opportunityStats.estimated ?? snapshot.opportunities.filter((offer) => !offer.hasOrderQuantities).length;
  const lastUpdated = snapshot.generatedAt ? new Date(snapshot.generatedAt).toLocaleTimeString() : "-";
  const dataStatusRows = getDataSourceStatusRows(snapshot.dataSourceStatus);

  const refreshApi = async () => {
    setIsRefreshing(true);
    setPollError(null);

    try {
      const response = await fetch(`${apiBase}/api/refresh`, { method: "POST" });
      const payload = await readJsonResponse(response, "Falha ao recarregar API");
      ingestSnapshot(payload.snapshot);
    } catch (error) {
      setPollError({ title: "Falha ao atualizar dados", message: error.message });
    } finally {
      setIsRefreshing(false);
    }
  };

  const runOfferAction = async ({ offer, endpoint, body, successMessage, removeFromList = false }) => {
    setActionMessage(null);
    setPendingOfferKeys((current) => new Set([...current, offer.offerKey]));

    try {
      const response = await fetch(`${apiBase}${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) throw new Error(payload.message || "Acao nao concluida");

      if (payload.snapshot) ingestSnapshot(payload.snapshot);
      if (removeFromList && !payload.snapshot) {
        setSnapshot((current) => ({
          ...current,
          opportunities: current.opportunities.filter((item) => item.offerKey !== offer.offerKey)
        }));
      }
      setActionMessage({ type: "success", text: successMessage });
    } catch (error) {
      setActionMessage({ type: "error", text: error.message });
    } finally {
      setPendingOfferKeys((current) => {
        const next = new Set(current);
        next.delete(offer.offerKey);
        return next;
      });
    }
  };

  const save = (offer) => runOfferAction({
    offer,
    endpoint: "/api/offers/save",
    body: offer,
    successMessage: "Oferta salva no historico local.",
    removeFromList: true
  });

  const hide = (offer) => runOfferAction({
    offer,
    endpoint: "/api/offers/hide",
    body: { offerKey: offer.offerKey, ttlMinutes: 30 },
    successMessage: "Oferta escondida por 30 minutos.",
    removeFromList: true
  });

  const execute = (offer) => runOfferAction({
    offer,
    endpoint: "/api/offers/execute",
    body: { ...offer, ttlMinutes: 30 },
    successMessage: "Oferta marcada como executada e removida da lista.",
    removeFromList: true
  });

  const copyItemName = async (itemName) => {
    try {
      await copyTextToClipboard(itemName);
      setActionMessage({ type: "success", text: `"${itemName}" copiado para a area de transferencia.` });
    } catch (error) {
      setActionMessage({ type: "error", text: `Nao consegui copiar o nome do item: ${error.message}` });
    }
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setAppliedFilters({ ...draftFilters });
    setOpenPanel(null);
  };

  const clearFilters = () => {
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setOpenPanel(null);
  };

  const renderShell = (variantClass = "") => (
        <main className={variantClass ? `shell ${variantClass}` : "shell"}>
          <section className="topbar">
            <div>
              <span className="eyebrow">Caerleon to Black Market</span>
              <h1>Albion Codex V2</h1>
              <p>Comprar agora em Caerleon e vender agora no Black Market.</p>
            </div>
            <div className="status-card">
              <span className={`status-dot ${connectionStatus.toLowerCase()}`} aria-hidden="true" />
              <span>{connectionStatus}</span>
              <strong>{lastUpdated}</strong>
            </div>
          </section>

          <section className="summary" aria-label="Resumo operacional">
            <article>
              <span>Oportunidades</span>
              <strong>{filtered.length}</strong>
            </article>
            <article>
              <span>Melhor lucro</span>
              <strong>{formatCompactNumber(bestProfit)}</strong>
            </article>
            <article>
              <span>Margem media</span>
              <strong>{formatPercent(avgMargin)}</strong>
            </article>
            <article>
              <span>Com qtd real</span>
              <strong>{realQuantityCount}</strong>
            </article>
            <article>
              <span>Status dados</span>
              <div className="status-summary">
                {dataStatusRows.map((row) => (
                  <strong key={row.key} className={row.tone}>
                    {row.label}
                    <small>{row.detail}</small>
                  </strong>
                ))}
              </div>
            </article>
          </section>

          {estimatedCount > 0 && appliedFilters.realOnly && (
            <section className="notice action-notice success" role="status" aria-live="polite">
              <strong>{estimatedCount} estimada(s) ocultas</strong>
              <span>Desligue "Apenas qtd real" para ver oportunidades baseadas no snapshot REST.</span>
            </section>
          )}

          {pollError && (
            <section className="notice" role="alert">
              <strong>{pollError.title}</strong>
              <span>{pollError.message}</span>
            </section>
          )}

          {actionMessage && (
            <section className={`notice action-notice ${actionMessage.type}`} role={actionMessage.type === "success" ? "status" : "alert"} aria-live="polite">
              <strong>{actionMessage.type === "success" ? "Acao concluida" : "Falha na acao"}</strong>
              <span>{actionMessage.text}</span>
            </section>
          )}

          <form className={`filters ${filtersVisible ? "" : "filters-collapsed"}`} onSubmit={applyFilters}>
            <div className="filter-heading">
              <h2>Filtros</h2>
              <div className="filter-actions">
                <button type="button" onClick={refreshApi} disabled={isRefreshing} aria-busy={isRefreshing}>
                  {isRefreshing ? "Recarregando..." : "Recarregar API"}
                </button>
                <button type="submit" className="primary-action">Aplicar</button>
                <button type="button" onClick={clearFilters}>Limpar filtros</button>
                <button type="button" onClick={() => setFiltersVisible((value) => !value)}>
                  {filtersVisible ? "Ocultar filtros" : "Mostrar filtros"}
                </button>
              </div>
            </div>

            {filtersVisible && (
              <>
                <div className="advanced-filter-grid">
                  <div className="autocomplete">
                    <label className="filter-label">Nome do item</label>
                    <input
                      placeholder="Item"
                      value={draftFilters.item}
                      onBlur={() => setIsItemSuggestionsOpen(false)}
                      onChange={(event) => {
                        setDraftFilters({ ...draftFilters, item: event.target.value });
                        setIsItemSuggestionsOpen(true);
                      }}
                      onFocus={() => setIsItemSuggestionsOpen(true)}
                    />
                    {isItemSuggestionsOpen && itemSuggestions.length > 0 && (
                      <div className="suggestions">
                        {itemSuggestions.map((item) => (
                          <ItemSuggestion
                            key={item.itemId}
                            itemId={item.itemId}
                            onSelect={(selectedItem) => {
                              setDraftFilters({ ...draftFilters, item: selectedItem.displayName });
                              setIsItemSuggestionsOpen(false);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="filter-picker">
                    <label className="filter-label">Categoria</label>
                    <button
                      type="button"
                      aria-controls="category-panel"
                      aria-expanded={openPanel === "categories"}
                      className="picker-button"
                      onClick={() => setOpenPanel(openPanel === "categories" ? null : "categories")}
                    >
                      <span>{summarizeCategories(draftFilters.categories)}</span>
                      <b>CAT</b>
                    </button>
                    {openPanel === "categories" && (
                      <CategoryPanel
                        id="category-panel"
                        values={draftFilters.categories}
                        onToggle={(category) => setDraftFilters({ ...draftFilters, categories: toggleValue(draftFilters.categories, category) })}
                      />
                    )}
                  </div>

                  <div className="filter-picker">
                    <label className="filter-label">Tier e encantamento</label>
                    <button
                      type="button"
                      aria-controls="tier-enchantment-panel"
                      aria-expanded={openPanel === "tiers"}
                      className="picker-button"
                      onClick={() => setOpenPanel(openPanel === "tiers" ? null : "tiers")}
                    >
                      <span>{summarizeNumbers("T", draftFilters.tiers)} | {summarizeNumbers("Enc", draftFilters.enchantments)}</span>
                      <b>T/E</b>
                    </button>
                    {openPanel === "tiers" && (
                      <MultiSelectPanel
                        id="tier-enchantment-panel"
                        title="Multipla escolha"
                        leftTitle="Tier"
                        rightTitle="Encantamento"
                        leftOptions={tiers}
                        rightOptions={enchantments}
                        leftValues={draftFilters.tiers}
                        rightValues={draftFilters.enchantments}
                        onLeftToggle={(tier) => setDraftFilters({ ...draftFilters, tiers: toggleValue(draftFilters.tiers, tier) })}
                        onRightToggle={(enchantment) => setDraftFilters({ ...draftFilters, enchantments: toggleValue(draftFilters.enchantments, enchantment) })}
                      />
                    )}
                  </div>

                  <label className="field-group">
                    <span className="filter-label">Tempo maximo do preco</span>
                    <input type="number" min="0" value={draftFilters.maxAge} onChange={(event) => setDraftFilters({ ...draftFilters, maxAge: event.target.value })} />
                  </label>

                  <label className="field-group">
                    <span className="filter-label">Qtd minima nas ordens</span>
                    <input type="number" min="0" value={draftFilters.minQuantity} onChange={(event) => setDraftFilters({ ...draftFilters, minQuantity: event.target.value })} />
                  </label>

                  <label className="field-group switch-field">
                    <span className="filter-label">Filtro anti-fake</span>
                    <button
                      type="button"
                      aria-pressed={draftFilters.realOnly}
                      className={draftFilters.realOnly ? "toggle active" : "toggle"}
                      onClick={() => setDraftFilters({ ...draftFilters, realOnly: !draftFilters.realOnly })}
                    >
                      {draftFilters.realOnly ? "Apenas qtd real" : "Mostrar estimadas"}
                    </button>
                  </label>

                  <label className="field-group">
                    <span className="filter-label">Ordenar resultado</span>
                    <select value={draftFilters.sortBy} onChange={(event) => setDraftFilters({ ...draftFilters, sortBy: event.target.value })}>
                      <option value="netProfit">Lucro total</option>
                      <option value="buyAge">Tempo da compra</option>
                      <option value="sellAge">Tempo da venda</option>
                      <option value="marginPct">Profit %</option>
                    </select>
                  </label>
                </div>

                <div className="range-grid">
                  <div className="range-filter">
                    <div className="range-top">
                      <span>Lucro</span>
                      <div>
                        <button type="button" aria-pressed={draftFilters.profitMode === "min"} className={draftFilters.profitMode === "min" ? "active" : ""} onClick={() => setDraftFilters({ ...draftFilters, profitMode: "min" })}>Min</button>
                        <button type="button" aria-pressed={draftFilters.profitMode === "max"} className={draftFilters.profitMode === "max" ? "active" : ""} onClick={() => setDraftFilters({ ...draftFilters, profitMode: "max" })}>Max</button>
                      </div>
                      <strong>{formatCompactNumber(draftFilters.profitValue || 0)}</strong>
                    </div>
                    <input aria-label="Valor de lucro" type="range" min="0" max={maxProfitSlider} step="100" value={draftFilters.profitValue || 0} onChange={(event) => setDraftFilters({ ...draftFilters, profitValue: event.target.value })} />
                  </div>

                  <div className="range-filter">
                    <div className="range-top">
                      <span>Lucro (%)</span>
                      <div>
                        <button type="button" aria-pressed={draftFilters.marginMode === "min"} className={draftFilters.marginMode === "min" ? "active" : ""} onClick={() => setDraftFilters({ ...draftFilters, marginMode: "min" })}>Min</button>
                        <button type="button" aria-pressed={draftFilters.marginMode === "max"} className={draftFilters.marginMode === "max" ? "active" : ""} onClick={() => setDraftFilters({ ...draftFilters, marginMode: "max" })}>Max</button>
                      </div>
                      <strong>{draftFilters.marginValue || 0}%+</strong>
                    </div>
                    <input aria-label="Valor de lucro percentual" type="range" min="0" max={maxMarginSlider} step="1" value={draftFilters.marginValue || 0} onChange={(event) => setDraftFilters({ ...draftFilters, marginValue: event.target.value })} />
                  </div>
                </div>
              </>
            )}
          </form>

          <section className="grid-wrap">
            <div className="table-title">
              <div>
                <h2>Oportunidades lucrativas</h2>
                <p>Calculadas apenas quando ha quantidade real nas duas pontas.</p>
              </div>
              <span className="table-meta">Mostrando {visibleOffers.length} de {filtered.length}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Comprar agora</th>
                  <th scope="col">Vender agora</th>
                  <th scope="col">Fee</th>
                  <th scope="col">Qtd</th>
                  <th scope="col">Lucro</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td className="empty-state" colSpan="6">
                      {isInitialLoading ? (
                        <div className="loading-state" aria-live="polite">
                          <span />
                          <span />
                          <span />
                          <strong>Carregando oportunidades</strong>
                        </div>
                      ) : (
                        <>
                          <strong>{emptyState.title}</strong>
                          <span>{emptyState.detail}</span>
                        </>
                      )}
                    </td>
                  </tr>
                ) : visibleOffers.map((offer, index) => {
                  const isPending = pendingOfferKeys.has(offer.offerKey);

                  return (
                    <tr key={`${offer.offerKey}-${index}`} aria-busy={isPending}>
                      <td data-label="Item"><OpportunityItemCell offer={offer} onCopyName={copyItemName} /></td>
                      <td data-label="Comprar agora">
                        <MoneyCell
                          ageMinutes={offer.originAgeMinutes ?? offer.buyAgeMinutes}
                          city={offer.originCity || offer.sourceCity}
                          kind={getBuyKindLabel(offer.buyKind || "instant_buy")}
                          price={offer.unitCost}
                          quantity={offer.originQuantity ?? "-"}
                        />
                      </td>
                      <td data-label="Vender agora">
                        <MoneyCell
                          ageMinutes={offer.destinationAgeMinutes ?? offer.sellAgeMinutes}
                          city={offer.destinationCity}
                          kind={getSellKindLabel(offer.sellKind || "instant_sell")}
                          price={offer.unitRevenue}
                          quantity={offer.destinationQuantity ?? "-"}
                        />
                      </td>
                      <td data-label="Fee"><FeeCell offer={offer} /></td>
                      <td data-label="Qtd" className="quantity-cell">{offer.quantity}</td>
                      <td data-label="Lucro" className="profit-cell">
                        <strong>+{formatSilver(offer.netProfit)}</strong>
                        <span>{offer.marginPct.toFixed(2)}% lucro</span>
                        <div className="row-actions" aria-label="Acoes da oportunidade">
                          <button type="button" disabled={isPending} onClick={() => save(offer)}>{isPending ? "..." : "Salvar"}</button>
                          <button type="button" disabled={isPending} onClick={() => hide(offer)}>{isPending ? "..." : "Esgotado"}</button>
                          <button type="button" className="execute-action" disabled={isPending} onClick={() => execute(offer)}>{isPending ? "..." : "Executar"}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visibleOffers.length < filtered.length && (
              <div className="table-more">
                <button type="button" onClick={() => setVisibleLimit((limit) => limit + pageSize)}>
                  Mostrar mais oportunidades
                </button>
              </div>
            )}
          </section>

          <MarketDiagnostics diagnostics={snapshot.marketDiagnostics} />
        </main>
  );

  return renderShell("dracula-regal");
}

createRoot(document.getElementById("root")).render(<App />);
