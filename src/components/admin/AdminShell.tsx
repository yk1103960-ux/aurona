import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAdmin } from "@/hooks/useAdmin";
import { useEffect } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/categories", label: "Categories", icon: FolderTree },
  { to: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/media", label: "Media", icon: ImageIcon },
  { to: "/admin/coupons", label: "Coupons", icon: Ticket },
  { to: "/admin/content", label: "Content", icon: Megaphone },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell() {
  const { user, isAdmin, loading } = useAdmin();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/auth", replace: true });
    else if (!isAdmin) nav({ to: "/", replace: true });
  }, [user, isAdmin, loading, nav]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Verifying admin access…
      </div>
    );
  }
  if (!user || !isAdmin) return null;

  const signOut = async () => {
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 w-60 bg-slate-950 text-slate-100 flex flex-col z-40">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-xs uppercase tracking-widest text-white/60">Aurona</div>
              <div className="text-sm font-semibold">Admin Console</div>
            </div>
          </div>
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
      <main className="pl-60 min-h-screen">
        <div className="p-6 max-w-[1400px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
