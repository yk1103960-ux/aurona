import { useEffect, useMemo, useState } from "react";
import type { ProductFamily, ProductVariant } from "@/lib/queries";

function getInitialSelection(family: ProductFamily, initialSku?: string) {
  const seed =
    (initialSku && family.variants.find((v) => v.sku === initialSku)?.attributes) ||
    family.variants[0]?.attributes ||
    {};
  const sel: Record<string, string> = {};
  for (const a of family.axes) sel[a.axis_key] = (seed[a.axis_key] as string) ?? "";
  return sel;
}

/**
 * Variant picker for sparse option matrices (e.g. Track Light, where the Lens,
 * Glass and COB models each carry different wattages).
 *
 * Choosing a value never gets blocked by the current selection: we take the
 * closest matching variant and adopt its full attribute set, so every model and
 * every option that exists in the catalogue is actually selectable.
 */
export function useVariantSelection(family: ProductFamily, initialSku?: string) {
  const initial = useMemo(() => getInitialSelection(family, initialSku), [family.id, initialSku]);

  const [selection, setSelection] = useState<Record<string, string>>(initial);

  useEffect(() => {
    setSelection(getInitialSelection(family, initialSku));
  }, [family.id, initialSku]);

  const matchScore = (v: ProductVariant, sel: Record<string, string>) =>
    family.axes.reduce(
      (n, a) => n + ((v.attributes[a.axis_key] ?? "") === sel[a.axis_key] ? 1 : 0),
      0,
    );

  const variant: ProductVariant = useMemo(() => {
    if (family.axes.length === 0) return family.variants[0];
    let best = family.variants[0];
    let bestScore = -1;
    for (const v of family.variants) {
      const score = matchScore(v, selection);
      if (score > bestScore) {
        best = v;
        bestScore = score;
      }
    }
    return best;
  }, [family, selection]);

  /** A value is offered whenever some variant in the catalogue carries it. */
  const isAvailable = (axisKey: string, value: string) =>
    family.variants.some((v) => (v.attributes[axisKey] ?? "") === value);

  /**
   * Set one axis and repair the rest of the selection from the best-matching
   * variant, so the shopper always lands on a real, orderable SKU.
   */
  const setAxis = (axisKey: string, value: string) =>
    setSelection((s) => {
      const wanted = { ...s, [axisKey]: value };
      const candidates = family.variants.filter((v) => (v.attributes[axisKey] ?? "") === value);
      if (candidates.length === 0) return s;
      let best = candidates[0];
      let bestScore = -1;
      for (const v of candidates) {
        const score = matchScore(v, wanted);
        if (score > bestScore) {
          best = v;
          bestScore = score;
        }
      }
      const next: Record<string, string> = {};
      for (const a of family.axes) next[a.axis_key] = (best.attributes[a.axis_key] as string) ?? "";
      next[axisKey] = value;
      return next;
    });

  const resolvedSelection = Object.fromEntries(
    family.axes.map((axis) => [axis.axis_key, variant?.attributes[axis.axis_key] ?? ""]),
  );
  return { selection: resolvedSelection, setAxis, variant, isAvailable };
}
