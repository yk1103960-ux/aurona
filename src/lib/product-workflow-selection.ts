export function replaceRelatedSelection(ids: string[]) {
  return [...new Set(ids)].slice(0, 24);
}

export function scopedCommissionRule(row: { scoped_rules?: Record<string, unknown> } | undefined, buyerType: string, customerRole: string) {
  const key = `${buyerType}:${buyerType === "customer" ? customerRole : buyerType}`;
  return key === "customer:customer" ? row : row?.scoped_rules?.[key];
}

export function commissionBranchRows<T extends { variant_id: string; program_id: string }>(
  rows: T[], programId: string, variantIds: string[],
) {
  const allowed = new Set(variantIds);
  return rows.filter(row => row.program_id === programId && allowed.has(row.variant_id));
}