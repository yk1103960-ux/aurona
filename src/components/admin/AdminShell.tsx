import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAdmin } from "@/hooks/useAdmin";
import { useEffect, useState } from "react";
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
  X,

} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const NAV = [
  { to: "/aurona-console-9f2x7k", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/aurona-console-9f2x7k/products", label: "Products", icon: Package },
  { to: "/aurona-console-9f2x7k/categories", label: "Categories", icon: FolderTree },
  { to: "/aurona-console-9f2x7k/orders", label: "Orders", icon: ShoppingCart },
  { to: "/aurona-console-9f2x7k/returns", label: "Returns & Refunds", icon: RotateCcw },
  { to: "/aurona-console-9f2x7k/customers", label: "Customers", icon: Users },
  { to: "/aurona-console-9f2x7k/media", label: "Media", icon: ImageIcon },
  { to: "/aurona-console-9f2x7k/coupons", label: "Coupons", icon: Ticket },
  { to: "/aurona-console-9f2x7k/content", label: "Content", icon: Megaphone },
  { to: "/aurona-console-9f2x7k/payments", label: "Payments", icon: CreditCard },
  { to: "/aurona-console-9f2x7k/shipping", label: "Shipping", icon: Truck },
  { to: "/aurona-console-9f2x7k/integrations", label: "Integrations", icon: Plug },
  { to: "/aurona-console-9f2x7k/audit", label: "Audit Logs", icon: ScrollText },

  { to: "/aurona-console-9f2x7k/security", label: "Security & 2FA", icon: ShieldCheck },
  { to: "/aurona-console-9f2x7k/settings", label: "Settings", icon: Settings },
];

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function AdminShell() {
  const { user, isAdmin, loading } = useAdmin();
  const nav = useNavigate();
  const loc = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

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
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Verifying admin access…
      </div>
    );
  }
  if (!user) return <AdminLogin />;
  if (!isAdmin) return <AdminLogin signedInAs={user.email ?? undefined} />;

  const signOut = async () => {
    await supabase.auth.signOut();
    nav({ to: "/aurona-console-9f2x7k", replace: true });
  };

  return (
    <div className="admin-scope min-h-screen bg-slate-50 text-slate-900">
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <Button size="icon" variant="ghost" onClick={() => setMenuOpen(true)} aria-label="Open admin menu">
          <Menu className="w-5 h-5" />
        </Button>
        <div className="flex min-w-0 items-center gap-2">
          <Shield className="w-4 h-4 shrink-0 text-amber-500" />
          <span className="truncate text-sm font-semibold">Aurona Admin</span>
        </div>
      </div>

      {menuOpen && (
        <button
          type="button"
          aria-label="Close admin menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 w-64 max-w-[82vw] bg-slate-950 text-slate-100 flex flex-col z-50 transition-transform duration-300 lg:w-60 lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between gap-2">
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
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV.map((item) => {
            const active = item.exact
              ? loc.pathname === item.to
              : loc.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${
                  active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10 space-y-2">
          <div className="text-xs text-white/50 truncate px-2">{user.email}</div>
          <Button size="sm" variant="ghost" onClick={signOut} className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10">
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
          <Link to="/" className="block text-xs text-white/50 hover:text-white px-2">
            ← Back to website
          </Link>
        </div>
      </aside>
      <main className="min-h-screen lg:pl-60">
        <div className="p-4 sm:p-6 max-w-[1400px] min-w-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@aurona.in");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);

    const loginEmail = email.trim().toLowerCase() === "admin" ? "admin@aurona.in" : email.trim().toLowerCase();
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
            <h1 className="max-w-2xl text-5xl font-semibold leading-tight text-white">
              Aurona Admin Console
            </h1>
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

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="admin-email" className="text-xs text-slate-200">Username / Email</Label>
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
              <Label htmlFor="admin-password" className="text-xs text-slate-200">Password</Label>
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

            <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-sky-400 font-semibold text-slate-950 hover:bg-sky-300">
              {busy ? "Verifying…" : "Open Admin Panel"}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
