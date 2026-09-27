import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  createBulkProductWorkbook,
  parseBulkProductWorkbook,
} from "./bulk-product-workbook.ts";
import {
  buildProductMasterColumnIndex,
  buildProductMasterColumns,
  PRODUCT_MASTER_COLUMNS,
  bulkColumnValue,
} from "./bulk-product-columns.ts";
import {
  generateVariationCombinations,
  variantName,
} from "./sku-generation.ts";
import { expectedBulkVariantSku } from "./bulk-product-identity.ts";

const MASTER_TOP_HEADERS = [
  "Sr No","Function","Product Category","Product Name","family_id","Main SKU","Brand Name","Unit","Model Name",
  "Variants Name","Variants SKU","variant_id","barcode","Variations 1 Name","Variation 1 Value","Variations 2 Name",
  "Variation 2 Value","Variations 3 Name","Variation 3 Value","attributes_json","Short Description","Description",
  "Key Features","Refundable \n(YES/NO)","Status (For Sale/ Deal )","Status (Active-True / Inactive-False)",
  "Single PC Details","","","","","Details For Customer's","","","","","","","","","","Details for Retailors",
  "","","","","","","","","","Details for Distributors","","","","","","","","","","Commission Details","","","",
  "SEO Details","","Shipping Estimated Days","Warranty","Frequently Bought Category",
];

const MASTER_DETAIL_HEADERS = [
  "","","","","","","","","","","","","","","","","","","","","","","","","","","MRP","Single PC’s Weight",
  "Single PC’s Length","Single PC’s Width","Single PC’s Height","Customer’s Discount","Customer’s Price","Customer’s MOQ",
  "Customer’s Stock","Customer’s Reserved Stock","Customer’s Pack Size","Customer’s Package’s Weight",
  "Customer’s Package’s Length","Customer’s Package’s Width","Customer’s Package’s Height","Retailer’s Discount",
  "Retailer’s Price","Retailer’s MOQ","Retailer’s Stock","Retailer’s Reserved Stock","Retailer’s Pack Size",
  "Retailer’s Package’s Weight","Retailer’s Package’s Length","Retailer’s Package’s Width","Retailer’s Package’s Height",
  "Distributor’s Discount","Distributor’s Price","Distributor’s MOQ","Distributor’s Stock","Distributor’s Reserved Stock",
  "Distributor’s Pack Size","Distributor’s Package’s Weight","Distributor’s Package’s Length","Distributor’s Package’s Width",
  "Distributor’s Package’s Height","Commission Set on","Commission Type","Commission Value","Max commission","SEO Meta Title",
  "SEO Description","","","",
];

function workbookFor(variations) {
  return createBulkProductWorkbook({
    categoryId: "00000000-0000-0000-0000-000000000001",
    categoryName: "Concealed Lights",
    productName: "Nexa",
    mainSku: "CL-NE",
    brandName: "AURONA",
    unit: "Pc",
    modelName: "NEXA",
    variations,
    combinations: generateVariationCombinations(variations),
  });
}

test("three variations remain exactly compatible with the supplied 70-column Product Master shape", () => {
  const variations = [
    { name: "Watt", values: ["5W"] },
    { name: "Output Colour", values: ["RED"] },
    { name: "Pack Size", values: ["6"] },
  ];
  const bytes = workbookFor(variations);
  const workbook = XLSX.read(bytes, { type: "array" });
  const sheet = workbook.Sheets["Product Master"];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });

  assert.equal(PRODUCT_MASTER_COLUMNS.length, 70);
  assert.equal(matrix[0].length, 70);
  assert.deepEqual(matrix[0], MASTER_TOP_HEADERS);
  assert.deepEqual(matrix[1], MASTER_DETAIL_HEADERS);
  assert.deepEqual(matrix[2], Array.from({ length: 70 }, (_, index) => index + 1));
});

test("2, 3 and 4 selected variations create exactly 2, 3 and 4 Name/Value pairs", () => {
  for (const variationCount of [2, 3, 4]) {
    const variations = Array.from({ length: variationCount }, (_, index) => ({
      name: `Option ${index + 1}`,
      values: [`Value ${index + 1}`],
    }));
    const bytes = workbookFor(variations);
    const workbook = XLSX.read(bytes, { type: "array" });
    const sheet = workbook.Sheets["Product Master"];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
    const expectedColumns = 64 + variationCount * 2;

    assert.equal(matrix[0].length, expectedColumns);
    assert.equal(matrix[1].length, expectedColumns);
    assert.equal(matrix[2].length, expectedColumns);

    const columns = buildProductMasterColumns(variationCount);
    const variationColumns = columns.filter((column) => /^variation_\d+_(?:name|value)$/.test(column.key));
    assert.equal(variationColumns.length, variationCount * 2);
    assert.deepEqual(
      variationColumns.map((column) => column.topHeader),
      Array.from({ length: variationCount }, (_, index) => [
        `Variations ${index + 1} Name`,
        `Variation ${index + 1} Value`,
      ]).flat(),
    );

    const parsed = parseBulkProductWorkbook(bytes);
    assert.equal(Number(parsed.metadata.variation_count), variationCount);
    assert.equal(parsed.metadata.column_keys.length, expectedColumns);
  }
});

test("dynamic variation columns shift later Product Master fields without changing their mapping", () => {
  for (const variationCount of [2, 3, 4]) {
    const columns = buildProductMasterColumns(variationCount);
    const index = buildProductMasterColumnIndex(columns);
    assert.equal(columns[index.mrp].detailHeader, "MRP");
    assert.equal(columns[index.customer_moq].detailHeader, "Customer’s MOQ");
    assert.equal(columns[index.customer_reserved_stock].detailHeader, "Customer’s Reserved Stock");
    assert.equal(columns[index.retailer_moq].detailHeader, "Retailer’s MOQ");
    assert.equal(columns[index.distributor_moq].detailHeader, "Distributor’s MOQ");
    assert.equal(columns[index.commission_program].detailHeader, "Commission Set on");
    assert.equal(columns[index.frequently_bought_category].topHeader, "Frequently Bought Category");
  }
});

test("selected 2x2 values generate exactly four combinations in selected option order", () => {
  const variations = [
    { name: "Watt", values: ["5W", "7W"] },
    { name: "Output Colour", values: ["RED", "WHITE"] },
  ];
  const combinations = generateVariationCombinations(variations);
  assert.equal(combinations.length, 4);
  assert.deepEqual(combinations.map(variantName), [
    "5W / RED",
    "5W / WHITE",
    "7W / RED",
    "7W / WHITE",
  ]);
  assert.deepEqual(
    combinations.map((combo) => expectedBulkVariantSku("CL-NE", combo)),
    [
      "CL-NE-5W-RED",
      "CL-NE-5W-WHITE",
      "CL-NE-7W-RED",
      "CL-NE-7W-WHITE",
    ],
  );
});

test("four variations round-trip through generated Excel and parser", () => {
  const variations = [
    { name: "Watt", values: ["5W"] },
    { name: "Output Colour", values: ["RED"] },
    { name: "Pack Size", values: ["6"] },
    { name: "Body Colour", values: ["Black"] },
  ];
  const bytes = workbookFor(variations);
  const parsed = parseBulkProductWorkbook(bytes);
  const columns = buildProductMasterColumns(4);
  const index = buildProductMasterColumnIndex(columns);

  assert.equal(parsed.rows.length, 1);
  const row = parsed.rows[0].values;
  assert.equal(bulkColumnValue(row, "main_sku", index), "CL-NE");
  assert.equal(bulkColumnValue(row, "variation_1_name", index), "Watt");
  assert.equal(bulkColumnValue(row, "variation_2_name", index), "Output Colour");
  assert.equal(bulkColumnValue(row, "variation_3_name", index), "Pack Size");
  assert.equal(bulkColumnValue(row, "variation_4_name", index), "Body Colour");
  assert.equal(bulkColumnValue(row, "variation_4_value", index), "Black");
  assert.equal(bulkColumnValue(row, "variant_sku", index), "CL-NE-5W-RED-6-BLACK");
});

test("parser infers dynamic variation count even if hidden config sheet is removed", () => {
  const variations = [
    { name: "Watt", values: ["5W", "7W"] },
    { name: "Output Colour", values: ["RED", "WHITE"] },
    { name: "Pack Size", values: ["6", "12"] },
    { name: "Body Colour", values: ["Black"] },
  ];
  const bytes = workbookFor(variations);
  const workbook = XLSX.read(bytes, { type: "array" });
  delete workbook.Sheets["_Aurona_Config"];
  workbook.SheetNames = workbook.SheetNames.filter((name) => name !== "_Aurona_Config");
  const masterOnly = XLSX.write(workbook, { type: "array", bookType: "xlsx" });

  const parsed = parseBulkProductWorkbook(masterOnly);
  assert.equal(Number(parsed.metadata.variation_count), 4);
  assert.equal(parsed.metadata.variation_configuration.length, 4);
  assert.equal(parsed.metadata.column_keys.length, 72);
});

test("wrong dynamic Product Master column order is rejected", () => {
  const variations = [
    { name: "Watt", values: ["5W"] },
    { name: "Output Colour", values: ["RED"] },
  ];
  const bytes = workbookFor(variations);
  const workbook = XLSX.read(bytes, { type: "array" });
  const sheet = workbook.Sheets["Product Master"];
  const a1 = sheet.A1;
  const b1 = sheet.B1;
  sheet.A1 = b1;
  sheet.B1 = a1;
  const corrupted = XLSX.write(workbook, { type: "array", bookType: "xlsx" });

  assert.throws(
    () => parseBulkProductWorkbook(corrupted),
    /column order\/header structure does not match the generated dynamic template/i,
  );
});
