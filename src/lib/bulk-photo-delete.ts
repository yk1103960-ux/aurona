export type PhotoStatus = "active" | "archived";
export type ManagedPhoto = {
  id: string;
  image_url: string;
  family_id: string | null;
  variant_sku: string | null;
  status: PhotoStatus;
};

export function photoStatus(
  family: { archived_at: string | null } | undefined,
  variantSku: string | null,
  variant: { archived_at: string | null; is_active: boolean } | undefined,
): PhotoStatus {
  if (!family || family.archived_at) return "archived";
  if (variantSku && (!variant || variant.archived_at || !variant.is_active)) return "archived";
  return "active";
}

export function selectedFilteredPhotos<T extends { id: string }>(photos: T[], selected: Set<string>): T[] {
  return photos.filter(photo => selected.has(photo.id));
}

/** Never remove a shared object while another photo association still uses it. */
export function unusedPhotoPaths(deleted: { image_url: string }[], remaining: { image_url: string }[]): string[] {
  const used = new Set(remaining.map(photo => photo.image_url));
  const prefix = "/api/public/product-image/";
  return [...new Set(deleted.filter(photo => !used.has(photo.image_url)).flatMap(photo => {
    if (!photo.image_url.startsWith(prefix)) return [];
    const path = photo.image_url.slice(prefix.length);
    return path.startsWith("products/") && !path.includes("..") ? [path] : [];
  }))];
}