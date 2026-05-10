import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

test("places opportunities before diagnostics in the decision flow", () => {
  assert.ok(appSource.indexOf('className="grid-wrap"') < appSource.indexOf("<MarketDiagnostics"));
});

test("uses explicit button classes instead of last-child to mark primary filter actions", () => {
  assert.match(appSource, /className="[^"]*\bprimary-action\b/);
  assert.doesNotMatch(stylesSource, /button:last-child/);
});

test("exposes custom filter controls with aria state", () => {
  assert.match(appSource, /aria-expanded=\{openPanel === "tiers"\}/);
  assert.match(appSource, /aria-controls="tier-enchantment-panel"/);
  assert.match(appSource, /aria-pressed=\{draftFilters\.realOnly\}/);
  assert.match(appSource, /aria-pressed=\{draftFilters\.profitMode === "min"\}/);
});

test("hardens live updates and async loading states", () => {
  assert.match(appSource, /function readJsonResponse/);
  assert.match(appSource, /new AbortController\(\)/);
  assert.match(appSource, /controller\.abort\(\)/);
  assert.match(appSource, /JSON\.parse\(event\.data\)/);
  assert.match(appSource, /Snapshot invalido/);
  assert.match(appSource, /role="alert"/);
  assert.match(appSource, /aria-live="polite"/);
});

test("labels range sliders and table headers semantically", () => {
  assert.match(appSource, /aria-label="Valor de lucro"/);
  assert.match(appSource, /aria-label="Valor de lucro percentual"/);
  assert.equal((appSource.match(/scope="col"/g) || []).length, 6);
});

test("keeps touch targets usable and adapts the table on small screens", () => {
  assert.match(stylesSource, /\.row-actions button[\s\S]*?min-height: 36px;/);
  assert.match(stylesSource, /\.table-more button[\s\S]*?min-height: 44px;/);
  assert.match(stylesSource, /@media \(max-width: 720px\)[\s\S]*?table[\s\S]*?min-width: 0;/);
  assert.match(stylesSource, /@media \(max-width: 720px\)[\s\S]*?td::before/);
});
