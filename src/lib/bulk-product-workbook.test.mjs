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

const MASTER_MERGES = [
  "A1:A2","B1:B2","C1:C2","D1:D2","E1:E2","F1:F2","G1:G2","H1:H2","I1:I2","J1:J2","K1:K2",
  "L1:L2","M1:M2","N1:N2","O1:O2","P1:P2","Q1:Q2","R1:R2","S1:S2","T1:T2","U1:U2","V1:V2",
  "W1:W2","X1:X2","Y1:Y2","Z1:Z2","AA1:AE1","AF1:AO1","AP1:AY1","AZ1:BI1","BJ1:BM1",
  "BN1:BO1","BP1:BP2","BQ1:BQ2","BR1:BR2",
].sort();


test("Product Master source-of-truth has one explicit Product Manager/database mapping for every column", () => {
  assert.equal(PRODUCT_MASTER_COLUMNS.length, 70);
  assert.deepEqual(
    PRODUCT_MASTER_COLUMNS.map((column) => column.serial),
    Array.from({ length: 70 }, (_, index) => index + 1),
  );
  for (const column of PRODUCT_MASTER_COLUMNS) {
    assert.ok(column.key, `Column ${column.serial} must have a stable key`);
    assert.ok(column.group, `Column ${column.serial} must have a visible group`);
    assert.ok(
      column.productManagerField,
      `Column ${column.serial} must document its Product Manager/database mapping`,
    );
  }
});

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

  const merges = (sheet["!merges"] ?? [])
    .map((range) => XLSX.utils.encode_range(range))
    .sort();
  assert.deepEqual(merges, MASTER_MERGES);
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

test("approved Main SKU is the only base used for all eight 2x2x2 generated variant SKUs", () => {
  const variations = [
    { name: "Watts", values: ["5W", "9W"] },
    { name: "Output Colour", values: ["RED", "BLUE"] },
    { name: "Pack Size", values: ["Pack of 6", "Pack of 12"] },
  ];
  const combinations = generateVariationCombinations(variations);
  assert.equal(combinations.length, 8);
  assert.deepEqual(
    combinations.map((combo) => generateVariantSku("CL-NE", combo)),
    [
      "CL-NE-5W-RED-P6",
      "CL-NE-5W-RED-P12",
      "CL-NE-5W-BLUE-P6",
      "CL-NE-5W-BLUE-P12",
      "CL-NE-9W-RED-P6",
      "CL-NE-9W-RED-P12",
      "CL-NE-9W-BLUE-P6",
      "CL-NE-9W-BLUE-P12",
    ],
  );

  const bytes = createBulkProductWorkbook({
    categoryId: "00000000-0000-0000-0000-000000000001",
    categoryName: "Concealed Lights",
    productName: "Nexa",
    mainSku: "CL-NE",
    brandName: "AURONA",
    unit: "Pc",
    modelName: "NEXA",
    variations,
    combinations,
  });
  const parsed = parseBulkProductWorkbook(bytes);
  assert.equal(parsed.rows.length, 8);
  for (const row of parsed.rows) {
    assert.equal(bulkColumnValue(row.values, "main_sku"), "CL-NE");
    assert.match(String(bulkColumnValue(row.values, "variant_sku")), /^CL-NE-/);
    assert.doesNotMatch(String(bulkColumnValue(row.values, "variant_sku")), /^CL-NEXA-/);
  }
});

test("generated workbook variant SKU is based only on Main SKU, never product/model name", () => {
  const variations = [
    { name: "Watts", values: ["5W"] },
    { name: "Output Colour", values: ["RED"] },
    { name: "Pack Size", values: ["Pack of 6"] },
  ];
  const combinations = generateVariationCombinations(variations);
  const bytes = createBulkProductWorkbook({
    categoryId: "00000000-0000-0000-0000-000000000001",
    categoryName: "Concealed Lights",
    productName: "NEXA",
    mainSku: "CL-NE",
    brandName: "AURONA",
    unit: "Pc",
    modelName: "NEXA",
    variations,
    combinations,
  });

  const parsed = parseBulkProductWorkbook(bytes);
  assert.equal(parsed.rows.length, 1);
  assert.equal(bulkColumnValue(parsed.rows[0].values, "main_sku"), "CL-NE");
  assert.equal(bulkColumnValue(parsed.rows[0].values, "variant_sku"), "CL-NE-5W-RED-P6");
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

test("parser accepts the exact Product Master multi-row structure without a hidden config sheet", () => {
  const variations = [
    { name: "Watts", values: ["5W", "7W"] },
    { name: "Output Colour", values: ["RED", "WHITE"] },
  ];
  const bytes = createBulkProductWorkbook({
    categoryId: "00000000-0000-0000-0000-000000000001",
    categoryName: "Concealed Lighths",
    productName: "Nexa",
    mainSku: "CL-NEXA",
    variations,
    combinations: generateVariationCombinations(variations),
  });

  const workbook = XLSX.read(bytes, { type: "array" });
  delete workbook.Sheets["_Aurona_Config"];
  workbook.SheetNames = workbook.SheetNames.filter((name) => name !== "_Aurona_Config");
  const masterOnly = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const parsed = parseBulkProductWorkbook(masterOnly);

  assert.equal(parsed.rows.length, 4);
  assert.equal(parsed.metadata.category_name, "Concealed Lighths");
  assert.equal(parsed.metadata.main_sku, "CL-NEXA");
  assert.deepEqual(parsed.metadata.variation_configuration, [
    { name: "Watts", values: ["5W", "7W"] },
    { name: "Output Colour", values: ["RED", "WHITE"] },
  ]);
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
