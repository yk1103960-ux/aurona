import { useMemo, useState } from "react";
import type { ProductFamily, ProductVariant } from "@/lib/queries";

export function useVariantSelection(family: ProductFamily, initialSku?: string) {
  const initial = useMemo(() => {
    const seed =
      (initialSku && family.variants.find((v) => v.sku === initialSku)?.attributes) ||
      family.variants[0]?.attributes ||
      {};
    const sel: Record<string, string> = {};
    for (const a of family.axes) sel[a.axis_key] = (seed[a.axis_key] as string) ?? a.values[0];
    return sel;
  }, [family, initialSku]);

  const [selection, setSelection] = useState<Record<string, string>>(initial);

  const variant: ProductVariant = useMemo(() => {
    if (family.axes.length === 0) return family.variants[0];
    const match = family.variants.find((v) =>
      family.axes.every((a) => (v.attributes[a.axis_key] ?? "") === selection[a.axis_key]),
    );
    return match ?? family.variants[0];
  }, [family, selection]);

  const isAvailable = (axisKey: string, value: string) =>
    family.variants.some((v) => {
      if (v.attributes[axisKey] !== value) return false;
      for (const a of family.axes) {
        if (a.axis_key === axisKey) continue;
        if ((v.attributes[a.axis_key] ?? "") !== selection[a.axis_key]) return false;
      }
      return true;
    });

  const setAxis = (axisKey: string, value: string) =>
    setSelection((s) => ({ ...s, [axisKey]: value }));

  return { selection, setAxis, variant, isAvailable };
}
