import assert from "node:assert/strict";
import test from "node:test";
import { requiredDynamicRowErrors } from "./bulk-import-required.ts";

const valid = {
  excel_row: 18, function: "create", category_name: "Ceiling Fans",
  product_name: "Test Fan", main_sku: "CF-TEST", variant_sku: "CF-TEST-WHITE",
  mrp: 1799, customer_price: 1020, customer_stock: 0, active_status: "Active",
  variation_cells: [{ name: "Body Colour", value: "White" }],
  variation_axes: [{ name: "Body Colour", value: "White" }],
};

test("required fields reject blanks with Excel row and product identity", () => {
  for (const [key, label] of [
    ["main_sku", "Main SKU"], ["mrp", "MRP"],
    ["customer_price", "Customer Price"], ["customer_stock", "Customer Stock"],
    ["active_status", "Status"],
  ]) {
    const errors = requiredDynamicRowErrors({ ...valid, [key]: "   " });
    assert.ok(errors.some((error) => error.includes(`Row 18 — ${label} is required and cannot be blank`) && error.includes("Test Fan")), key);
  }
});

test("zero stock and optional blank fields are accepted", () => {
  assert.deepEqual(requiredDynamicRowErrors({ ...valid, retailer_price: null, retailer_stock: null, warranty: "" }), []);
});

test("missing variation value and configured buyer stock are blocked", () => {
  const errors = requiredDynamicRowErrors({ ...valid, variation_cells: [{ name: "Body Colour", value: "  " }], variation_axes: [], retailer_price: 900, retailer_stock: null });
  assert.ok(errors.some((error) => error.includes("Variation Value is required")));
  assert.ok(errors.some((error) => error.includes("Retailer Stock is required")));
});

test("Update requires existing core values but allows optional status to remain blank", () => {
  const row = { ...valid, function: "update", active_status: "", customer_price: null };
  assert.deepEqual(requiredDynamicRowErrors(row), [
    "Row 18 — Customer Price is required and cannot be blank (Test Fan / CF-TEST).",
  ]);
});
