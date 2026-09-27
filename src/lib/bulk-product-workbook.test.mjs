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
