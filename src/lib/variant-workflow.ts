export type Variant = {
  id: string;
  family_id: string;
  sku: string;
  barcode: string;
  attributes: Record<string, string>;
  mrp: number | null;
  price: number | null;
  discount_pct: number | null;
  retailer_price: number | null;
  distributor_price: number | null;
  moq: number | null;
  retailer_moq: number | null;
  distributor_moq: number | null;
  stock: number | null;
  expected_stock?: number;
  pack_size: number | null;
  weight_g: number | null;
  dim_l: number | null;
  dim_w: number | null;
  dim_h: number | null;
  pack_weight_g: number | null;
  pack_l: number | null;
  pack_w: number | null;
  pack_h: number | null;
  is_active: boolean;
  sort_order: number;
  low_stock_threshold: number;
  /** Which shopper segments may see and buy this variation. */
  available_customer?: boolean;
  available_retailer?: boolean;
  available_distributor?: boolean;
};

export type Axis = {
  id: string;
  axis_key: string;
  label: string;
  values: string[];
  sort_order: number;
};

export const VARIATION_STEPS = [
  "Images",
  "Product options",
  "SKU & values",
  "Prices & MOQ",
  "Stock & dimensions",
  "Review & save",
] as const;

/** Copy editable details, never a persisted identity, barcode, stock or sale state. */
export function newVariation(
  familyId: string,
  familySku: string,
  rows: Variant[],
  source?: Variant,
): Variant {
  const used = new Set(rows.map((row) => row.sku.trim().toUpperCase()));
  const prefix = `${source?.sku ?? familySku}-${source ? "COPY" : "NEW"}`.slice(0, 110);
  let sequence = 1;
  let sku = `${prefix}-${String(sequence).padStart(2, "0")}`;
  while (used.has(sku.toUpperCase())) sku = `${prefix}-${String(++sequence).padStart(2, "0")}`;
  return {
    id: `new-${crypto.randomUUID()}`,
    family_id: familyId,
    sku,
    barcode: "",
    attributes: { ...source?.attributes },
    mrp: source?.mrp ?? null,
    price: source?.price ?? null,
    discount_pct: source?.discount_pct ?? 0,
    retailer_price: source?.retailer_price ?? null,
    distributor_price: source?.distributor_price ?? null,
    moq: source?.moq ?? 1,
    retailer_moq: source?.retailer_moq ?? null,
    distributor_moq: source?.distributor_moq ?? null,
    stock: 0,
    expected_stock: 0,
    is_active: false,
    pack_size: source?.pack_size ?? null,
    weight_g: source?.weight_g ?? null,
    dim_l: source?.dim_l ?? null,
    dim_w: source?.dim_w ?? null,
    dim_h: source?.dim_h ?? null,
    pack_weight_g: source?.pack_weight_g ?? null,
    pack_l: source?.pack_l ?? null,
    pack_w: source?.pack_w ?? null,
    pack_h: source?.pack_h ?? null,
    sort_order: rows.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1,
    low_stock_threshold: source?.low_stock_threshold ?? 10,
    available_customer: source?.available_customer ?? true,
    available_retailer: source?.available_retailer ?? true,
    available_distributor: source?.available_distributor ?? true,
  };
}

export function prepareVariationAxes(rows: Axis[], previous: Axis[], variants: Variant[]): Axis[] {
  const cleaned = rows.map((axis) => ({
    ...axis,
    axis_key: axis.axis_key
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_"),
    label: axis.label.trim(),
    values: [...new Set(axis.values.map((value) => value.trim()).filter(Boolean))],
  }));
  if (cleaned.some((axis) => !axis.axis_key || !axis.label || !axis.values.length))
    throw new Error("Every option needs a key, display name and at least one value.");
  if (new Set(cleaned.map((axis) => axis.axis_key)).size !== cleaned.length)
    throw new Error("Each option key must be unique.");
  for (const old of previous) {
    const replacement = cleaned.find((axis) => axis.axis_key === old.axis_key);
    if (
      variants.some(
        (row) =>
          row.attributes[old.axis_key] &&
          !replacement?.values.includes(row.attributes[old.axis_key]),
      )
    )
      throw new Error(
        `Existing SKUs use ${old.label} values that would be removed. Remap those SKUs first.`,
      );
  }
  return cleaned;
}

export function variationIssues(row: Variant, rows: Variant[], axes: Axis[]): string[] {
  const issues: string[] = [];
  const sku = row.sku.trim().toUpperCase();
  if (!sku || sku.length > 120) issues.push("Enter a SKU with 1–120 characters.");
  if (rows.some((other) => other.id !== row.id && other.sku.trim().toUpperCase() === sku))
    issues.push("This SKU is already used in this product. Choose a unique SKU.");
  if (
    row.barcode.trim() &&
    rows.some((other) => other.id !== row.id && other.barcode?.trim() === row.barcode.trim())
  )
    issues.push("This barcode is already used in this product.");
  for (const key of [
    "mrp",
    "price",
    "retailer_price",
    "distributor_price",
    "weight_g",
    "dim_l",
    "dim_w",
    "dim_h",
    "pack_weight_g",
    "pack_l",
    "pack_w",
    "pack_h",
  ] as const)
    if (row[key] !== null && (!Number.isFinite(row[key]) || row[key]! < 0))
      issues.push(`${key.replaceAll("_", " ")} must be zero or more.`);
  for (const key of [
    "stock",
    "low_stock_threshold",
    "sort_order",
    "moq",
    "retailer_moq",
    "distributor_moq",
    "pack_size",
  ] as const) {
    const value = row[key];
    if (
      value !== null &&
      (!Number.isInteger(value) ||
        value < (["stock", "low_stock_threshold", "sort_order"].includes(key) ? 0 : 1))
    )
      issues.push(`${key.replaceAll("_", " ")} must be a valid whole number.`);
  }
  if (row.is_active) {
    if (row.price === null || row.mrp === null)
      issues.push("Enter customer price and MRP before activating this variation.");
    if (axes.some((axis) => !axis.values.includes(row.attributes[axis.axis_key])))
      issues.push("Choose a value for every product option before activating.");
    if (
      axes.length &&
      rows.some(
        (other) =>
          other.id !== row.id &&
          other.is_active &&
          axes.every((axis) => other.attributes[axis.axis_key] === row.attributes[axis.axis_key]),
      )
    )
      issues.push(
        "Another active variation has these same option values. Change the values or keep this copy inactive.",
      );
  }
  return issues;
}
