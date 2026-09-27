import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBulkCategoryLookups,
  expectedBulkVariantSku,
  normalizeBulkCategoryName,
  resolveBulkCategory,
} from "./bulk-product-identity.ts";

test("bulk category lookup uses real category records with harmless normalization only", () => {
  const lookups = buildBulkCategoryLookups([
    { id: "cat-1", name: "Concealed Lights" },
    { id: "cat-2", name: "LED Bulbs" },
  ]);

  assert.equal(normalizeBulkCategoryName("  CONCEALED   LIGHTS  "), "concealed lights");
  assert.deepEqual(resolveBulkCategory(lookups, " concealed lights "), {
    id: "cat-1",
    name: "Concealed Lights",
  });
  assert.equal(resolveBulkCategory(lookups, "Concealed Light"), null);
});

test("bulk SKU always uses Main SKU, never product/model name", () => {
  const axes = [
    { name: "Watts", value: "5W" },
    { name: "Output Colour", value: "RED" },
    { name: "Pack Size", value: "Pack of 6" },
  ];

  assert.equal(expectedBulkVariantSku("CL-NE", axes), "CL-NE-5W-RED-P6");
  assert.equal(expectedBulkVariantSku(" cl-ne ", axes), "CL-NE-5W-RED-P6");
});

test("8 combinations from approved Main SKU stay consistent", () => {
  const watts = ["5W", "9W"];
  const colours = ["RED", "BLUE"];
  const packs = ["Pack of 6", "Pack of 12"];

  const skus = [];
  for (const watt of watts) {
    for (const colour of colours) {
      for (const pack of packs) {
        skus.push(
          expectedBulkVariantSku("CL-NE", [
            { name: "Watts", value: watt },
            { name: "Output Colour", value: colour },
            { name: "Pack Size", value: pack },
          ]),
        );
      }
    }
  }

  assert.deepEqual(skus, [
    "CL-NE-5W-RED-P6",
    "CL-NE-5W-RED-P12",
    "CL-NE-5W-BLUE-P6",
    "CL-NE-5W-BLUE-P12",
    "CL-NE-9W-RED-P6",
    "CL-NE-9W-RED-P12",
    "CL-NE-9W-BLUE-P6",
    "CL-NE-9W-BLUE-P12",
  ]);
});
