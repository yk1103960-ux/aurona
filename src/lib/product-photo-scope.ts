export type ProductPhotoScope = {
  familyId: string | null;
  productId: string;
  categoryId: string | null;
};

/** Reject the entire selection rather than silently deleting a foreign photo. */
export function assertProductPhotoSelection(
  ids: string[],
  photos: { id: string; family_id: string | null; product_id: string | null }[],
  scope: ProductPhotoScope,
) {
  const selected = new Set(ids);
  if (!selected.size || photos.length !== selected.size || photos.some(photo =>
    !selected.has(photo.id) || (scope.familyId
      ? photo.family_id !== scope.familyId
      : photo.family_id !== null || photo.product_id !== scope.productId),
  )) throw new Error("Selected photos do not all belong to this product. Reload and select again.");
}

export function assertProductPhotoCategory(actual: string | null, expected: string | null) {
  if (actual !== expected) throw new Error("The product category changed. Reload before deleting photos.");
}