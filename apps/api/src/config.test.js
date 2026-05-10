import assert from "node:assert/strict";
import test from "node:test";
import { config } from "./config.js";

test("uses Albion's current 8 percent market sales tax by default", () => {
  assert.equal(config.salesTaxRate, 0.08);
});
