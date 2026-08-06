import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { inr } from "@/lib/format";
import {
  LogOut, Package, Heart, ShoppingBag, MapPin, Headphones, Ticket, Gift,
  BadgeCheck, Sun, Moon, ChevronRight, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My Dashboard — Aurona Lighting" },
      { name: "description", content: "Track orders, manage addresses, wishlist and coupons in your Aurona account dashboard." },
      { property: "og:title", content: "My Dashboard — Aurona Lighting" },
      { property: "og:description", content: "Your Aurona orders, wishlist, addresses and rewards in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountPage,
});

const STATUS = ["placed", "confirmed", "packed", "shipped", "out_for_delivery", "delivered"] as const;
const STATUS_LABEL: Record<string, string> = {
  placed: "Placed", confirmed: "Confirmed", packed: "Packed", shipped: "Shipped",
  out_for_delivery: "Out for Delivery", delivered: "Delivered", cancelled: "Cancelled",
};

function AccountPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const cart = useCart();
  const wl = useWishlist();
  const qc = useQueryClient();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [user, loading, nav]);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  const orders = useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!user) return null;

  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const name = meta['full_name'] || user.email?.split("@")[0] || "Customer";
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  };

  return (
    <div className="container-x py-8">
      {/* Profile header */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="bg-nav px-6 py-7 text-nav-foreground sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-full border border-white/25 bg-white/10 text-xl font-bold">
                {initials}
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] opacity-70">My Dashboard</div>
                <div className="text-display mt-1 text-3xl leading-none">{name}</div>
                <div className="mt-1 text-xs opacity-75">{user.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold transition hover:bg-white/20"
              >
                {dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                {dark ? "Dark" : "Light"}
              </button>
              <Button onClick={signOut} variant="outline" className="gap-2 rounded-full border-white/25 bg-transparent text-nav-foreground hover:bg-white/15 hover:text-nav-foreground">
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </div>
          </div>
        </div>

        {/* Promo banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-gradient-to-r from-primary/10 via-sky/10 to-transparent px-6 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold">Extra 10% off your next lighting order</div>
              <div className="text-xs text-muted-foreground">Use code AURONA10 at checkout · limited period</div>
            </div>
          </div>
          <Button asChild size="sm" className="rounded-full">
            <Link to="/products">Shop now</Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat Icon={ShoppingBag} label="Cart items" value={cart.count} to="/cart" />
        <Stat Icon={Heart} label="Wishlist" value={wl.count} to="/wishlist" />
        <Stat Icon={Package} label="Orders" value={orders.data?.length ?? 0} to="/account" />
      </div>

      {/* Quick actions */}
      <div className="mt-8">
        <h2 className="text-display text-2xl">Quick actions</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Tile Icon={Package} title="My Orders" body="Track shipments and download invoices" to="/account" />
          <Tile Icon={MapPin} title="Addresses" body="Manage delivery addresses & pincodes" to="/checkout" />
          <Tile Icon={Heart} title="Wishlist" body="Products you saved for later" to="/wishlist" />
          <Tile Icon={Ticket} title="Coupons & Offers" body="Available discounts on your account" to="/deals" />
          <Tile Icon={Gift} title="Referrals" body="Earn rewards for every introduction" to="/careers" />
          <Tile Icon={Headphones} title="Help & Support" body="Raise a ticket or talk to our team" to="/customer-service" />
        </div>
      </div>

      {/* Orders */}
      <div className="mt-12">
        <h2 className="text-display text-2xl">Recent orders</h2>
        {orders.isLoading ? (
          <div className="mt-6 text-sm text-muted-foreground">Loading…</div>
        ) : (orders.data ?? []).length === 0 ? (
          <div className="mt-6 rounded-2xl border border-border bg-surface p-10 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-border bg-background shadow-soft">
              <Package className="h-6 w-6 text-primary" strokeWidth={1.4} />
            </div>
            <div className="text-display text-2xl">No orders yet</div>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Your orders, tracking updates and purchase history will appear here.
            </p>
            <Button asChild size="lg" className="mt-6 rounded-full">
              <Link to="/products">Start shopping</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {orders.data!.map((o: any) => (
              <div key={o.id} className="rounded-xl border border-border p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Order #{o.order_number}</div>
                    <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{inr(o.total)}</div>
                    <div className="text-xs text-muted-foreground">{o.order_items?.length ?? 0} items</div>
                  </div>
                </div>
                <div className="mt-5">
                  <Timeline status={o.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ Icon, label, value, to }: { Icon: any; label: string; value: number; to: string }) {
  return (
    <Link to={to} className="flex items-center justify-between rounded-2xl border border-border p-5 transition hover:shadow-lift">
      <div>
        <div className="text-eyebrow">{label}</div>
        <div className="text-display mt-1 text-3xl">{value}</div>
      </div>
      <div className="grid h-12 w-12 place-items-center rounded-full bg-surface">
        <Icon className="h-5 w-5 text-primary" />
      </div>
    </Link>
  );
}

function Tile({ Icon, title, body, to }: { Icon: any; title: string; body: string; to: string }) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lift"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[15px] font-semibold">
          {title}
          <ChevronRight className="h-4 w-4 opacity-30 transition-transform group-hover:translate-x-0.5 group-hover:opacity-70" />
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{body}</span>
      </span>
    </Link>
  );
}

function Timeline({ status }: { status: string }) {
  const idx = STATUS.indexOf(status as any);
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {STATUS.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div className={"flex flex-col items-center gap-1 " + (i <= idx ? "text-foreground" : "text-muted-foreground")}>
            <div className={"h-2.5 w-2.5 rounded-full " + (i <= idx ? "bg-primary" : "bg-border")} />
            <span className="whitespace-nowrap text-[10px] uppercase tracking-widest">{STATUS_LABEL[s]}</span>
          </div>
          {i < STATUS.length - 1 && <div className={"mx-1 h-px w-6 sm:w-10 " + (i < idx ? "bg-primary" : "bg-border")} />}
        </div>
      ))}
      {idx === STATUS.length - 1 && <BadgeCheck className="ml-2 h-4 w-4 text-primary" />}
    </div>
  );
}
