import assert from "node:assert/strict";
import test from "node:test";
import { photoStatus, selectedFilteredPhotos, unusedPhotoPaths } from "./bulk-photo-delete.ts";

test("Active photos require a current active variant and non-archived product", () => {
  assert.equal(photoStatus({ archived_at: null }, "SKU-A", { archived_at: null, is_active: true }), "active");
  assert.equal(photoStatus({ archived_at: null }, null, undefined), "active");
});
test("Archived filter includes archived, inactive and deleted-variant photos", () => {
  assert.equal(photoStatus({ archived_at: "2026-10-17" }, null, undefined), "archived");
  assert.equal(photoStatus({ archived_at: null }, "SKU-A", { archived_at: "2026-10-17", is_active: true }), "archived");
  assert.equal(photoStatus({ archived_at: null }, "SKU-A", { archived_at: null, is_active: false }), "archived");
  assert.equal(photoStatus({ archived_at: null }, "deleted-SKU", undefined), "archived");
});
test("Deletion targets only selected photos within current filtered results", () => {
  assert.deepEqual(selectedFilteredPhotos([{ id: "photo-A" }, { id: "photo-B" }], new Set(["photo-B", "hidden-photo"])), [{ id: "photo-B" }]);
});
test("Storage cleanup preserves unselected photos sharing the same object", () => {
  const shared = "/api/public/product-image/products/shared.jpg";
  const unique = "/api/public/product-image/products/unique.jpg";
  assert.deepEqual(unusedPhotoPaths([{ image_url: shared }, { image_url: unique }], [{ image_url: shared }]), ["products/unique.jpg"]);
});
test("Cleanup is limited to product photo objects", () => {
  assert.deepEqual(unusedPhotoPaths([{ image_url: "/api/public/product-image/private/file.jpg" }, { image_url: "/api/public/product-image/products/../file.jpg" }, { image_url: "https://example.com/photo.jpg" }], []), []);
});