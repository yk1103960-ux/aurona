import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAdmin } from "@/hooks/useAdmin";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Users,
  Image as ImageIcon,
  Ticket,
  Megaphone,
  Settings,
  Shield,
  LogOut,
  LockKeyhole,
  Mail,
  CreditCard,
  Truck,
  ScrollText,
  ShieldCheck,
  RotateCcw,
  Plug,
  Menu,
  Handshake,
  X,
  Boxes,
  BarChart3,
  Star,
  Inbox,
  ChevronDown,
  FileUp,
  Plus,
  PackageSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Search, RefreshCw, AlertTriangle } from "lucide-react";
import { isAdminPathActive, isAdminQueryKey } from "@/lib/admin-navigation";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type NavItem = { to: string; label: string; icon?: typeof Package; exact?: boolean };
type NavGroup = { label: string; icon: typeof Package; items: NavItem[] };

const DASHBOARD: NavItem = {
  to: "/aurona-console-9f2x7k",
  label: "Dashboard",
  icon: LayoutDashboard,
  exact: true,
};
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Products",
    icon: Package,
    items: [
      { to: "/aurona-console-9f2x7k/products", label: "All Products", exact: true },
      {
        to: "/aurona-console-9f2x7k/products/master",
        label: "Product Master",
        icon: PackageSearch,
      },
      { to: "/aurona-console-9f2x7k/products/new", label: "Add New Product", icon: Plus },
      { to: "/aurona-console-9f2x7k/products/bulk", label: "Bulk Import & Export", icon: FileUp },
      { to: "/aurona-console-9f2x7k/inventory", label: "SKU Inventory", icon: Boxes },
      { to: "/aurona-console-9f2x7k/categories", label: "Categories", icon: FolderTree },
      // { to: "/aurona-console-9f2x7k/products/options", label: "Brands & Attributes" },
      { to: "/aurona-console-9f2x7k/media", label: "Variation Images", icon: ImageIcon },
      { to: "/aurona-console-9f2x7k/reviews", label: "Product Reviews", icon: Star },
    ],
  },
  {
    label: "Sales",
    icon: ShoppingCart,
    items: [
      { to: "/aurona-console-9f2x7k/orders", label: "Orders" },
      { to: "/aurona-console-9f2x7k/returns", label: "Returns & Refunds", icon: RotateCcw },
      { to: "/aurona-console-9f2x7k/carts", label: "Abandoned Carts", icon: ShoppingCart },
      { to: "/aurona-console-9f2x7k/payments", label: "Payments", icon: CreditCard },
    ],
  },
  {
    label: "Customers & Partners",
    icon: Users,
    items: [
      { to: "/aurona-console-9f2x7k/customers", label: "Customers" },
      { to: "/aurona-console-9f2x7k/applications", label: "Partner Applications", icon: Handshake },
      { to: "/aurona-console-9f2x7k/affiliates", label: "Affiliates", icon: Handshake },
      { to: "/aurona-console-9f2x7k/editorial", label: "Partner Programs", icon: Handshake },
      { to: "/aurona-console-9f2x7k/careers", label: "Career Applications" },
    ],
  },
  {
    label: "Marketing",
    icon: Megaphone,
    items: [
      { to: "/aurona-console-9f2x7k/coupons", label: "Coupons", icon: Ticket },
      { to: "/aurona-console-9f2x7k/campaigns", label: "Campaigns" },
      { to: "/aurona-console-9f2x7k/content", label: "Homepage & Alerts" },
      { to: "/aurona-console-9f2x7k/editorial", label: "Blogs, Careers & FAQs", icon: ScrollText },
    ],
  },
  {
    label: "Operations",
    icon: Truck,
    items: [
      { to: "/aurona-console-9f2x7k/support", label: "Support Inbox", icon: Inbox },
      { to: "/aurona-console-9f2x7k/shipping", label: "Shipping" },
      { to: "/aurona-console-9f2x7k/shipping-rules", label: "Shipping & Tax Rules" },
      { to: "/aurona-console-9f2x7k/reports", label: "Reports", icon: BarChart3 },
      { to: "/aurona-console-9f2x7k/audit", label: "Audit Logs", icon: ScrollText },
    ],
  },
  {
    label: "Configuration",
    icon: Settings,
    items: [
      { to: "/aurona-console-9f2x7k/integrations", label: "Integrations", icon: Plug },
      { to: "/aurona-console-9f2x7k/security", label: "Security & 2FA", icon: ShieldCheck },
      { to: "/aurona-console-9f2x7k/roles", label: "Roles & Permissions", icon: LockKeyhole },
      { to: "/aurona-console-9f2x7k/settings", label: "Settings" },
    ],
  },
];

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function isNavActive(item: NavItem, pathname: string) {
  return isAdminPathActive(pathname, item.to, item.exact);
}

function currentAdminLabel(pathname: string) {
  if (/\/products\/[^/]+\/variations\/?$/.test(pathname)) return "Manage Variants";
  if (/\/orders\/[^/]+\/?$/.test(pathname)) return "Order Details";
  const direct = [DASHBOARD, ...NAV_GROUPS.flatMap((group) => group.items)].find((item) => isNavActive(item, pathname));
  if (direct) return direct.label;
  if (pathname.startsWith("/aurona-console-9f2x7k/products/")) return "Product Editor";
  if (pathname.startsWith("/aurona-console-9f2x7k/orders/")) return "Order Details";
  return "Console";
}

function AdminNavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavActive(item, pathname);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 ${active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"}`}
    >
      {Icon ? <Icon className="h-4 w-4" /> : <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {item.label}
    </Link>
  );
}

export function AdminShell() {
  const { user, isAdmin, loading } = useAdmin();
  const nav = useNavigate();
  const loc = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(["Products"]));
  const [searchOpen, setSearchOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const searchReturnFocus = useRef<HTMLElement | null>(null);
  const openPageSearch = useCallback(() => {
    searchReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMenuOpen(false);
    setSearchOpen(true);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (searchOpen) setSearchOpen(false);
        else openPageSearch();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [isAdmin, searchOpen, openPageSearch]);

  useEffect(() => {
    const active = NAV_GROUPS.find(
      (group) =>
        group.items.some((item) => isNavActive(item, loc.pathname)) ||
        (group.label === "Products" && loc.pathname.startsWith("/aurona-console-9f2x7k/products/")),
    );
    if (active) setOpenGroups((current) => new Set([...current, active.label]));
  }, [loc.pathname]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    document.body.dataset.adminConsole = "true";
    return () => {
      delete document.body.dataset.adminConsole;
    };
  }, [isAdmin]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [loc.pathname]);

  // Non-admin visitors are NOT bounced to the storefront — they get the admin
  // login screen so they can sign in with an authorized account instead.

  // Admin idle-session timeout: any inactivity beyond 30 minutes signs the
  // admin out of the console. Keeps the audit trail tight and reduces the
  // blast radius of an unattended workstation.
  useEffect(() => {
    if (!user || !isAdmin) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await supabase.auth.signOut();
        toast.info("Signed out due to inactivity");
        nav({ to: "/aurona-console-9f2x7k", replace: true });
      }, IDLE_TIMEOUT_MS);
    };
    const events: Array<keyof WindowEventMap> = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [user, isAdmin, nav]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Verifying admin access…</div>
    );
  }
  if (!user) return <AdminLogin />;
  if (!isAdmin) return <AdminLogin signedInAs={user.email ?? undefined} />;

  const signOut = async () => {
    await supabase.auth.signOut();
    nav({ to: "/aurona-console-9f2x7k", replace: true });
  };

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-amber-400" />
          <div>
            <div className="text-xs uppercase tracking-widest text-white/60">Aurona</div>
            <div className="text-sm font-semibold">Admin Console</div>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setMenuOpen(false)}
          aria-label="Close admin menu"
          className="lg:hidden text-white/70 hover:text-white hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <AdminNavLink item={DASHBOARD} pathname={loc.pathname} />
        {NAV_GROUPS.map((group) => {
          const containsActive = group.items.some((item) => isNavActive(item, loc.pathname));
          const expanded = openGroups.has(group.label);
          const Icon = group.icon;
          return (
            <div key={group.label} className="space-y-1">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() =>
                  setOpenGroups((current) => {
                    const next = new Set(current);
                    if (next.has(group.label)) next.delete(group.label);
                    else next.add(group.label);
                    return next;
                  })
                }
                className={`flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 ${containsActive ? "text-white" : "text-white/70 hover:bg-white/5 hover:text-white"}`}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
              {expanded && (
                <div className="ml-3 space-y-1 border-l border-white/10 pl-2">
                  {group.items.map((item) => (
                    <AdminNavLink key={item.to} item={item} pathname={loc.pathname} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/10 space-y-2">
        <div className="text-xs text-white/50 truncate px-2">{user.email}</div>
        <Button
          size="sm"
          variant="ghost"
          onClick={signOut}
          className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10"
        >
          <LogOut className="w-4 h-4 mr-2" /> Sign out
        </Button>
        <Link to="/" className="block text-xs text-white/50 hover:text-white px-2">
          ← Back to website
        </Link>
      </div>
    </>
  );

  return (
    <div className="admin-scope min-h-screen bg-slate-50 text-slate-900">
      <a
        href="#admin-page-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:p-3"
      >
        Skip to page content
      </a>
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setMenuOpen(true)}
          ref={menuTrigger}
          aria-label="Open admin menu"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <div className="flex min-w-0 items-center gap-2">
          <Shield className="w-4 h-4 shrink-0 text-amber-500" />
          <span className="truncate text-sm font-semibold">Aurona Admin</span>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="ml-auto"
          onClick={openPageSearch}
          aria-label="Find an admin page"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <aside className="admin-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-slate-950 text-slate-100 lg:flex">
        {sidebarContent}
      </aside>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!searchOpen) menuTrigger.current?.focus();
          }}
          side="left"
          className="admin-sidebar flex w-72 max-w-[86vw] flex-col gap-0 border-0 bg-slate-950 p-0 text-slate-100 [&>button]:hidden"
        >
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <SheetDescription className="sr-only">Choose an admin page. Press Escape to close the menu.</SheetDescription>
          {sidebarContent}
        </SheetContent>
      </Sheet>
      <main className="min-h-screen lg:pl-64">
        <header className="admin-topbar sticky top-0 z-20 hidden h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-6 backdrop-blur lg:flex">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-slate-400">Admin</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-700">{currentAdminLabel(loc.pathname)}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={openPageSearch}>
              <Search className="h-4 w-4" /> Find a page <kbd className="ml-2 text-xs text-slate-400">Ctrl / ⌘ K</kbd>
            </Button>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-50 text-xs font-bold text-sky-700">
              {(user.email?.[0] ?? "A").toUpperCase()}
            </span>
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-700">Administrator</div>
              <div className="max-w-56 truncate text-[11px] text-slate-400">{user.email}</div>
            </div>
          </div>
        </header>
        <div id="admin-page-content" tabIndex={-1} className="mx-auto min-w-0 max-w-[1480px] p-4 sm:p-6 lg:p-8">
          <AdminDataStatus />
          <Outlet />
        </div>
      </main>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent
          className="overflow-hidden p-0"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = searchReturnFocus.current;
            if (target?.isConnected && target.getClientRects().length) target.focus();
            else document.getElementById("admin-page-content")?.focus();
          }}
        >
          <DialogTitle className="sr-only">Find an admin page</DialogTitle>
          <DialogDescription className="sr-only">
            Search page names, then use arrow keys and Enter to open a page.
          </DialogDescription>
          <Command>
            <CommandInput placeholder="Products, prices, stock, orders…" />
            <CommandList className="max-h-[60vh]">
              <CommandEmpty>No matching page. Try a shorter search.</CommandEmpty>
              {[{ label: "Overview", items: [DASHBOARD] }, ...NAV_GROUPS].map((group) => (
                <CommandGroup key={group.label} heading={group.label}>
                  {group.items.map((item) => (
                    <CommandItem
                      key={item.to}
                      value={`${group.label} ${item.label} ${item.to.includes("master") ? "prices variants SKU dimensions" : ""}`}
                      onSelect={() => {
                        setSearchOpen(false);
                        void nav({ to: item.to });
                      }}
                    >
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminDataStatus() {
  const qc = useQueryClient();
  const cache = qc.getQueryCache();
  const failed = () =>
    cache
      .getAll()
      .filter((query) => query.isActive() && query.state.status === "error" && isAdminQueryKey(query.queryKey));
  const subscribe = useCallback((listener: () => void) => cache.subscribe(listener), [cache]);
  const snapshot = useCallback(
    () =>
      JSON.stringify(
        cache
          .getAll()
          .filter((query) => query.isActive() && query.state.status === "error" && isAdminQueryKey(query.queryKey))
          .map((query) => [query.queryHash, query.state.fetchStatus]),
      ),
    [cache],
  );
  useSyncExternalStore(subscribe, snapshot, () => "[]");
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const failures = failed();
  if (online && !failures.length) return null;
  return (
    <div
      role="alert"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
    >
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">{online ? "Some page data could not be loaded" : "You are offline"}</p>
          <p className="mt-1">
            {online
              ? "An empty table may not mean there are no records. Retry the failed requests; database setup or access may need attention."
              : "Displayed data may be out of date. Reconnect before saving changes."}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={!online || failures.some((query) => query.state.fetchStatus === "fetching")}
        onClick={() => {
          const hashes = new Set(failures.map((query) => query.queryHash));
          void qc.refetchQueries({
            type: "active",
            predicate: (query) => hashes.has(query.queryHash),
          });
        }}
      >
        <RefreshCw className="h-4 w-4" /> Retry failed requests
      </Button>
    </div>
  );
}

function AdminLogin({ signedInAs }: { signedInAs?: string }) {
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@aurona.in");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);

    const loginEmail = email.trim().toLowerCase() === "admin" ? "admin@aurona.in" : email.trim().toLowerCase();
    // Drop any existing (non-admin) storefront session first so the console
    // never mixes a customer session with an admin sign-in attempt.
    if (signedInAs) await supabase.auth.signOut();
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });

    if (error || !data.user) {
      setBusy(false);
      toast.error("Invalid admin login details");
      return;
    }

    const { data: role, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !role) {
      await supabase.auth.signOut();
      setBusy(false);
      toast.error("This account is not authorized for admin access");
      return;
    }

    setBusy(false);
    toast.success("Admin access verified");
    nav({ to: "/aurona-console-9f2x7k", replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1fr_440px]">
        <section className="hidden space-y-6 lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-sky-200">
            <Shield className="h-4 w-4" /> Confidential Access
          </div>
          <div>
            <h1 className="max-w-2xl text-5xl font-semibold leading-tight text-white">Aurona Admin Console</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
              A separate secure entry point for managing products, orders, customers, media and storefront settings.
            </p>
          </div>
          <div className="grid max-w-xl grid-cols-3 gap-3 text-xs text-slate-300">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">Role verified</div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">No public signup</div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">Noindex route</div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.07] p-6 shadow-2xl backdrop-blur sm:p-8">
          <div className="mb-7 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-sky-400 text-slate-950 shadow-lg shadow-sky-500/20">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-white">Admin Login</h2>
            <p className="mt-1 text-sm text-slate-300">Enter the admin password to continue.</p>
          </div>

          {signedInAs && (
            <div className="mb-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">
              You are signed in as <span className="font-semibold">{signedInAs}</span>, which has no admin access. Sign
              in below with an authorized admin account.
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  toast.info("Signed out");
                }}
                className="mt-2 block underline underline-offset-2 hover:text-white"
              >
                Sign out of {signedInAs}
              </button>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="admin-email" className="text-xs text-slate-200">
                Username / Email
              </Label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="admin-email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  className="h-12 border-white/10 bg-white/10 pl-10 text-white placeholder:text-slate-400"
                  placeholder="admin"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="admin-password" className="text-xs text-slate-200">
                Password
              </Label>
              <div className="relative mt-1.5">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="admin-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  className="h-12 border-white/10 bg-white/10 pl-10 text-white placeholder:text-slate-400"
                  placeholder="Admin password"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-xl bg-sky-400 font-semibold text-slate-950 hover:bg-sky-300"
            >
              {busy ? "Verifying…" : "Open Admin Panel"}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
