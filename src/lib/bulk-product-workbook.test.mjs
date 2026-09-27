import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  createBulkProductWorkbook,
  parseBulkProductWorkbook,
} from "./bulk-product-workbook.ts";
import {
  PRODUCT_MASTER_COLUMNS,
  bulkColumnValue,
} from "./bulk-product-columns.ts";
import {
  generateVariationCombinations,
  generateVariantSku,
  variantName,
} from "./sku-generation.ts";

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

test("generated workbook headers exactly match the supplied 70-column Product Master template", () => {
  const variations = [{ name: "Watts", values: ["5W"] }];
  const bytes = createBulkProductWorkbook({
    categoryId: "00000000-0000-0000-0000-000000000001",
    categoryName: "Concealed Lighths",
    productName: "Nexa",
    mainSku: "CL-NEXA",
    variations,
    combinations: generateVariationCombinations(variations),
  });
  const workbook = XLSX.read(bytes, { type: "array" });
  const sheet = workbook.Sheets["Product Master"];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
  assert.deepEqual(matrix[0].slice(0, 70), MASTER_TOP_HEADERS);
  assert.deepEqual(matrix[1].slice(0, 70), MASTER_DETAIL_HEADERS);
  assert.deepEqual(matrix[2].slice(0, 70), Array.from({ length: 70 }, (_, index) => index + 1));
});

test("selected 2x2 values generate exactly four combinations in selected axis order", () => {
  const variations = [
    { name: "Watts", values: ["5W", "7W"] },
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
    combinations.map((combo) => generateVariantSku("CL-NEXA", combo)),
    [
      "CL-NEXA-5W-RED",
      "CL-NEXA-5W-WHITE",
      "CL-NEXA-7W-RED",
      "CL-NEXA-7W-WHITE",
    ],
  );
});

test("generated Product Master workbook preserves all 70 master columns and round-trips exact selected rows", () => {
  const variations = [
    { name: "Watts", values: ["5W", "7W"] },
    { name: "Output Colour", values: ["RED", "WHITE"] },
  ];
  const combinations = generateVariationCombinations(variations);
  const bytes = createBulkProductWorkbook({
    categoryId: "00000000-0000-0000-0000-000000000001",
    categoryName: "Concealed Lighths",
    productName: "Nexa",
    mainSku: "CL-NEXA",
    brandName: "AURONA",
    unit: "Pc",
    modelName: "NEXA",
    variations,
    combinations,
  });

  const workbook = XLSX.read(bytes, { type: "array" });
  const sheet = workbook.Sheets["Product Master"];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
  assert.equal(matrix[0].length, 70);
  assert.equal(matrix[1].length, 70);
  assert.equal(matrix[2].length, 70);
  assert.equal(PRODUCT_MASTER_COLUMNS.length, 70);

  const parsed = parseBulkProductWorkbook(bytes);
  assert.equal(parsed.rows.length, 4);

  assert.deepEqual(
    parsed.rows.map((row) => ({
      category: bulkColumnValue(row.values, "category_name"),
      product: bulkColumnValue(row.values, "product_name"),
      mainSku: bulkColumnValue(row.values, "main_sku"),
      variantName: bulkColumnValue(row.values, "variant_name"),
      variantSku: bulkColumnValue(row.values, "variant_sku"),
      variation1: [
        bulkColumnValue(row.values, "variation_1_name"),
        bulkColumnValue(row.values, "variation_1_value"),
      ],
      variation2: [
        bulkColumnValue(row.values, "variation_2_name"),
        bulkColumnValue(row.values, "variation_2_value"),
      ],
    })),
    [
      {
        category: "Concealed Lighths",
        product: "Nexa",
        mainSku: "CL-NEXA",
        variantName: "5W / RED",
        variantSku: "CL-NEXA-5W-RED",
        variation1: ["Watts", "5W"],
        variation2: ["Output Colour", "RED"],
      },
      {
        category: "Concealed Lighths",
        product: "Nexa",
        mainSku: "CL-NEXA",
        variantName: "5W / WHITE",
        variantSku: "CL-NEXA-5W-WHITE",
        variation1: ["Watts", "5W"],
        variation2: ["Output Colour", "WHITE"],
      },
      {
        category: "Concealed Lighths",
        product: "Nexa",
        mainSku: "CL-NEXA",
        variantName: "7W / RED",
        variantSku: "CL-NEXA-7W-RED",
        variation1: ["Watts", "7W"],
        variation2: ["Output Colour", "RED"],
      },
      {
        category: "Concealed Lighths",
        product: "Nexa",
        mainSku: "CL-NEXA",
        variantName: "7W / WHITE",
        variantSku: "CL-NEXA-7W-WHITE",
        variation1: ["Watts", "7W"],
        variation2: ["Output Colour", "WHITE"],
      },
    ],
  );
});

test("wrong Product Master column order is rejected instead of silently remapping data", () => {
  const variations = [{ name: "Watts", values: ["5W"] }];
  const bytes = createBulkProductWorkbook({
    categoryId: "00000000-0000-0000-0000-000000000001",
    categoryName: "Concealed Lighths",
    productName: "Nexa",
    mainSku: "CL-NEXA",
    variations,
    combinations: generateVariationCombinations(variations),
  });
  const workbook = XLSX.read(bytes, { type: "array" });
  const sheet = workbook.Sheets["Product Master"];
  const a1 = sheet.A1;
  const b1 = sheet.B1;
  sheet.A1 = b1;
  sheet.B1 = a1;
  const corrupted = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  assert.throws(
    () => parseBulkProductWorkbook(corrupted),
    /column order\/header structure does not match the master template/i,
  );
});
