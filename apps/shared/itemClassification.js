export const itemCategoryOptions = Object.freeze([
  { key: "equipment", label: "Equipamentos" },
  { key: "bag_cape", label: "Bolsas/capas" },
  { key: "mount", label: "Montarias" },
  { key: "consumable", label: "Consumiveis" },
  { key: "resource", label: "Recursos" },
  { key: "artifact", label: "Artefatos" },
  { key: "other", label: "Outros" }
]);

const excludedItemPattern = /(?:NONTRADABLE|QUESTITEM|JOURNAL|TOKEN|TUTORIAL|DEBUG|TEST|SKIN|FURNITURE|PLAYERISLAND|GUILDISLAND|SILVERBAG|TRASH|UNIQUE)/;

const categoryPatterns = [
  ["artifact", /^T[1-8]_ARTEFACT_/],
  ["bag_cape", /^T[1-8]_(?:BAG|CAPE)(?:_|@|$)/],
  ["mount", /^T[1-8]_(?:MOUNT|MOUNTUPGRADE|FARM_.*_(?:BABY|GROWN))(?:_|@|$)/],
  ["consumable", /^T[1-8]_(?:MEAL|POTION|FISH|FISHCHOPS|FISHSAUCE|ALCOHOL)(?:_|@|$)/],
  ["resource", /^T[1-8]_(?:WOOD|ROCK|ORE|HIDE|FIBER|PLANKS|STONEBLOCK|METALBAR|LEATHER|CLOTH|ESSENCE|RUNE|SOUL|RELIC)(?:_|@|$)/],
  ["equipment", /^T[1-8]_(?:MAIN|2H|OFF|ARMOR|HEAD|SHOES)(?:_|@|$)/]
];

export function isTieredItemId(itemId) {
  return /^T[1-8]_/.test(String(itemId || ""));
}

export function isDefaultCatalogItemId(itemId) {
  const normalized = String(itemId || "");
  return isTieredItemId(normalized) && !excludedItemPattern.test(normalized);
}

export function classifyItemId(itemId) {
  const normalized = String(itemId || "");
  for (const [category, pattern] of categoryPatterns) {
    if (pattern.test(normalized)) return category;
  }
  return "other";
}

export function getItemCategoryLabel(category) {
  return itemCategoryOptions.find((option) => option.key === category)?.label || "Outros";
}
