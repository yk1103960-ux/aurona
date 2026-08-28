/**
 * Role-aware dashboard routing.
 *
 * A session belongs to exactly one account type (customer, retailer or
 * distributor). Each type has its own dashboard, and a session may never
 * reach a dashboard belonging to another type.
 */
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useMyRole, type PricingRole } from "@/lib/pricing";

export type DashboardRole = "customer" | "retailer" | "distributor";

export const DASHBOARD_PATHS = {
  customer: "/account",
  retailer: "/retailer",
  distributor: "/distributor",
} as const;

/** Collapses every backend role (including admin/guest) onto a dashboard owner. */
export function dashboardRoleOf(role?: PricingRole | string | null): DashboardRole {
  if (role === "retailer") return "retailer";
  if (role === "distributor") return "distributor";
  return "customer";
}

export function dashboardPathFor(role?: PricingRole | string | null) {
  return DASHBOARD_PATHS[dashboardRoleOf(role)];
}

export function roleLabel(role?: PricingRole | string | null): string {
  const r = dashboardRoleOf(role);
  return r === "retailer" ? "Retailer" : r === "distributor" ? "Distributor" : "Customer";
}

/** The account type the current session is signed in as (null when signed out). */
export function useSessionRole() {
  const { user, loading } = useAuth();
  const role = useMyRole();
  return {
    user,
    loading: loading || (!!user && role.loading),
    signedIn: !!user,
    role: user ? dashboardRoleOf(role.role) : null,
    label: user ? roleLabel(role.role) : null,
    status: role.status,
    isApproved: role.isApproved,
    isPartner: role.isPartner,
    dashboardPath: user ? dashboardPathFor(role.role) : "/auth",
  };
}

/**
 * Strict route protection: signed-out visitors go to the role's sign-in page,
 * and a session belonging to another account type is bounced to its own
 * dashboard instead of being allowed in.
 */
export function useRoleDashboardGuard(expected: DashboardRole) {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const role = useMyRole();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth", search: { role: expected }, replace: true });
      return;
    }
    if (role.loading) return;
    const actual = dashboardRoleOf(role.role);
    if (actual !== expected) nav({ to: DASHBOARD_PATHS[actual], replace: true });
  }, [user, loading, role.loading, role.role, expected, nav]);

  const actual = user ? dashboardRoleOf(role.role) : null;
  return { allowed: !!user && actual === expected, checking: loading || (!!user && role.loading) };
}
