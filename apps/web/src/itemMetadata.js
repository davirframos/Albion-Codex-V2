import { itemNamesById } from "../../shared/itemNames.generated.js";
import { classifyItemId } from "../../shared/itemClassification.js";

const iconBaseUrl = "https://render.albiononline.com/v1/item";

const tierNames = {
  1: "Iniciante",
  2: "Novato",
  3: "Aprendiz",
  4: "Adepto",
  5: "Perito",
  6: "Mestre",
  7: "Grao-mestre",
  8: "Anciao"
};

const itemBaseNames = {
  ARMOR_LEATHER_SET1: "Jaqueta de Mercenario",
  ARMOR_LEATHER_SET2: "Jaqueta de Cacador",
  ARMOR_LEATHER_SET3: "Jaqueta de Assassino",
  ARMOR_PLATE_SET1: "Armadura de Soldado",
  ARMOR_PLATE_SET2: "Armadura de Cavaleiro",
  ARMOR_PLATE_SET3: "Armadura de Guardiao",
  ARMOR_CLOTH_SET1: "Robe de Erudito",
  ARMOR_CLOTH_SET2: "Robe de Clerigo",
  ARMOR_CLOTH_SET3: "Robe de Mago",
  HEAD_LEATHER_SET1: "Capuz de Mercenario",
  HEAD_LEATHER_SET2: "Capuz de Cacador",
  HEAD_LEATHER_SET3: "Capuz de Assassino",
  HEAD_PLATE_SET1: "Capacete de Soldado",
  HEAD_PLATE_SET2: "Capacete de Cavaleiro",
  HEAD_PLATE_SET3: "Capacete de Guardiao",
  HEAD_CLOTH_SET1: "Capuz de Erudito",
  HEAD_CLOTH_SET2: "Capuz de Clerigo",
  HEAD_CLOTH_SET3: "Capuz de Mago",
  SHOES_LEATHER_SET1: "Sapatos de Mercenario",
  SHOES_LEATHER_SET2: "Sapatos de Cacador",
  SHOES_LEATHER_SET3: "Sapatos de Assassino",
  SHOES_PLATE_SET1: "Botas de Soldado",
  SHOES_PLATE_SET2: "Botas de Cavaleiro",
  SHOES_PLATE_SET3: "Botas de Guardiao",
  SHOES_CLOTH_SET1: "Sandalias de Erudito",
  SHOES_CLOTH_SET2: "Sandalias de Clerigo",
  SHOES_CLOTH_SET3: "Sandalias de Mago",
  MAIN_FIRESTAFF: "Cajado de Fogo",
  "2H_FIRESTAFF": "Cajado Infernal",
  MAIN_ARCANESTAFF: "Cajado Arcano",
  "2H_ARCANESTAFF": "Cajado Arcano Elevado",
  MAIN_HOLYSTAFF: "Cajado Sagrado",
  "2H_HOLYSTAFF": "Cajado Divino",
  MAIN_CURSESTAFF: "Cajado Amaldicoado",
  "2H_CURSESTAFF": "Cajado Amaldicoado Grande",
  MAIN_FROSTSTAFF: "Cajado de Gelo",
  "2H_FROSTSTAFF": "Cajado Glacial",
  MAIN_NATURESTAFF: "Cajado da Natureza",
  "2H_NATURESTAFF": "Cajado Selvagem",
  MAIN_SWORD: "Espada Larga",
  "2H_CLAYMORE": "Claymore",
  MAIN_DUALSWORD: "Espadas Duplas",
  MAIN_AXE: "Machado de Guerra",
  "2H_AXE": "Machado Grande",
  "2H_HALBERD": "Alabarda",
  MAIN_MACE: "Maca",
  "2H_MACE": "Maca Pesada",
  "2H_HAMMER": "Martelo Grande",
  "2H_BOW": "Arco",
  "2H_WARBOW": "Arco de Guerra",
  "2H_LONGBOW": "Arco Longo",
  MAIN_CROSSBOW: "Besta",
  "2H_CROSSBOW": "Besta Pesada",
  MAIN_QUARTERSTAFF: "Bastao",
  "2H_IRONCLADEDSTAFF": "Bastao Revestido de Ferro"
};

const metadataCache = new Map();

function parseItemId(itemId) {
  const [baseId, enchantmentRaw] = String(itemId).split("@");
  const match = baseId.match(/^T(\d+)_(.+)$/);

  return {
    tier: match ? Number(match[1]) : null,
    base: match ? match[2] : baseId,
    enchantment: enchantmentRaw ? Number(enchantmentRaw) : 0
  };
}

export function getQualityName(quality) {
  const qualityNames = {
    1: "Normal",
    2: "Bom",
    3: "Excepcional",
    4: "Excelente",
    5: "Obra-prima"
  };

  return qualityNames[quality] || "Normal";
}

export function getItemMetadata(itemId) {
  if (metadataCache.has(itemId)) return metadataCache.get(itemId);

  const { tier, base, enchantment } = parseItemId(itemId);
  const officialName = itemNamesById[itemId];
  const baseName = officialName || itemBaseNames[base] || base.replaceAll("_", " ");
  const tierName = tierNames[tier];
  const enchantmentLabel = enchantment > 0 ? ` Enc.${enchantment}` : "";
  const displayName = officialName || (tierName ? `${baseName} do ${tierName}${enchantmentLabel}` : `${baseName}${enchantmentLabel}`);

  const metadata = {
    itemId,
    tier,
    enchantment,
    base,
    category: classifyItemId(itemId),
    displayName,
    iconUrl: `${iconBaseUrl}/${encodeURIComponent(itemId)}.png`
  };

  metadataCache.set(itemId, metadata);
  return metadata;
}
