import assert from "node:assert/strict";
import test from "node:test";
import { replaceRelatedSelection, scopedCommissionRule } from "./product-workflow-selection.ts";

test("Frequently bought category selection replaces old selections", () => {
  let selected = ["old-A", "old-B"];
  selected = replaceRelatedSelection(["new-A", "new-A", "new-B"]);
  assert.deepEqual(selected, ["new-A", "new-B"]);
});

test("Commission configurations resolve only the chosen buyer and customer role", () => {
  const row = { commission_value: 5, scoped_rules: { "retailer:retailer": { commission_value: 6 }, "distributor:distributor": { commission_value: 24 }, "customer:staff": { commission_value: 7 } } };
  assert.equal(scopedCommissionRule(row, "customer", "customer"), row);
  assert.deepEqual(scopedCommissionRule(row, "retailer", "customer"), { commission_value: 6 });
  assert.deepEqual(scopedCommissionRule(row, "distributor", "customer"), { commission_value: 24 });
  assert.deepEqual(scopedCommissionRule(row, "customer", "staff"), { commission_value: 7 });
  assert.equal(scopedCommissionRule(row, "customer", "admin"), undefined);
});