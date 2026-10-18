import assert from "node:assert/strict";
import test from "node:test";
import { assertProductPhotoSelection, assertProductPhotoCategory } from "./product-photo-scope.ts";

const scope = { familyId: "opened", productId: "product", categoryId: "lighting" };
const photo = { id: "one", family_id: "opened", product_id: null };
test("multi-delete accepts only photos of the opened product", () => {
  assert.doesNotThrow(() => assertProductPhotoSelection(["one"], [photo], scope));
  assert.throws(() => assertProductPhotoSelection(["one", "foreign"], [photo, { id: "foreign", family_id: "other", product_id: null }], scope), /belong/);
  assert.throws(() => assertProductPhotoSelection(["one", "missing"], [photo], scope), /belong/);
});
test("multi-delete rejects a different or changed category", () => {
  assert.doesNotThrow(() => assertProductPhotoCategory("lighting", "lighting"));
  assert.throws(() => assertProductPhotoCategory("fans", "lighting"), /category changed/);
  assert.throws(() => assertProductPhotoCategory(null, "lighting"), /category changed/);
});
test("legacy photo deletion cannot include family or other product photos", () => {
  const legacy = { ...scope, familyId: null };
  assert.doesNotThrow(() => assertProductPhotoSelection(["one"], [{ ...photo, family_id: null, product_id: "product" }], legacy));
  assert.throws(() => assertProductPhotoSelection(["one"], [photo], legacy), /belong/);
  assert.throws(() => assertProductPhotoSelection(["one"], [{ ...photo, family_id: null, product_id: "other" }], legacy), /belong/);
});