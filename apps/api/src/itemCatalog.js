import { classifyItemId, isDefaultCatalogItemId } from "../../shared/itemClassification.js";
import { itemNamesById } from "../../shared/itemNames.generated.js";

export const TIERS = [1, 2, 3, 4, 5, 6, 7, 8];
export const ENCHANTMENTS = [0, 1, 2, 3, 4];
export const QUALITIES = [1, 2, 3, 4, 5];

export function parseItemId(itemId) {
  const [plainItemId, enchantmentRaw] = String(itemId).split("@");
  const match = plainItemId.match(/^T(\d+)_(.+)$/);

  return {
    tier: match ? Number(match[1]) : null,
    base: match ? match[2] : plainItemId,
    enchantment: enchantmentRaw ? Number(enchantmentRaw) : 0
  };
}

export function getItemMetadata(itemId) {
  const parsed = parseItemId(itemId);
  const officialName = itemNamesById[itemId];
  const enchantment = parsed.enchantment > 0 ? `.${parsed.enchantment}` : ".0";
  const fallbackName = parsed.tier ? `T${parsed.tier}${enchantment} ${parsed.base.replaceAll("_", " ")}` : parsed.base.replaceAll("_", " ");

  return {
    itemId,
    base: parsed.base,
    tier: parsed.tier,
    enchantment: parsed.enchantment,
    category: classifyItemId(itemId),
    displayName: officialName || fallbackName,
    iconUrl: `https://render.albiononline.com/v1/item/${encodeURIComponent(itemId)}.png`
  };
}

export function getDefaultV2ItemIds() {
  return Object.keys(itemNamesById).filter(isDefaultCatalogItemId);
}

export function getDefaultV2Items() {
  return getDefaultV2ItemIds().map(getItemMetadata);
}
