import assert from "node:assert/strict";
import test from "node:test";
import {
  PRODUCT_MASTER_COLUMNS,
  PRODUCT_MASTER_DETAIL_HEADERS,
  PRODUCT_MASTER_SERIALS,
  PRODUCT_MASTER_TOP_HEADERS,
  bulkColumnValue,
} from "./bulk-product-columns.ts";

test("Product Master master-reference columns remain exactly 1 through 70", () => {
  assert.equal(PRODUCT_MASTER_COLUMNS.length, 70);
  assert.deepEqual(PRODUCT_MASTER_SERIALS, Array.from({ length: 70 }, (_, index) => index + 1));
  assert.equal(new Set(PRODUCT_MASTER_COLUMNS.map((column) => column.key)).size, 70);
});

test("every bulk field reads from its exact Excel serial position", () => {
  const uniqueRow = Array.from({ length: 70 }, (_, index) => `COLUMN_${index + 1}`);
  for (const column of PRODUCT_MASTER_COLUMNS) {
    assert.equal(
      bulkColumnValue(uniqueRow, column.key),
      `COLUMN_${column.serial}`,
      `${column.key} must map to Excel column ${column.serial}`,
    );
  }
});

test("master reference group/detail headers keep their exact positions", () => {
  assert.equal(PRODUCT_MASTER_TOP_HEADERS[0], "Sr No");
  assert.equal(PRODUCT_MASTER_TOP_HEADERS[23], "Refundable \n(YES/NO)");
  assert.equal(PRODUCT_MASTER_TOP_HEADERS[26], "Single PC Details");
  assert.equal(PRODUCT_MASTER_DETAIL_HEADERS[26], "MRP");
  assert.equal(PRODUCT_MASTER_TOP_HEADERS[31], "Details For Customer's");
  assert.equal(PRODUCT_MASTER_DETAIL_HEADERS[41], "Retailer’s Discount");
  assert.equal(PRODUCT_MASTER_DETAIL_HEADERS[51], "Distributor’s Discount");
  assert.equal(PRODUCT_MASTER_TOP_HEADERS[61], "Commission Details");
  assert.equal(PRODUCT_MASTER_DETAIL_HEADERS[65], "SEO Meta Title");
  assert.equal(PRODUCT_MASTER_TOP_HEADERS[69], "Frequently Bought Category");
});
