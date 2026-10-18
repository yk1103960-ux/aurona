export const BUYER_MOQ_FIELDS = {
  customer: "moq", retailer: "retailer_moq", distributor: "distributor_moq",
} as const;

export function buyerMoqPatch(buyer: keyof typeof BUYER_MOQ_FIELDS, raw: string) {
  const value = raw === "" ? null : Number(raw);
  if (value !== null && (!Number.isInteger(value) || value < 1)) return null;
  return { [BUYER_MOQ_FIELDS[buyer]]: value };
}