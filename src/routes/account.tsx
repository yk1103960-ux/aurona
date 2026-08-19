import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AddressManager } from "@/components/account/AddressManager";
import { AvatarUpload } from "@/components/account/AvatarUpload";
import { useAvatarUrl } from "@/hooks/useAvatarUrl";
import { ReturnsPanel } from "@/components/account/ReturnsPanel";
import { PaymentLogos } from "@/components/layout/PaymentLogos";
import { PageLoading } from "@/components/layout/PageLoading";
import { EmptyState } from "@/components/empty/EmptyState";
import { ProductImage } from "@/components/product/ProductImage";
import {
  LogOut, Package, Heart, ShoppingBag, MapPin, Headphones, CreditCard, Bell,
  BadgeCheck, Sun, Moon, ChevronRight, Sparkles, LayoutDashboard, ShieldCheck,
  UserCog, Download, TrendingUp, IndianRupee, Clock, Trash2, RotateCcw, Activity,
} from "lucide-react";


export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My Dashboard — Aurona Lighting" },
      { name: "description", content: "Track orders, manage addresses, wishlist, invoices and support tickets in your Aurona account dashboard." },
      { property: "og:title", content: "My Dashboard — Aurona Lighting" },
      { property: "og:description", content: "Your Aurona orders, analytics, wishlist, addresses and rewards in one place." },
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

type Section =
  | "overview" | "orders" | "wishlist" | "cart" | "addresses"
  | "payments" | "returns" | "support" | "profile" | "security" | "notifications";

const NAV: { id: Section; label: string; Icon: any }[] = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "orders", label: "Orders & Tracking", Icon: Package },
  { id: "wishlist", label: "Wishlist", Icon: Heart },
  { id: "cart", label: "Cart Summary", Icon: ShoppingBag },
  { id: "addresses", label: "Addresses", Icon: MapPin },
  { id: "payments", label: "Payment Methods", Icon: CreditCard },
  { id: "returns", label: "Returns & Refunds", Icon: RotateCcw },
  { id: "support", label: "Support & Refunds", Icon: Headphones },
  { id: "notifications", label: "Notifications", Icon: Bell },
  { id: "profile", label: "Profile", Icon: UserCog },
  { id: "security", label: "Security", Icon: ShieldCheck },
];

function AccountPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const cart = useCart();
  const wl = useWishlist();
  const qc = useQueryClient();
  const [dark, setDark] = useState(false);
  const [section, setSection] = useState<Section>("overview");

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
      return (data ?? []) as any[];
    },
  });

  const tickets = useQuery({
    queryKey: ["my-tickets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const rows = orders.data ?? [];
  const stats = useMemo(() => {
    const delivered = rows.filter((o) => o.status === "delivered").length;
    const active = rows.filter((o) => !["delivered", "cancelled"].includes(o.status)).length;
    const spend = rows.reduce((s, o) => s + Number(o.total || 0), 0);
    return { delivered, active, spend, count: rows.length };
  }, [rows]);

  const monthly = useMemo(() => {
    const out: { key: string; label: string; total: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleString("en-IN", { month: "short" }),
        total: 0,
      });
    }
    for (const o of rows) {
      const d = new Date(o.created_at);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const slot = out.find((s) => s.key === k);
      if (slot) slot.total += Number(o.total || 0);
    }
    return out;
  }, [rows]);

  const activity = useMemo(() => {
    const items: { at: string; text: string }[] = [];
    for (const o of rows.slice(0, 5)) {
      items.push({ at: o.created_at, text: `Order #${o.order_number} — ${STATUS_LABEL[o.status] ?? o.status} · ${inr(o.total)}` });
    }
    for (const t of (tickets.data ?? []).slice(0, 3)) {
      items.push({ at: t.created_at, text: `Support ticket #${t.ticket_number} — ${t.status}` });
    }
    return items.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 6);
  }, [rows, tickets.data]);

  if (loading) return <PageLoading label="Loading your dashboard" />;
  if (!user)
    return (
      <EmptyState
        icon={LogOut}
        eyebrow="Sign in required"
        title="Sign in to your Aurona account"
        description="Track orders, manage addresses, saved items, invoices and support from one dashboard."
        primary={{ label: "Sign in / Register", to: "/auth" }}
        secondary={{ label: "Continue shopping", to: "/products" }}
      />
    );

  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const name = (profile.data?.full_name as string | null) || meta['full_name'] || user.email?.split("@")[0] || "Customer";
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  };

  return (
    <div className="container-x w-full overflow-hidden py-8">
      {/* Profile header */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="bg-nav px-4 py-6 text-nav-foreground sm:px-8 sm:py-7">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="shrink-0">
                <HeaderAvatar path={profile.data?.avatar_url as string | null | undefined} initials={initials} />
              </div>

              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] opacity-70">My Dashboard</div>
                <div className="mt-1 truncate text-display text-xl leading-none sm:text-3xl">{name}</div>
                <div className="mt-1 truncate text-xs opacity-75">{user.email}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold transition hover:bg-white/20 sm:px-4 sm:py-2 sm:text-xs"
              >
                {dark ? <Moon className="h-3.5 w-3.5 sm:h-4 w-4" /> : <Sun className="h-3.5 w-3.5 sm:h-4 w-4" />}
                <span className="hidden sm:inline">{dark ? "Dark" : "Light"}</span>
              </button>
              <Button onClick={signOut} variant="outline" size="sm" className="h-8 gap-2 rounded-full border-white/25 bg-transparent px-3 text-[10px] text-nav-foreground hover:bg-white/15 hover:text-nav-foreground sm:h-9 sm:px-4 sm:text-xs">
                <LogOut className="h-3.5 w-3.5 sm:h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          </div>
        </div>


        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-gradient-to-r from-primary/10 via-sky/10 to-transparent px-4 py-4 sm:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground sm:h-10 sm:w-10">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold sm:text-sm">Extra 10% off your next lighting order</div>
              <div className="truncate text-[10px] text-muted-foreground sm:text-xs">Use code AURONA10 at checkout</div>
            </div>
          </div>
          <Button asChild size="sm" className="shrink-0 rounded-full text-[10px] sm:text-xs">
            <Link to="/products">Shop now</Link>
          </Button>
        </div>

      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[248px_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-[200px] lg:self-start">
          <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-2 lg:flex-col lg:overflow-visible">
            {NAV.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={
                  "flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm transition " +
                  (section === id ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-surface")
                }
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.9} />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div>
          {section === "overview" && (
            <div className="space-y-8">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat Icon={Package} label="Total orders" value={String(stats.count)} />
                <Stat Icon={Clock} label="Active orders" value={String(stats.active)} />
                <Stat Icon={BadgeCheck} label="Delivered" value={String(stats.delivered)} />
                <Stat Icon={IndianRupee} label="Lifetime spend" value={inr(stats.spend)} />
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <h2 className="text-display text-xl">Spend, last 6 months</h2>
                  </div>
                  <div className="mt-6 flex h-40 items-end gap-3">
                    {monthly.map((m) => {
                      const max = Math.max(...monthly.map((x) => x.total), 1);
                      const h = Math.round((m.total / max) * 100);
                      return (
                        <div key={m.key} className="flex flex-1 flex-col items-center gap-2">
                          <div className="flex h-full w-full items-end">
                            <div
                              className="w-full rounded-t-lg bg-gradient-to-t from-primary/40 to-primary transition-all"
                              style={{ height: `${Math.max(h, 3)}%` }}
                              title={inr(m.total)}
                            />
                          </div>
                          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{m.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <h2 className="text-display text-xl">Recent activity</h2>
                  </div>
                  {activity.length === 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">No activity yet — your orders and tickets will show here.</p>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {activity.map((a, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                          <span className="min-w-0">
                            <span className="block text-[13px] leading-snug">{a.text}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(a.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-display text-2xl">Quick actions</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <Tile Icon={Package} title="Track orders" body="Live shipment status & invoices" onClick={() => setSection("orders")} />
                  <Tile Icon={Heart} title={`Wishlist (${wl.count})`} body="Products you saved for later" onClick={() => setSection("wishlist")} />
                  <Tile Icon={ShoppingBag} title={`Cart (${cart.count})`} body="Resume your checkout" onClick={() => setSection("cart")} />
                  <Tile Icon={MapPin} title="Addresses" body="Manage delivery addresses" onClick={() => setSection("addresses")} />
                  <Tile Icon={Headphones} title="Support" body="Tickets, refunds & conversations" onClick={() => setSection("support")} />
                  <Tile Icon={RotateCcw} title="Returns & refunds" body="Cancel, return or replace an order" onClick={() => setSection("returns")} />
                  <Tile Icon={ShieldCheck} title="Security" body="Password & account controls" onClick={() => setSection("security")} />
                </div>
              </div>
            </div>
          )}

          {section === "orders" && (
            <OrdersPanel loading={orders.isLoading} rows={rows} />
          )}

          {section === "wishlist" && (
            <Panel title="Wishlist" sub={`${wl.count} saved products`}>
              {wl.loading ? (
                <Skeletons />
              ) : wl.items.length === 0 ? (
                <Empty Icon={Heart} title="Nothing saved yet" body="Tap the heart on any product to keep it here." cta="Browse products" />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {wl.items.map((w) => (
                    <div key={w.id} className="flex gap-4 rounded-2xl border border-border bg-card p-4">
                      <Link to="/products/$slug" params={{ slug: w.products.slug }} className="shrink-0">
                        <ProductImage product={w.products} className="h-20 w-20" iconClassName="h-7 w-7" />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link to="/products/$slug" params={{ slug: w.products.slug }} className="line-clamp-2 text-sm font-semibold hover:text-primary">
                          {w.products.name}
                        </Link>
                        <div className="mt-1 text-sm font-semibold">{inr(w.products.price)}</div>
                        <div className="mt-2 flex gap-3 text-[11px]">
                          <button onClick={() => cart.add.mutate({ productId: w.product_id, sku: w.products.sku })} className="font-semibold text-primary">
                            Move to cart
                          </button>
                          <button onClick={() => wl.toggle.mutate({ productId: w.product_id, sku: w.products.sku })} className="text-muted-foreground hover:text-destructive">
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {section === "cart" && (
            <Panel title="Cart summary" sub={`${cart.count} items · ${inr(cart.subtotal)}`}>
              {cart.items.length === 0 ? (
                <Empty Icon={ShoppingBag} title="Your cart is empty" body="Add lighting or appliances to get started." cta="Start shopping" />
              ) : (
                <div className="space-y-3">
                  {cart.items.map((it) => (
                    <div key={it.id} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
                      <ProductImage product={it.products} className="h-16 w-16" iconClassName="h-6 w-6" />
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-1 text-sm font-semibold">{it.products.name}</div>
                        <div className="text-xs text-muted-foreground">Qty {it.quantity} · {inr(it.products.price)}</div>
                      </div>
                      <div className="text-sm font-semibold">{inr(Number(it.products.price) * it.quantity)}</div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between rounded-2xl border border-border bg-surface p-5">
                    <div>
                      <div className="text-eyebrow">Subtotal</div>
                      <div className="text-display text-2xl">{inr(cart.subtotal)}</div>
                    </div>
                    <Button asChild className="rounded-full">
                      <Link to="/checkout">Proceed to checkout</Link>
                    </Button>
                  </div>
                </div>
              )}
            </Panel>
          )}

          {section === "addresses" && <AddressManager userId={user.id} />}

          {section === "payments" && (
            <Panel title="Payment methods" sub="Secure payments powered by Razorpay">
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">We accept</div>
                <PaymentLogos className="mt-4 flex-wrap" />
                <p className="mt-5 text-sm text-muted-foreground">
                  For your security Aurona never stores card or UPI credentials. Cards, UPI and netbanking details are
                  entered on the encrypted payment page at checkout, and saved cards live with your bank or UPI app.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <MiniCard title="UPI / Paytm" body="Pay instantly from any UPI app" />
                  <MiniCard title="Cards" body="Visa, Mastercard, RuPay credit & debit" />
                  <MiniCard title="Netbanking" body="All major Indian banks supported" />
                  <MiniCard title="Cash on Delivery" body="Available on eligible pincodes" />
                </div>
              </div>
            </Panel>
          )}

          {section === "returns" && (
            <ReturnsPanel orders={rows} loading={orders.isLoading} />
          )}

          {section === "support" && (
            <Panel title="Support, refunds & conversations" sub="Tickets you have raised with our team">
              <div className="mb-5 flex flex-wrap gap-3">
                <Button asChild className="rounded-full">
                  <Link to="/customer-service">Raise a ticket</Link>
                </Button>
                <Button variant="outline" className="gap-2 rounded-full" onClick={() => setSection("returns")}>
                  <RotateCcw className="h-4 w-4" /> Request a refund / return
                </Button>
              </div>
              {tickets.isLoading ? (
                <Skeletons />
              ) : (tickets.data ?? []).length === 0 ? (
                <Empty Icon={Headphones} title="No tickets yet" body="Raise a ticket and our team replies within one business day." cta="Contact support" to="/customer-service" />
              ) : (
                <div className="space-y-3">
                  {tickets.data!.map((t) => (
                    <div key={t.id} className="rounded-2xl border border-border bg-card p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold">#{t.ticket_number} · {t.subject}</div>
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                          {t.status}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{t.message}</p>
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        {new Date(t.created_at).toLocaleString("en-IN")} · {t.category || "General"} · Priority {t.priority}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {section === "notifications" && (
            <Panel title="Notifications" sub="Order and account updates">
              {activity.length === 0 ? (
                <Empty Icon={Bell} title="You're all caught up" body="Order confirmations and shipping updates appear here." cta="Start shopping" />
              ) : (
                <div className="space-y-3">
                  {activity.map((a, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                        <Bell className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="text-sm">{a.text}</div>
                        <div className="text-[11px] text-muted-foreground">{new Date(a.at).toLocaleString("en-IN")}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {section === "profile" && <ProfilePanel userId={user.id} email={user.email ?? ""} data={profile.data} />}

          {section === "security" && <SecurityPanel onSignOut={signOut} />}
        </div>
      </div>
    </div>
  );
}

/* ---------- Orders ---------- */

function OrdersPanel({ loading, rows }: { loading: boolean; rows: any[] }) {
  const invoice = (o: any) => {
    const lines = (o.order_items ?? [])
      .map((i: any) => `<tr><td>${i.product_name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${inr(i.price)}</td></tr>`)
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${o.order_number}</title>
<style>body{font-family:Arial,sans-serif;padding:32px;color:#0f172a}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border-bottom:1px solid #e5e7eb;padding:8px;font-size:13px}.tot{margin-top:16px;font-size:14px}</style>
</head><body><h1>AURONA Lighting Industries — Invoice</h1>
<p><b>Order:</b> #${o.order_number}<br/><b>Date:</b> ${new Date(o.created_at).toLocaleDateString("en-IN")}<br/><b>Status:</b> ${STATUS_LABEL[o.status] ?? o.status}</p>
<p><b>Ship to:</b><br/>${o.full_name}<br/>${o.address}, ${o.city}, ${o.state} — ${o.pincode}<br/>${o.phone}</p>
<table><thead><tr><th align="left">Item</th><th>Qty</th><th align="right">Price</th></tr></thead><tbody>${lines}</tbody></table>
<div class="tot">Subtotal: ${inr(o.subtotal)}<br/>Discount: ${inr(o.discount)}<br/>Shipping: ${inr(o.shipping)}<br/><b>Total: ${inr(o.total)}</b></div>
</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Aurona-Invoice-${o.order_number}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Invoice downloaded");
  };

  return (
    <Panel title="Orders & tracking" sub={`${rows.length} orders · purchase history`}>
      {loading ? (
        <Skeletons />
      ) : rows.length === 0 ? (
        <Empty Icon={Package} title="No orders yet" body="Your orders, tracking updates and invoices will appear here." cta="Start shopping" />
      ) : (
        <div className="space-y-4">
          {rows.map((o) => (
            <div key={o.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">Order #{o.order_number}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
                    {new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    {o.payment_method ? ` · ${String(o.payment_method).toUpperCase()}` : ""}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-primary">{inr(o.total)}</div>
                  <div className="text-[10px] text-muted-foreground">{o.order_items?.length ?? 0} items</div>
                </div>
              </div>


              {(o.order_items ?? []).length > 0 && (
                <ul className="mt-3 space-y-1">
                  {o.order_items.map((i: any) => (
                    <li key={i.id} className="flex justify-between text-xs text-muted-foreground">
                      <span className="line-clamp-1">{i.product_name} × {i.quantity}</span>
                      <span>{inr(Number(i.price) * i.quantity)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-5">
                <Timeline status={o.status} />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link to="/orders/$orderId" params={{ orderId: o.id }} className="text-[11px] font-semibold text-primary">
                  View details
                </Link>
                <button onClick={() => invoice(o)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                  <Download className="h-3.5 w-3.5" /> Download invoice
                </button>
                {o.tracking_url && (
                  <a href={o.tracking_url} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-primary">
                    Track shipment {o.courier_name ? `(${o.courier_name})` : ""}
                  </a>
                )}
                {/* Cancellation is requested here and approved by our team. */}
                {["pending", "confirmed", "processing"].includes(o.status) && !o.awb_code && (
                  <Link
                    to="/orders/$orderId"
                    params={{ orderId: o.id }}
                    className="text-[11px] font-semibold text-destructive"
                  >
                    Request cancellation
                  </Link>
                )}

                <Link to="/customer-service" className="ml-auto text-[11px] text-muted-foreground hover:text-primary">
                  Need help with this order?
                </Link>
              </div>

            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ---------- Profile ---------- */

function HeaderAvatar({ path, initials }: { path?: string | null; initials: string }) {
  const signed = useAvatarUrl(path);
  return (
    <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-white/25 bg-white/10 text-xl font-bold">
      {signed.data ? <img src={signed.data} alt="Your profile picture" className="h-full w-full object-cover" /> : initials}
    </div>
  );
}

function ProfilePanel({ userId, email, data }: { userId: string; email: string; data: any }) {
  const qc = useQueryClient();

  const [full, setFull] = useState<string>(data?.full_name ?? "");
  const [phone, setPhone] = useState<string>(data?.phone ?? "");
  const [business, setBusiness] = useState<string>(data?.business_name ?? "");
  const [gstin, setGstin] = useState<string>(data?.gstin ?? "");

  useEffect(() => {
    setFull(data?.full_name ?? "");
    setPhone(data?.phone ?? "");
    setBusiness(data?.business_name ?? "");
    setGstin(data?.gstin ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (full.trim().length < 2) throw new Error("Please enter your full name");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: full.trim(),
          phone: phone.trim() || null,
          business_name: business.trim() || null,
          gstin: gstin.trim() || null,
        })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const initials = (full || email).trim().split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Panel title="Profile" sub="Your account details">
      <div className="mb-4">
        <AvatarUpload userId={userId} avatarPath={data?.avatar_url ?? null} initials={initials} />
      </div>
      <form

        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="grid gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2"
      >
        <Row label="Full name" v={full} set={setFull} />
        <Row label="Phone" v={phone} set={setPhone} />
        <Row label="Business name (optional)" v={business} set={setBusiness} />
        <Row label="GSTIN (optional)" v={gstin} set={setGstin} />
        <div className="sm:col-span-2">
          <Label className="text-xs">Email</Label>
          <Input value={email} disabled className="mt-1 h-11" />
          <p className="mt-1 text-[11px] text-muted-foreground">Contact support to change the email on your account.</p>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={save.isPending} className="h-11 rounded-full px-8">
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/* ---------- Security ---------- */

function SecurityPanel({ onSignOut }: { onSignOut: () => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");

  const change = useMutation({
    mutationFn: async () => {
      if (pw.length < 8) throw new Error("Password must be at least 8 characters");
      if (pw !== pw2) throw new Error("Passwords do not match");
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
    },
    onSuccess: () => {
      setPw(""); setPw2("");
      toast.success("Password updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel title="Security" sub="Password and account controls">
      <div className="space-y-6">
        <form
          onSubmit={(e) => { e.preventDefault(); change.mutate(); }}
          className="grid gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2"
        >
          <div className="sm:col-span-2 text-display text-xl">Change password</div>
          <div>
            <Label className="text-xs">New password</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="mt-1 h-11" required />
          </div>
          <div>
            <Label className="text-xs">Confirm new password</Label>
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="mt-1 h-11" required />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={change.isPending} className="h-11 rounded-full px-8">
              {change.isPending ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="text-display text-xl">Sessions</div>
          <p className="mt-2 text-sm text-muted-foreground">Sign out of this device. Your cart and wishlist stay saved to your account.</p>
          <Button onClick={onSignOut} variant="outline" className="mt-4 gap-2 rounded-full">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>

        <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-6">
          <div className="text-display text-xl">Delete account</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Deleting your account removes your profile, cart, wishlist and saved addresses. Order and invoice records are
            retained as required by law. Type <b>DELETE</b> to request removal — our team completes it within 48 hours.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Input
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder="Type DELETE"
              className="h-11 max-w-[200px]"
            />
            <Button
              variant="outline"
              disabled={confirmDelete !== "DELETE"}
              onClick={() => toast.success("Deletion request received — our team will confirm by email within 48 hours.")}
              className="gap-2 rounded-full border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" /> Request deletion
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ---------- Shared bits ---------- */

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-display text-2xl">{title}</h2>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Row({ label, v, set }: { label: string; v: string; set: (s: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={v} onChange={(e) => set(e.target.value)} className="mt-1 h-11" />
    </div>
  );
}

function MiniCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{body}</div>
    </div>
  );
}

function Skeletons() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-surface" />
      ))}
    </div>
  );
}

function Empty({ Icon, title, body, cta, to = "/products" }: { Icon: any; title: string; body: string; cta: string; to?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-10 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-border bg-background shadow-soft">
        <Icon className="h-6 w-6 text-primary" strokeWidth={1.4} />
      </div>
      <div className="text-display text-2xl">{title}</div>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{body}</p>
      <Button asChild size="lg" className="mt-6 rounded-full">
        <Link to={to}>{cta}</Link>
      </Button>
    </div>
  );
}

function Stat({ Icon, label, value }: { Icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-5">
      <div className="min-w-0">
        <div className="text-eyebrow">{label}</div>
        <div className="text-display mt-1 truncate text-2xl">{value}</div>
      </div>
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface">
        <Icon className="h-5 w-5 text-primary" />
      </div>
    </div>
  );
}

function Tile({ Icon, title, body, onClick }: { Icon: any; title: string; body: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lift"
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
    </button>
  );
}

function Timeline({ status }: { status: string }) {
  const idx = STATUS.indexOf(status as any);
  return (
    <div className="flex w-full items-center justify-between gap-1 sm:gap-2">
      {STATUS.map((s, i) => {
        const active = i <= idx;
        const last = i === STATUS.length - 1;
        return (
          <div key={s} className="flex min-w-0 flex-1 items-center gap-1">
            <div className={cn(
              "flex flex-col items-center gap-1 min-w-0 flex-1",
              active ? "text-foreground" : "text-muted-foreground"
            )}>
              <div className={cn(
                "h-2 w-2 shrink-0 rounded-full transition-colors sm:h-2.5 sm:w-2.5",
                active ? "bg-primary shadow-[0_0_8px_var(--color-primary)]" : "bg-border"
              )} />
              <span className="w-full truncate text-center text-[8px] font-bold uppercase tracking-tighter sm:text-[10px] sm:tracking-widest">
                {STATUS_LABEL[s]}
              </span>
            </div>
            {!last && (
              <div className={cn(
                "h-px flex-1 min-w-[4px] sm:min-w-[12px]",
                i < idx ? "bg-primary" : "bg-border"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

