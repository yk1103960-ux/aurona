import assert from "node:assert/strict";
import test from "node:test";
import { productMasterExportRows } from "./product-master-export.ts";

function row(variant) {
  const result = productMasterExportRows({
    families: [{ id: "family", name: "Test", axes: [], variants: [{ id: "variant", sku: "TEST", ...variant }] }],
    commissions: [], programs: [],
  });
  return Object.fromEntries(result.columns.map((column, index) => [column.key, result.rows[0][index]]));
}

test("Product Master shows saved buyer values and derives each buyer's discount", () => {
  const values = row({ mrp: 200, price: 100, retailer_mrp: 300, retailer_price: 225,
    distributor_mrp: 400, distributor_price: 240, retailer_pack_size: 60, distributor_pack_size: 120 });
  assert.equal(values.customer_discount, 50);
  assert.equal(values.retailer_discount, 25);
  assert.equal(values.distributor_discount, 40);
  assert.equal(values.retailer_pack_size, 60);
  assert.equal(values.distributor_pack_size, 120);
});

test("Missing buyer details are not invented from customer data", () => {
  const values = row({ mrp: 200, price: 100, retailer_price: 50, pack_size: 6, pack_weight_g: 900 });
  assert.equal(values.retailer_discount, "");
  assert.equal(values.retailer_pack_size, "");
  assert.equal(values.retailer_pack_weight_g, "");
  assert.equal(values.distributor_price, "");
});

test("Saved zeros are preserved and a zero selling price gives a full discount", () => {
  const values = row({ retailer_mrp: 100, retailer_price: 0, retailer_stock: 0, distributor_discount_pct: 0 });
  assert.equal(values.retailer_price, 0);
  assert.equal(values.retailer_stock, 0);
  assert.equal(values.retailer_discount, 100);
  assert.equal(values.distributor_discount, 0);
});