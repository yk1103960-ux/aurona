import assert from "node:assert/strict";
import test from "node:test";
import { generateVariantSku, optionToken } from "./sku-generation.ts";

test("SKU generation follows selected variation order", () => {
  assert.equal(
    generateVariantSku("CL-NEXA", [
      { name: "Watts", value: "5 W" },
      { name: "Output Colour", value: "Red" },
      { name: "Pack Size", value: "Pack of 6" },
    ]),
    "CL-NEXA-5W-RED-P6",
  );
});

test("client colour abbreviations are preserved", () => {
  assert.equal(optionToken("Cool White", "Output Colour"), "CW");
  assert.equal(optionToken("Natural White", "Output Colour"), "NW");
  assert.equal(optionToken("Warm White", "Output Colour"), "WW");
  assert.equal(optionToken("Smoke Brown", "Body Colour"), "SB");
  assert.equal(optionToken("Dark Grey", "Body Colour"), "DG");
  assert.equal(optionToken("Rose Gold", "Reflector Colour"), "RG");
});

test("pack, tank and size formatting follows client tables", () => {
  assert.equal(optionToken("Pack of 12", "Pack Size"), "P12");
  assert.equal(optionToken("3 L", "Tank Capacity"), "03L");
  assert.equal(optionToken('6"', "Size"), "06IN");
});
