import assert from "node:assert/strict";
import test from "node:test";
import {
  newVariation,
  prepareVariationAxes,
  variationIssues,
  VARIATION_STEPS,
} from "./variant-workflow.ts";
import { persistVariationPhotos, validateVariationPhoto } from "./variant-photo-drafts.ts";

// Synthetic, in-memory fixtures. Never inserted into the catalog.
test("guided flow starts with images and includes shared product options before SKU values", () => {
  assert.deepEqual(VARIATION_STEPS, [
    "Images",
    "Product options",
    "SKU & values",
    "Prices & MOQ",
    "Stock & dimensions",
    "Review & save",
  ]);
});

test("a duplicate copies editable details but never identity, barcode, stock or active state", () => {
  const source = {
    ...newVariation("family", "TEST", []),
    id: "persisted-id",
    sku: "TEST-A",
    barcode: "123",
    attributes: { output: "a", variant_label: "Custom name" },
    stock: 32,
    expected_stock: 30,
    price: 40,
    mrp: 50,
    retailer_price: 35,
    distributor_price: 30,
    weight_g: 80,
    dim_l: 12,
    is_active: true,
  };
  const before = structuredClone(source);
  const copy = newVariation("family", "TEST", [source], source);
  assert.notEqual(copy.id, source.id);
  assert.notEqual(copy.sku, source.sku);
  assert.equal(copy.stock, 0);
  assert.equal(copy.expected_stock, 0);
  assert.equal(copy.barcode, "");
  assert.equal(copy.is_active, false);
  assert.equal(copy.price, 40);
  assert.equal(copy.retailer_price, 35);
  assert.equal(copy.distributor_price, 30);
  assert.equal(copy.weight_g, 80);
  copy.attributes.output = "b";
  assert.deepEqual(source, before, "editing a duplicate cannot mutate its source");
});

test("repeated duplication produces unique bounded SKUs without changing existing rows", () => {
  const source = newVariation("family", "A".repeat(120), []);
  const one = newVariation("family", "F", [source], source);
  const two = newVariation("family", "F", [source, { ...one, sku: one.sku.toLowerCase() }], source);
  assert.notEqual(one.sku.toUpperCase(), two.sku.toUpperCase());
  assert.ok(two.sku.length <= 120);
  const blank = newVariation("family", "F", []);
  assert.equal(blank.price, null);
  assert.equal(blank.is_active, false);
});

test("shared option validation deduplicates values and protects existing SKU mappings", () => {
  const old = [
    { id: "axis", axis_key: "output", label: "Output", values: ["a", "b"], sort_order: 0 },
  ];
  const row = { ...newVariation("family", "F", []), attributes: { output: "b" } };
  assert.throws(
    () => prepareVariationAxes([{ ...old[0], values: ["a"] }], old, [row]),
    /inactive first/,
  );
  assert.deepEqual(
    prepareVariationAxes([{ ...old[0], values: [" a ", "a", "b"] }], old, [row])[0].values,
    ["a", "b"],
  );
  assert.throws(() => prepareVariationAxes([{ ...old[0], values: [] }], [], []), /at least one/);
  assert.throws(() => prepareVariationAxes([old[0], { ...old[0], id: "other" }], [], []), /unique/);
});

test("duplicate SKUs, active combinations and invalid quantities are detected before save", () => {
  const axes = [
    { id: "axis", axis_key: "output", label: "Output", values: ["a", "b"], sort_order: 0 },
  ];
  const source = {
    ...newVariation("family", "F", []),
    price: 10,
    mrp: 20,
    is_active: true,
    attributes: { output: "a" },
  };
  const copy = newVariation("family", "F", [source], source);
  assert.deepEqual(variationIssues(copy, [source, copy], axes), []);
  assert.match(
    variationIssues({ ...copy, is_active: true }, [source, copy], axes).join(" "),
    /same option values/,
  );
  assert.match(
    variationIssues({ ...copy, sku: source.sku }, [source, copy], axes).join(" "),
    /unique SKU/,
  );
  assert.match(
    variationIssues({ ...copy, stock: 1.5, weight_g: -1 }, [source, copy], axes).join(" "),
    /whole number/,
  );
});

test("photo selection accepts safe image types and bounds file size", () => {
  assert.doesNotThrow(() => validateVariationPhoto({ type: "image/png", size: 42 }));
  assert.throws(() => validateVariationPhoto({ type: "image/svg+xml", size: 42 }), /Choose/);
  assert.throws(() => validateVariationPhoto({ type: "image/png", size: 0 }), /8 MB/);
  assert.throws(() => validateVariationPhoto({ type: "image/png", size: 9 * 1024 * 1024 }), /8 MB/);
});

test("retrying a failed image association reuses its uploaded bytes and stable ID", async () => {
  const photo = { id: "stable-id", previewUrl: "blob:test", altText: "", primary: true };
  let uploads = 0,
    attaches = 0,
    primary = 0;
  const adapter = {
    upload: async () => {
      uploads++;
      return "/api/public/product-image/test.png";
    },
    attach: async (item) => {
      assert.equal(item.id, "stable-id");
      if (++attaches === 1) throw new Error("Test failure");
    },
    makePrimary: async () => {
      primary++;
    },
  };
  await assert.rejects(persistVariationPhotos([photo], adapter), /Test failure/);
  await persistVariationPhotos([photo], adapter);
  await persistVariationPhotos([photo], adapter);
  assert.equal(uploads, 1);
  assert.equal(attaches, 2);
  assert.equal(primary, 1);
});

test("copied image links need no upload and a failed primary step does not reinsert the image", async () => {
  const photo = {
    id: "copy-id",
    previewUrl: "/existing.png",
    imageUrl: "/existing.png",
    altText: "",
    primary: true,
  };
  let attaches = 0,
    primary = 0;
  const adapter = {
    upload: async () => {
      throw new Error("Copy must reuse existing bytes");
    },
    attach: async () => {
      attaches++;
    },
    makePrimary: async () => {
      if (++primary === 1) throw new Error("Primary failed");
    },
  };
  await assert.rejects(persistVariationPhotos([photo], adapter), /Primary failed/);
  await persistVariationPhotos([photo], adapter);
  assert.equal(attaches, 1);
  assert.equal(primary, 2);
});
