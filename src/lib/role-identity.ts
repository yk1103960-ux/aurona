/**
 * Role-scoped account identity.
 *
 * One email + password pair may exist once per account type: the customer
 * account uses the address as typed, while retailer and distributor accounts
 * are stored under a role-tagged sub-address. That keeps the three accounts
 * separate in Auth (so the same credentials can be reused across roles) while
 * still blocking a duplicate account inside the same role.
 */
export type AccountRole = "customer" | "retailer" | "distributor";

export function roleEmail(email: string, role: AccountRole): string {
  const clean = email.trim().toLowerCase();
  if (role === "customer") return clean;
  const at = clean.lastIndexOf("@");
  if (at < 1) return clean;
  const local = clean.slice(0, at).replace(/\+(retailer|distributor)$/, "");
  const domain = clean.slice(at + 1);
  return `${local}+${role}@${domain}`;
}

/** Strips the role tag, returning the address the user actually typed. */
export function baseEmail(email: string): string {
  return email.trim().toLowerCase().replace(/\+(retailer|distributor)(?=@)/, "");
}
