import { generateVariantSku, normalizeMainSku, type VariationSelection } from "./sku-generation";

export const normalizeBulkCategoryName = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-IN");

export type BulkCategoryRecord = { id: string; name: string };

export function buildBulkCategoryLookups(rows: BulkCategoryRecord[]) {
  const byName = new Map<string, BulkCategoryRecord>();
  const byId = new Map<string, BulkCategoryRecord>();

  for (const row of rows) {
    const normalized = normalizeBulkCategoryName(row.name);
    if (normalized) byName.set(normalized, row);
    byId.set(String(row.id), row);
  }

  return { byName, byId };
}

export function resolveBulkCategory(
  lookups: ReturnType<typeof buildBulkCategoryLookups>,
  categoryName: unknown,
  categoryId?: unknown,
): BulkCategoryRecord | null {
  const normalizedName = normalizeBulkCategoryName(categoryName);
  const id = String(categoryId ?? "").trim();

  if (id) {
    const byId = lookups.byId.get(id);
    if (byId && normalizeBulkCategoryName(byId.name) === normalizedName) return byId;
  }

  return lookups.byName.get(normalizedName) ?? null;
}

export function expectedBulkVariantSku(
  mainSku: string,
  axes: VariationSelection[],
): string {
  return generateVariantSku(normalizeMainSku(mainSku), axes);
}
