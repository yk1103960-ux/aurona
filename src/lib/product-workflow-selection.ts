export function replaceRelatedSelection(ids: string[]) {
  return [...new Set(ids)].slice(0, 24);
}

export function scopedCommissionRule(row: { scoped_rules?: Record<string, unknown> } | undefined, buyerType: string, customerRole: string) {
  const key = `${buyerType}:${buyerType === "customer" ? customerRole : buyerType}`;
  return key === "customer:customer" ? row : row?.scoped_rules?.[key];
}