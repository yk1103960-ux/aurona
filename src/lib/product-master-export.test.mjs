import assert from "node:assert/strict";
import test from "node:test";
import { productMasterExportRows, segmentSinglePieceRows } from "./product-master-export.ts";

function row(variant) {
  const result = productMasterExportRows({
    families: [{ id: "family", name: "Test", axes: [], variants: [{ id: "variant", sku: "TEST", is_active: true, ...variant }] }],
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

test("Each buyer exports its own saved MRP and single-piece measurements", () => {
  const data = { families: [{ axes: [], variants: [{id: "A", sku: "A", is_active: true, mrp: 500, weight_g: 10, dim_l: 11, dim_w: 12, dim_h: 13, retailer_mrp: 450, retailer_weight_g: 20, retailer_dim_l: 21, retailer_dim_w: 22, retailer_dim_h: 23, distributor_mrp: 400, distributor_weight_g: 30, distributor_dim_l: 31, distributor_dim_w: 32, distributor_dim_h: 33}] }], commissions: [], programs: [] };
  assert.deepEqual(segmentSinglePieceRows(data).map(row => row.slice(2)), [["customer",500,10,11,12,13],["retailer",450,20,21,22,23],["distributor",400,30,31,32,33]]);
});

test("Inactive and archived variants and archived products never export", () => {
  const variants = [{id:"A",sku:"A",is_active:true},{id:"B",sku:"B",is_active:false},{id:"C",sku:"C",is_active:true,archived_at:"2026-01-01"}];
  const data = {families:[{axes:[],variants},{axes:[],variants,archived_at:"2026-01-01"}],commissions:[],programs:[]};
  assert.deepEqual(productMasterExportRows(data).rows.map(row => row[10]), ["A"]);
  assert.equal(segmentSinglePieceRows(data).length,3);
});