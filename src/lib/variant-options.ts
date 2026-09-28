/** The exact option shortcuts used by Create/Edit Product → Create product variations. */
export const PRODUCT_VARIATION_PRESETS = [
  ["wattage", "Watts Available"],
  ["output_colour", "Output Colour Option/s"],
  ["shape", "Shape"],
  ["body_colour", "Body Colour/s"],
  ["pack_size", "Pack Size"],
  ["oscillation", "Oscillation"],
  ["tank_capacity", "Tank Capacities"],
  ["size", "Size Option/s"],
  ["reflector_colour", "Reflector Colour"],
] as const;

export const variationAxisKey = (label: string) =>
  label.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");

/** Pure, category-independent rules shared by variant administration and selection. */
export type OptionAxis = { axis_key: string; values: string[] };

export function combinationKey(axes: OptionAxis[], attributes: Record<string, string>) {
  return JSON.stringify(axes.map((axis) => [axis.axis_key, String(attributes[axis.axis_key] ?? "").normalize("NFKC").trim().toLocaleLowerCase()]));
}

export function buildCombinations(axes: OptionAxis[], limit = 200) {
  if (!axes.length) throw new Error("Add at least one variation option first");
  const keys = new Set<string>();
  let count = 1;
  const normalized = axes.map((axis) => {
    if (!axis.axis_key || keys.has(axis.axis_key)) throw new Error("Option keys must be unique");
    keys.add(axis.axis_key);
    const seenValues = new Set<string>();
    const values = axis.values.map((value) => value.trim()).filter((value) => {
      const key = value.normalize("NFKC").toLocaleLowerCase();
      if (!key || seenValues.has(key)) return false;
      seenValues.add(key);
      return true;
    });
    if (!values.length) throw new Error("Select at least one value for every option");
    count *= values.length;
    if (count > limit)
      throw new Error(
        `Select fewer values: at most ${limit} combinations can be generated at once`,
      );
    return { ...axis, values };
  });
  return normalized.reduce<Record<string, string>[]>(
    (items, axis) =>
      items.flatMap((item) => axis.values.map((value) => ({ ...item, [axis.axis_key]: value }))),
    [{}],
  );
}

export function missingCombinations(
  axes: OptionAxis[],
  variants: { attributes: Record<string, string> }[],
) {
  const existing = new Set(variants.map((variant) => combinationKey(axes, variant.attributes)));
  return buildCombinations(axes).filter(
    (attributes) => !existing.has(combinationKey(axes, attributes)),
  );
}

/** Never offer configured values that have no real SKU; retain source terminology. */
export function actualAxes<T extends OptionAxis>(
  axes: T[],
  variants: { attributes: Record<string, string> }[],
): T[] {
  return axes
    .map((axis) => {
      const actual = new Set(
        variants.map((variant) => variant.attributes[axis.axis_key]).filter(Boolean),
      );
      return {
        ...axis,
        values: [...new Set([...axis.values.filter((value) => actual.has(value)), ...actual])],
      };
    })
    .filter((axis) => axis.values.length > 0);
}

/** Accept copy/pasted values separated by commas, new lines, tabs or semicolons. */
export function parsePastedValues(text: string): string[] {
  return [...new Set(text.split(/[,\n\r\t;]+/).map((value) => value.trim()).filter(Boolean))];
}

/** What a Generate Variations click would do, so the admin can be warned first. */
export function combinationSummary(
  axes: OptionAxis[],
  variants: { attributes: Record<string, string> }[],
) {
  const total = buildCombinations(axes).length;
  const missing = missingCombinations(axes, variants).length;
  return { total, missing, existing: total - missing };
}
