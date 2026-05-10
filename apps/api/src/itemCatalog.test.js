import assert from "node:assert/strict";
import test from "node:test";
import {
  getItemMetadata,
  getDefaultV2ItemIds,
  parseItemId
} from "./itemCatalog.js";

test("generates a broad filtered catalog from real tiered Albion item ids", () => {
  const items = getDefaultV2ItemIds();

  assert.ok(items.length > 1000);
  assert.ok(items.includes("T8_MAIN_SWORD@4"));
  assert.ok(items.includes("T4_ARMOR_PLATE_SET1"));
  assert.ok(items.includes("T4_BAG"));
  assert.ok(items.includes("T5_CAPE@3"));
  assert.ok(items.includes("T4_POTION_HEAL"));
  assert.ok(items.includes("T1_WOOD"));
  assert.ok(items.includes("T4_ARTEFACT_2H_ARCANESTAFF_HELL"));
  assert.ok(!items.includes("T1_SILVERBAG_NONTRADABLE"));
  assert.ok(!items.includes("T4_JOURNAL_HUNTER_EMPTY"));
  assert.ok(!items.some((itemId) => itemId.startsWith("QUESTITEM_")));
});

test("parses tier, base and enchantment from item ids", () => {
  assert.deepEqual(parseItemId("T7_2H_BOW@4"), {
    tier: 7,
    base: "2H_BOW",
    enchantment: 4
  });

  assert.deepEqual(parseItemId("T4_HEAD_CLOTH_SET2"), {
    tier: 4,
    base: "HEAD_CLOTH_SET2",
    enchantment: 0
  });
});

test("uses official Albion dump names for item metadata", () => {
  assert.equal(getItemMetadata("T8_MAIN_SWORD@4").displayName, "Espada Larga do Ancião");
  assert.equal(getItemMetadata("T8_2H_DAGGER_KATAR_AVALON@4").displayName, "Fúria Contida do Ancião");
});

test("classifies broad catalog item categories", () => {
  assert.equal(getItemMetadata("T8_MAIN_SWORD@4").category, "equipment");
  assert.equal(getItemMetadata("T4_BAG").category, "bag_cape");
  assert.equal(getItemMetadata("T5_CAPE@3").category, "bag_cape");
  assert.equal(getItemMetadata("T4_POTION_HEAL").category, "consumable");
  assert.equal(getItemMetadata("T1_WOOD").category, "resource");
  assert.equal(getItemMetadata("T4_ARTEFACT_2H_ARCANESTAFF_HELL").category, "artifact");
});
