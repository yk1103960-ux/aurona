// Shared variation naming + SKU rules. Names and SKUs follow the exact
// "Choose Options" selection order (e.g. Watts → Output Colour → Pack Size).

export type VariationSelection = { name: string; value: string };

const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const OUTPUT_COLOUR_CODES: Record<string, string> = {
  "cool white": "CW",
  "natural white": "NW",
  "warm white": "WW",
  rgb: "RGB",
  blue: "BLUE",
  green: "GREEN",
  pink: "PINK",
  red: "RED",
  orange: "ORANGE",
  white: "WHITE",
  yellow: "YELLOW",
  "multi colour": "MULTI",
  "multi color": "MULTI",
};

const BODY_COLOUR_CODES: Record<string, string> = {
  white: "WHITE",
  black: "BLACK",
  ivory: "IVORY",
  "smoke brown": "SB",
  grey: "GREY",
  gray: "GREY",
  brown: "BROWN",
  "dark grey": "DG",
  "dark gray": "DG",
  green: "GREEN",
  orange: "ORANGE",
  "sky blue": "SB",
};

const REFLECTOR_COLOUR_CODES: Record<string, string> = {
  "matt black": "MB",
  "matte black": "MB",
  "rose gold": "RG",
  "shine black": "SB",
};

function genericToken(value: string): string {
  const token = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  if (!token) throw new Error(`Variation value "${value}" has no usable SKU token.`);
  return token;
}

/**
 * Short SKU token for one option value.
 *
 * The option-aware mappings mirror the client SKU-rules sheet where the rule
 * is unambiguous. Watt values deliberately keep the workbook form (5W/9W)
 * because the supplied workbook examples conflict with the prose zero-padding
 * note; changing existing Watt SKUs is unsafe without client confirmation.
 */
export function optionToken(value: string, optionName = ""): string {
  const raw = value.trim();
  const v = normalize(raw);
  const option = normalize(optionName);

  const pack = raw.match(/^pack\s*(?:of)?\s*(\d+)$/i);
  if (pack || /pack size/.test(option)) {
    const n = pack?.[1] ?? raw.match(/\d+/)?.[0];
    if (n) return `P${Number(n)}`;
  }

  if (v === "3 in 1") return "3IN1";
  if (v === "2 in 1") return "2IN1";

  if (/output colou?r/.test(option)) {
    const code = OUTPUT_COLOUR_CODES[v];
    if (code) return code;
  }

  if (/body colou?r/.test(option)) {
    const code = BODY_COLOUR_CODES[v];
    if (code) return code;
  }

  if (/reflector colou?r/.test(option)) {
    const code = REFLECTOR_COLOUR_CODES[v];
    if (code) return code;
  }

  if (/tank capacity/.test(option)) {
    const match = raw.match(/(\d+)/);
    if (match) return `${match[1].padStart(2, "0")}L`;
  }

  if (/^(?:size|size option s?)$/.test(option) || /size option/.test(option)) {
    const match = raw.match(/(\d+)/);
    if (match) return `${match[1].padStart(2, "0")}IN`;
  }

  if (/watt/.test(option)) {
    const match = raw.match(/(\d+(?:\.\d+)?)/);
    if (match) return `${match[1]}W`;
  }

  return genericToken(raw);
}

/** Exact token rule historically used by Create/Edit Product variation generation. */
export function createProductOptionToken(value: string): string {
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

/** Exact Create Product variant SKU rule: Main SKU + option values in selected order. */
export function generateCreateProductVariantSku(
  mainSku: string,
  selection: VariationSelection[],
): string {
  const base = normalizeMainSku(mainSku);
  const suffix = selection.map((item) => createProductOptionToken(item.value)).join("-");
  return suffix ? `${base}-${suffix}` : base;
}

/** Display name for a combination, values joined in selection order. */
export function variantName(selection: VariationSelection[]): string {
  return selection.map((item) => item.value).join(" / ");
}

/** Canonical approved SKU base used by preview, Excel, validation and import. */
export function normalizeMainSku(mainSku: string): string {
  const base = mainSku.trim().toUpperCase();
  if (!base) throw new Error("Main SKU is required to generate variant SKUs.");
  return base;
}

/** SKU for a combination: MAIN-SKU + one token per option, in selection order. */
export function generateVariantSku(mainSku: string, selection: VariationSelection[]): string {
  const base = normalizeMainSku(mainSku);
  const suffix = selection.map((item) => optionToken(item.value, item.name)).join("-");
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
