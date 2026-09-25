// Shared variation naming + SKU rules. Names and SKUs follow the exact
// "Choose Options" selection order (e.g. Watts → Colour → Pack Size).

export type VariationSelection = { name: string; value: string };

/** Short SKU token for one option value. "Pack of 6" → P6, "Cool White" → COOL-WHITE. */
export function optionToken(value: string): string {
  const pack = value.trim().match(/^pack\s*(?:of)?\s*(\d+)$/i);
  if (pack) return `P${pack[1]}`;
  const token = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  if (!token) throw new Error(`Variation value "${value}" has no usable SKU token.`);
  return token;
}

/** Display name for a combination, values joined in selection order. */
export function variantName(selection: VariationSelection[]): string {
  return selection.map((item) => item.value).join(" / ");
}

/** SKU for a combination: MAIN-SKU + one token per option, in selection order. */
export function generateVariantSku(mainSku: string, selection: VariationSelection[]): string {
  const base = mainSku.trim().toUpperCase();
  if (!base) throw new Error("Main SKU is required to generate variant SKUs.");
  const suffix = selection.map((item) => optionToken(item.value)).join("-");
  return suffix ? `${base}-${suffix}` : base;
}

/** Cartesian product of the chosen options, preserving option order. */
export function generateVariationCombinations(
  variations: Array<{ name: string; values: string[] }>,
): VariationSelection[][] {
  let combinations: VariationSelection[][] = [[]];
  for (const variation of variations) {
    const values = variation.values.map((value) => value.trim()).filter(Boolean);
    if (!values.length) return [];
    combinations = combinations.flatMap((combo) =>
      values.map((value) => [...combo, { name: variation.name, value }]),
    );
  }
  return combinations;
}
