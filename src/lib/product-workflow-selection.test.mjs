import assert from "node:assert/strict";
import test from "node:test";
import { replaceRelatedSelection, scopedCommissionRule, commissionBranchRows } from "./product-workflow-selection.ts";

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

test("Saving a commission branch includes only its program and current variant IDs", () => {
  const rows = [
    { variant_id: "A", program_id: "affiliate", commission_value: 5 },
    { variant_id: "B", program_id: "affiliate", commission_value: 6 },
    { variant_id: "A", program_id: "other", commission_value: 24 },
    { variant_id: "deleted", program_id: "affiliate", commission_value: 99 },
  ];
  assert.deepEqual(commissionBranchRows(rows, "affiliate", ["A", "B"]), rows.slice(0, 2));
  assert.deepEqual(commissionBranchRows(rows, "other", ["A"]), [rows[2]]);
});

for (const [buyer, expected] of [["customer", 5], ["retailer", 6], ["distributor", 24]]) {
  test(`${buyer} loads its own commission, cap and active status without fallback`, () => {
    const row = { commission_value: 5, max_commission: 50, is_active: true, scoped_rules: {
      "retailer:retailer": { commission_value: 6, max_commission: 60, is_active: false },
      "distributor:distributor": { commission_value: 24, max_commission: 240, is_active: true },
    }};
    const selected = scopedCommissionRule(row, buyer, "customer");
    assert.equal(selected.commission_value, expected);
    assert.equal(selected.max_commission, expected * 10);
    assert.equal(selected.is_active, buyer !== "retailer");
    if (buyer !== "customer") assert.equal(scopedCommissionRule({ scoped_rules: {} }, buyer, "customer"), undefined);
  });
}