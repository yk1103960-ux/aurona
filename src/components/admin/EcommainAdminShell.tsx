import { Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  BarChart3,
  Boxes,
  ChevronDown,
  CreditCard,
  FileText,
  Headphones,
  LayoutDashboard,
  Megaphone,
  NotebookPen,
  Package,
  Plug,
  RotateCcw,
  Settings,
  Shield,
  ShoppingCart,
  Store,
  Upload,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { AdminShell } from "@/components/admin/AdminShell";

const ROOT = "/aurona-console-9f2x7k";
type Item = { label: string; to: string };
type Group = { label: string; icon: typeof Package; items: Item[] };

const dashboard = { label: "Dashboard", to: ROOT };
const groups: Group[] = [
  {
    label: "WooCommerce",
    icon: ShoppingCart,
    items: [
      { label: "Orders", to: `${ROOT}/orders` },
      { label: "Customers", to: `${ROOT}/customers` },
      { label: "Coupons", to: `${ROOT}/coupons` },
      { label: "Payments", to: `${ROOT}/payments` },
      { label: "Returns & Refunds", to: `${ROOT}/returns` },
      { label: "Shipping", to: `${ROOT}/shipping` },
      { label: "Shipping & Tax Rules", to: `${ROOT}/shipping-rules` },
      { label: "Analytics & Reports", to: `${ROOT}/reports` },
      { label: "Abandoned Carts", to: `${ROOT}/carts` },
    ],
  },
  {
    label: "Products",
    icon: Package,
    items: [
      { label: "All Products", to: `${ROOT}/products` },
      { label: "Add New Product", to: `${ROOT}/products/new` },
      { label: "Categories", to: `${ROOT}/categories` },
      { label: "Attributes & Brands", to: `${ROOT}/products/options` },
      { label: "Product Master", to: `${ROOT}/products/master` },
      { label: "Inventory", to: `${ROOT}/inventory` },
      { label: "Import & Export", to: `${ROOT}/products/bulk` },
      { label: "Product Images", to: `${ROOT}/products/photos` },
      { label: "Reviews", to: `${ROOT}/reviews` },
    ],
  },
  {
    label: "WholesaleX",
    icon: Boxes,
    items: [
      { label: "Wholesale Products & Pricing", to: `${ROOT}/wholesale` },
      { label: "Retailer / Distributor Applications", to: `${ROOT}/applications` },
      { label: "Partner Programs", to: `${ROOT}/editorial` },
      { label: "Roles & Permissions", to: `${ROOT}/roles` },
    ],
  },
  {
    label: "Marketing",
    icon: Megaphone,
    items: [
      { label: "Campaigns", to: `${ROOT}/campaigns` },
      { label: "Affiliate Program & Commissions", to: `${ROOT}/affiliates` },
      { label: "Homepage & Alerts", to: `${ROOT}/content` },
      { label: "Career Applications", to: `${ROOT}/careers` },
    ],
  },
  {
    label: "Appearance",
    icon: Store,
    items: [
      { label: "Website Setup", to: `${ROOT}/website-setup` },
      { label: "Media Library", to: `${ROOT}/media` },
      { label: "Blogs & Editorial", to: `${ROOT}/editorial` },
      { label: "Blog System", to: `${ROOT}/blog-system` },
    ],
  },
  {
    label: "Users",
    icon: Users,
    items: [
      { label: "Customers & Accounts", to: `${ROOT}/customers` },
      { label: "Partner Applications", to: `${ROOT}/applications` },
      { label: "Security & Two-Factor Auth", to: `${ROOT}/security` },
    ],
  },
  {
    label: "Plugins & Integrations",
    icon: Plug,
    items: [
      { label: "Payment Gateways", to: `${ROOT}/payment-gateways` },
      { label: "Shipping & Shiprocket", to: `${ROOT}/shipping` },
      { label: "Integrations", to: `${ROOT}/integrations` },
      { label: "Integration Shortcuts", to: `${ROOT}/addon-manager` },
    ],
  },
  {
    label: "Tools",
    icon: Upload,
    items: [
      { label: "Uploaded Files", to: `${ROOT}/uploaded-files` },
      { label: "Support Inbox", to: `${ROOT}/support` },
      { label: "Notes", to: `${ROOT}/notes` },
      { label: "Audit Logs", to: `${ROOT}/audit` },
    ],
  },
  {
    label: "Settings",
    icon: Settings,
    items: [
      { label: "General Settings", to: `${ROOT}/settings` },
      { label: "Configuration", to: `${ROOT}/configurations` },
      { label: "System", to: `${ROOT}/system` },
    ],
  },
];

function isItemActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function EcommainAdminShell() {
  const { user, isAdmin, loading } = useAdmin();
  const location = useLocation();
  const [open, setOpen] = useState<Set<string>>(() => new Set(["WooCommerce", "Products"]));

  if (loading || !user || !isAdmin) return <AdminShell />;

  const currentPage =
    groups.flatMap((group) => group.items).find((item) => isItemActive(location.pathname, item.to))
      ?.label ?? dashboard.label;

  return (
    <div className="min-h-screen bg-[#f1f1f1] text-[#1d2327] lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-r border-[#1d2327] bg-[#1d2327] text-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded bg-[#2271b1] font-bold">A</div>
            <div>
              <div className="font-semibold tracking-wide">AURONA</div>
              <div className="text-[10px] uppercase tracking-wider text-white/55">
                Store Administration
              </div>
            </div>
          </div>
        </div>
        <nav aria-label="Store administration" className="space-y-1 p-2">
          <Link
            to={ROOT}
            aria-current={
              location.pathname === ROOT || location.pathname === `${ROOT}/` ? "page" : undefined
            }
            className={`flex min-h-10 items-center gap-3 px-3 py-2 text-sm ${location.pathname === ROOT || location.pathname === `${ROOT}/` ? "bg-[#2271b1] text-white" : "text-white/80 hover:bg-black/20 hover:text-white"}`}
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
          {groups.map((group) => {
            const expanded = open.has(group.label);
            const active = group.items.some((item) => isItemActive(location.pathname, item.to));
            const Icon = group.icon;

            return (
              <section key={group.label}>
                <div className="flex">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() =>
                      setOpen((current) => {
                        const next = new Set(current);
                        if (next.has(group.label)) next.delete(group.label);
                        else next.add(group.label);
                        return next;
                      })
                    }
                    className={`flex min-h-10 flex-1 items-center gap-3 px-3 py-2 text-left text-sm ${active ? "text-white" : "text-white/75 hover:bg-black/20 hover:text-white"}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{group.label}</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
                {expanded && (
                  <div className="ml-5 border-l border-white/15 py-1 pl-3">
                    {group.items.map((item) => {
                      const itemActive = isItemActive(location.pathname, item.to);
                      return (
                        <Link
                          key={`${group.label}-${item.label}`}
                          to={item.to}
                          aria-current={itemActive ? "page" : undefined}
                          className={`block px-3 py-2 text-xs ${itemActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-black/20 hover:text-white"}`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </nav>
        <div className="border-t border-white/10 px-5 py-4 text-xs text-white/55">
          <div className="truncate">{user.email}</div>
          <Link to="/" className="mt-2 inline-block text-white/75 hover:text-white">
            Visit Store
          </Link>
        </div>
      </aside>
      <section className="min-w-0">
        <header className="flex min-h-16 items-center justify-between border-b border-[#c3c4c7] bg-white px-5">
          <div>
            <div className="text-sm font-semibold">{currentPage}</div>
            <div className="text-xs text-[#646970]">Aurona Store Administration</div>
          </div>
          <Link to="/" className="text-sm font-medium text-[#2271b1] hover:underline">
            Visit Store
          </Link>
        </header>
        <main className="min-w-0 p-4 sm:p-6">
          <Outlet />
        </main>
      </section>
    </div>
  );
}
