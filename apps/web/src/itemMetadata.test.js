import assert from "node:assert/strict";
import test from "node:test";
import { getItemMetadata } from "./itemMetadata.js";

test("uses official Albion dump names for known and artifact items", () => {
  assert.equal(getItemMetadata("T8_MAIN_SWORD@4").displayName, "Espada Larga do Ancião");
  assert.equal(getItemMetadata("T8_2H_DAGGER_KATAR_AVALON@4").displayName, "Fúria Contida do Ancião");
});

test("classifies broad item metadata categories", () => {
  assert.equal(getItemMetadata("T4_BAG").category, "bag_cape");
  assert.equal(getItemMetadata("T5_CAPE@3").category, "bag_cape");
  assert.equal(getItemMetadata("T4_POTION_HEAL").category, "consumable");
  assert.equal(getItemMetadata("T1_WOOD").category, "resource");
});
