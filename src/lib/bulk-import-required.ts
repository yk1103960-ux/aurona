const cellText = (value: unknown) => String(value ?? "").trim();

export function requiredDynamicRowErrors(row: Record<string, unknown>): string[] {
  const identity = [row.product_name, row.main_sku].map(cellText).filter(Boolean).join(" / ");
  const context = identity ? ` (${identity})` : "";
  const missing = (label: string) => `Row ${row.excel_row} — ${label} is required and cannot be blank${context}.`;
  const errors: string[] = [];
  for (const [field, label] of [
    ["category_name", "Product Category"],
    ["product_name", "Product Name"],
    ["main_sku", "Main SKU"],
    ["variant_sku", "Variant SKU"],
  ] as const) {
    if (!cellText(row[field])) errors.push(missing(label));
  }
  for (const [field, label] of [
    ["mrp", "MRP"],
    ["customer_price", "Customer Price"],
    ["customer_stock", "Customer Stock"],
  ] as const) {
    const value = row[field];
    if (value == null || typeof value === "string" && !value.trim()) errors.push(missing(label));
  }
  if (row.function === "create" && !cellText(row.active_status)) errors.push(missing("Status"));
  for (const [buyer, label] of [["retailer", "Retailer"], ["distributor", "Distributor"]] as const) {
    if (row[`${buyer}_price`] != null && cellText(row[`${buyer}_price`]) &&
        (row[`${buyer}_stock`] == null || !cellText(row[`${buyer}_stock`]))) {
      errors.push(missing(`${label} Stock`));
    }
  }
  const cells = Array.isArray(row.variation_cells) ? row.variation_cells : [];
  for (const pair of cells) {
    if (!pair || typeof pair !== "object") continue;
    const name = cellText(pair.name);
    const value = cellText(pair.value);
    if (name && !value) errors.push(missing("Variation Value"));
    if (value && !name) errors.push(missing("Variation Name"));
  }
  if (row.function === "create" && (!Array.isArray(row.variation_axes) || !row.variation_axes.length) &&
      !errors.some((error) => error.includes("Variation Value") || error.includes("Variation Name"))) {
    errors.push(missing("Variation Value"));
  }
  return errors;
}
