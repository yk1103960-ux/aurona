import { Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  BarChart3,
  Boxes,
  ChevronDown,
  CreditCard,
  FileText,
  FolderTree,
  Headphones,
  Image as ImageIcon,
  LayoutDashboard,
  Megaphone,
  Package,
  Plug,
  RotateCcw,
  Settings,
  Shield,
  ShoppingCart,
  Store,
  Upload,
  Users,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { AdminShell } from "@/components/admin/AdminShell";

const ROOT = "/aurona-console-9f2x7k";

type Item = { label: string; to: string };
type Group = { label: string; icon: typeof Package; items: Item[] };

// Recovered from the original customized Active eCommerce / Ecommain admin.
// Existing Remix routes are deliberately reused so the new storefront and its
// working Supabase data stay intact while the old admin information architecture
// is restored incrementally.
const groups: Group[] = [
  {
    label: "Products",
    icon: Package,
    items: [
      { label: "All Products", to: `${ROOT}/products` },
      { label: "Product Master", to: `${ROOT}/products/master` },
      { label: "Add New Product", to: `${ROOT}/products/new` },
      { label: "Categories", to: `${ROOT}/categories` },
      { label: "Bulk Import & Export", to: `${ROOT}/products/bulk` },
      { label: "Bulk Photo Upload", to: `${ROOT}/products/photos` },
      { label: "Product Reviews", to: `${ROOT}/reviews` },
    ],
  },
  {
    label: "Wholesale Products",
    icon: Boxes,
    items: [
      { label: "Customer / Retailer / Distributor", to: `${ROOT}/products/master` },
      { label: "SKU Inventory", to: `${ROOT}/inventory` },
      { label: "Partner Applications", to: `${ROOT}/applications` },
    ],
  },
  {
    label: "Sales",
    icon: ShoppingCart,
    items: [
      { label: "All Orders", to: `${ROOT}/orders` },
      { label: "Payments", to: `${ROOT}/payments` },
      { label: "Abandoned Carts", to: `${ROOT}/carts` },
    ],
  },
  {
    label: "Refunds",
    icon: RotateCcw,
    items: [{ label: "Refund Requests", to: `${ROOT}/returns` }],
  },
  {
    label: "Customers",
    icon: Users,
    items: [
      { label: "Customer List", to: `${ROOT}/customers` },
      { label: "Retailer / Distributor Applications", to: `${ROOT}/applications` },
    ],
  },
  {
    label: "Uploaded Files",
    icon: Upload,
    items: [
      { label: "Media / Uploads", to: `${ROOT}/media` },
      { label: "Product Photos", to: `${ROOT}/products/photos` },
    ],
  },
  {
    label: "Reports",
    icon: BarChart3,
    items: [
      { label: "Business Reports", to: `${ROOT}/reports` },
      { label: "Audit Logs", to: `${ROOT}/audit` },
    ],
  },
  {
    label: "Blog System",
    icon: FileText,
    items: [{ label: "Blogs & Editorial", to: `${ROOT}/editorial` }],
  },
  {
    label: "Marketing",
    icon: Megaphone,
    items: [
      { label: "Coupons", to: `${ROOT}/coupons` },
      { label: "Campaigns", to: `${ROOT}/campaigns` },
      { label: "Homepage & Alerts", to: `${ROOT}/content` },
    ],
  },
  {
    label: "Support",
    icon: Headphones,
    items: [{ label: "Support Inbox", to: `${ROOT}/support` }],
  },
  {
    label: "Affiliate System",
    icon: WalletCards,
    items: [
      { label: "Affiliate Users & Commissions", to: `${ROOT}/affiliates` },
      { label: "Partner Programs", to: `${ROOT}/editorial` },
    ],
  },
  {
    label: "Payment Gateways",
    icon: CreditCard,
    items: [
      { label: "Payments", to: `${ROOT}/payments` },
      { label: "Integrations", to: `${ROOT}/integrations` },
    ],
  },
  {
    label: "Website Setup",
    icon: Store,
    items: [
      { label: "Homepage & Content", to: `${ROOT}/content` },
      { label: "Shipping", to: `${ROOT}/shipping` },
    ],
  },
  {
    label: "Setup & Configurations",
    icon: Settings,
    items: [
      { label: "Settings", to: `${ROOT}/settings` },
      { label: "Shipping & Tax Rules", to: `${ROOT}/shipping-rules` },
      { label: "Integrations", to: `${ROOT}/integrations` },
    ],
  },
  {
    label: "System",
    icon: Shield,
    items: [
      { label: "Roles & Permissions", to: `${ROOT}/roles` },
      { label: "Security & 2FA", to: `${ROOT}/security` },
      { label: "Audit Logs", to: `${ROOT}/audit` },
    ],
  },
  {
    label: "Addon Manager",
    icon: Plug,
    items: [{ label: "Integrations / Addons", to: `${ROOT}/integrations` }],
  },
];

export function EcommainAdminShell() {
  const { user, isAdmin, loading } = useAdmin();
  const location = useLocation();
  const [open, setOpen] = useState<Set<string>>(() => new Set(["Products"]));

  // Keep the existing hardened login/session implementation until the recovered
  // Ecommain authentication behaviour is mapped safely.
  if (loading || !user || !isAdmin) return <AdminShell />;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 lg:grid lg:grid-cols-[270px_1fr]">
      <aside className="border-r border-slate-800 bg-[#17212b] text-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded bg-emerald-500 font-black text-white">A</div>
            <div>
              <div className="text-base font-bold tracking-wide">AURONA</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Ecommain Admin</div>
            </div>
          </div>
        </div>

        <nav className="space-y-1 p-3" aria-label="Ecommain administration">
          <Link
            to={ROOT}
            className={`flex items-center gap-3 rounded px-3 py-2.5 text-sm ${location.pathname === ROOT || location.pathname === `${ROOT}/` ? "bg-emerald-500 text-white" : "text-white/75 hover:bg-white/5 hover:text-white"}`}
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>

          {groups.map((group) => {
            const expanded = open.has(group.label);
            const active = group.items.some((item) => location.pathname.startsWith(item.to));
            const Icon = group.icon;
            return (
              <div key={group.label}>
                <button
                  type="button"
                  onClick={() =>
                    setOpen((current) => {
                      const next = new Set(current);
                      if (next.has(group.label)) next.delete(group.label);
                      else next.add(group.label);
                      return next;
                    })
                  }
                  className={`flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm ${active ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5 hover:text-white"}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{group.label}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>
                {expanded && (
                  <div className="ml-5 border-l border-white/10 py-1 pl-3">
                    {group.items.map((item) => (
                      <Link
                        key={`${group.label}-${item.label}`}
                        to={item.to}
                        className={`block rounded px-3 py-2 text-xs ${location.pathname.startsWith(item.to) ? "bg-emerald-500/20 text-emerald-300" : "text-white/55 hover:bg-white/5 hover:text-white"}`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <section className="min-w-0">
        <header className="flex min-h-16 items-center justify-between border-b bg-white px-4 shadow-sm sm:px-6">
          <div>
            <div className="text-sm font-semibold">Aurona Administration</div>
            <div className="text-xs text-slate-500">Recovered Ecommain / Active eCommerce structure</div>
          </div>
          <Link to="/" className="text-sm font-medium text-emerald-700 hover:underline">View storefront</Link>
        </header>
        <main className="p-4 sm:p-6"><Outlet /></main>
      </section>
    </div>
  );
}
