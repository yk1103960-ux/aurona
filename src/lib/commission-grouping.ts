export const COMMISSION_ALL_VARIANTS_VALUE = "__all";
export const COMMISSION_ALL_VARIANTS_LABEL = "All Variants";

export const normalizeCommissionGrouping = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-IN");

export type CommissionAxisLike = { name?: string; axis_key?: string; label?: string };

export function resolveCommissionSetOn(
  rawValue: unknown,
  axes: CommissionAxisLike[],
  programs: Array<{ id: string; name: string }>,
):
  | { kind: "none"; normalized: "" }
  | { kind: "group"; normalized: string; scope: string; label: string }
  | { kind: "program"; normalized: string; programId: string; label: string }
  | { kind: "unknown"; normalized: string } {
  const normalized = normalizeCommissionGrouping(rawValue);
  if (!normalized) return { kind: "none", normalized: "" };

  if (
    normalized === normalizeCommissionGrouping(COMMISSION_ALL_VARIANTS_LABEL) ||
    normalized === COMMISSION_ALL_VARIANTS_VALUE
  ) {
    return {
      kind: "group",
      normalized,
      scope: COMMISSION_ALL_VARIANTS_VALUE,
      label: COMMISSION_ALL_VARIANTS_LABEL,
    };
  }

  for (const axis of axes) {
    const candidates = [axis.name, axis.label, axis.axis_key]
      .map(normalizeCommissionGrouping)
      .filter(Boolean);
    if (candidates.includes(normalized)) {
      const label = String(axis.label || axis.name || axis.axis_key || "").trim();
      const scope = String(axis.axis_key || axis.name || axis.label || "").trim();
      return { kind: "group", normalized, scope, label };
    }
  }

  for (const program of programs) {
    if (normalizeCommissionGrouping(program.name) === normalized) {
      return {
        kind: "program",
        normalized,
        programId: program.id,
        label: program.name,
      };
    }
  }

  return { kind: "unknown", normalized };
}
