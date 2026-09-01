/**
 * Role-aware dashboard routing.
 *
 * A session belongs to exactly one active account type (customer, retailer or
 * distributor). Retailer/distributor access is decided SERVER-SIDE from the
 * partner application + granted role — Google/e-mail authentication alone
 * never unlocks a partner dashboard.
 */
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useMyRole, type PricingRole } from "@/lib/pricing";
import { getAccessState, type PartnerState } from "@/lib/partner-access.functions";

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

/** Server-verified retailer/distributor states for the signed-in user. */
export const accessStateQuery = (userId?: string) =>
  queryOptions({
    queryKey: ["partner-access-state", userId ?? "signed-out"],
    enabled: Boolean(userId),
    staleTime: 15 * 1000,
    queryFn: async () => getAccessState(),
  });

export function useAccessState() {
  const { user, loading } = useAuth();
  const q = useQuery(accessStateQuery(user?.id));
  const retailer = (q.data?.retailer ?? "none") as PartnerState;
  const distributor = (q.data?.distributor ?? "none") as PartnerState;
  const activeRole: DashboardRole =
    retailer === "approved" ? "retailer" : distributor === "approved" ? "distributor" : "customer";
  return {
    user,
    retailer,
    distributor,
    activeRole,
    loading: loading || (!!user && q.isLoading),
  };
}

export function partnerAccessPath(role: DashboardRole) {
  return role === "customer" ? DASHBOARD_PATHS.customer : "/partner-access";
}

/** The account type the current session is signed in as (null when signed out). */
export function useSessionRole() {
  const { user, loading } = useAuth();
  const role = useMyRole();
  const access = useAccessState();
  const active = user ? access.activeRole : null;
  return {
    user,
    loading: loading || (!!user && (role.loading || access.loading)),
    signedIn: !!user,
    role: active,
    label: active ? roleLabel(active) : null,
    status: role.status,
    isApproved: role.isApproved,
    isPartner: active === "retailer" || active === "distributor",
    dashboardPath: user ? DASHBOARD_PATHS[active ?? "customer"] : "/auth",
  };
}

/**
 * Strict route protection.
 * - signed out → the role's sign-in page
 * - retailer/distributor dashboard → only when the server says "approved";
 *   otherwise the applicant is sent to the application / pending screen
 * - approved partners visiting the customer dashboard → their own dashboard
 */
export function useRoleDashboardGuard(expected: DashboardRole) {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const access = useAccessState();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth", search: { role: expected }, replace: true });
      return;
    }
    if (access.loading) return;

    if (expected === "retailer" || expected === "distributor") {
      const state = expected === "retailer" ? access.retailer : access.distributor;
      if (state !== "approved") {
        nav({ to: "/partner-access", search: { role: expected } as never, replace: true });
      }
      return;
    }

    // Customer dashboard: an approved partner belongs on its own dashboard.
    if (access.activeRole !== "customer") {
      nav({ to: DASHBOARD_PATHS[access.activeRole], replace: true });
    }
  }, [user, loading, access.loading, access.retailer, access.distributor, access.activeRole, expected, nav]);

  const allowed =
    !!user &&
    (expected === "customer"
      ? access.activeRole === "customer"
      : (expected === "retailer" ? access.retailer : access.distributor) === "approved");

  return { allowed, checking: loading || (!!user && access.loading) };
}
