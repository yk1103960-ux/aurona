import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { inr } from "@/lib/format";
import { LogOut, Package, Heart, ShoppingBag, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "My Account — Aurona" }] }),
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

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [user, loading, nav]);

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

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  };

  return (
    <div className="container-x py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-eyebrow">Account</div>
          <h1 className="text-display mt-2 text-3xl">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Button onClick={signOut} variant="outline" className="gap-2 rounded-full">
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat Icon={ShoppingBag} label="Cart items" value={cart.count} to="/cart" />
        <Stat Icon={Heart} label="Wishlist" value={wl.count} to="/wishlist" />
        <Stat Icon={Package} label="Orders" value={orders.data?.length ?? 0} to="/account" />
      </div>

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
        <Icon className="h-5 w-5 text-gold" />
      </div>
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
            <div className={"h-2.5 w-2.5 rounded-full " + (i <= idx ? "bg-gold" : "bg-border")} />
            <span className="whitespace-nowrap text-[10px] uppercase tracking-widest">{STATUS_LABEL[s]}</span>
          </div>
          {i < STATUS.length - 1 && <div className={"mx-1 h-px w-6 sm:w-10 " + (i < idx ? "bg-gold" : "bg-border")} />}
        </div>
      ))}
    </div>
  );
}
