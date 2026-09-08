/** Segment-aware matching avoids treating Shipping & Tax Rules as Shipping. */
export function isAdminPathActive(pathname: string, target: string, exact = false) {
  const path = pathname.replace(/\/+$/, "") || "/";
  const to = target.replace(/\/+$/, "") || "/";
  return path === to || (!exact && path.startsWith(`${to}/`));
}

export function isAdminQueryKey(key: readonly unknown[]) {
  return (
    typeof key[0] === "string" &&
    (key[0].startsWith("admin-") ||
      ["audit-logs", "catalog-imports", "payment-diagnostics", "mfa-status"].includes(key[0]))
  );
}
