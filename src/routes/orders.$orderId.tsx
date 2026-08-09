import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, MapPin, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { EmptyState } from "@/components/empty/EmptyState";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageLoading } from "@/components/layout/PageLoading";

export const Route = createFileRoute("/orders/$orderId")({
  head: () => ({
    meta: [
      { title: "Order Tracking — Aurona Lighting" },
      {
        name: "description",
        content: "Track your Aurona order status, shipment progress and delivery details.",
      },
      { property: "og:title", content: "Order Tracking — Aurona Lighting" },
      { property: "og:description", content: "Track your Aurona order and shipment progress." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderTrackingPage,
});

type OrderItemRow = { id: string; product_name: string; price: number; quantity: number };

const TIMELINE = [
  "Order placed",
  "Payment confirmed",
  "Processing",
  "Shipped",
  "Out for delivery",
  "Delivered",
] as const;

/** Maps the stored order/shipment status onto the customer-facing timeline. */
function stageOf(status: string, paymentStatus: string, shipmentStatus: string | null) {
  const s = (shipmentStatus ?? "").toLowerCase();
  if (status === "delivered" || s.includes("delivered")) return 5;
  if (s.includes("out for delivery")) return 4;
  if (status === "shipped" || s.includes("transit") || s.includes("shipped") || s.includes("picked"))
    return 3;
  if (status === "processing" || status === "confirmed") return 2;
  if (paymentStatus === "paid") return 1;
  return 0;
}

function OrderTrackingPage() {
  const { orderId } = Route.useParams();
  const { user, loading } = useAuth();

  const q = useQuery({
    queryKey: ["order-detail", orderId],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data: order, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, created_at, status, payment_status, payment_method, subtotal, discount, shipping, total, discount_code, full_name, phone, address, city, state, pincode, awb_code, courier_name, tracking_url, shipment_status",
        )
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      if (!order) return null;
      const { data: items } = await supabase
        .from("order_items")
        .select("id, product_name, price, quantity")
        .eq("order_id", orderId);
      return { order, items: (items ?? []) as OrderItemRow[] };
    },
  });

  if (loading) return <PageLoading label="Loading your order" />;
  if (!user)
    return (
      <EmptyState
        icon={Package}
        eyebrow="Sign in required"
        title="Sign in to track your order"
        description="Sign in with the account you used to place the order."
        primary={{ label: "Sign in / Register", to: "/auth" }}
      />
    );
  if (q.isLoading) return <PageLoading label="Loading your order" />;
  if (!q.data)
    return (
      <EmptyState
        icon={Package}
        eyebrow="Orders"
        title="We couldn’t find that order"
        description="This order isn’t available on your account. Check your orders list."
        primary={{ label: "My orders", to: "/account" }}
        secondary={{ label: "Continue shopping", to: "/products" }}
      />
    );

  const { order, items } = q.data;
  const stage = stageOf(order.status, order.payment_status, order.shipment_status);
  const placed = new Date(order.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className="pb-10">
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="container-x flex items-center gap-3 py-3">
          <Link to="/account" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-surface">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">{order.order_number}</h1>
            <p className="text-xs text-muted-foreground">Placed on {placed}</p>
          </div>
        </div>
      </div>

      <div className="container-x grid gap-5 py-5 lg:grid-cols-[1fr_380px] lg:gap-8">
        <div className="space-y-4">
          {/* Status */}
          <section className="rounded-2xl border border-border p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="rounded-full bg-primary/10 px-3 py-1 uppercase tracking-widest text-primary">
                {order.status}
              </span>
              <span
                className={cn(
                  "rounded-full px-3 py-1 uppercase tracking-widest",
                  order.payment_status === "paid"
                    ? "bg-success/10 text-success"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {order.payment_status === "paid"
                  ? "Paid"
                  : order.payment_method === "cod"
                    ? "Cash on delivery"
                    : "Payment pending"}
              </span>
            </div>

            <ol className="mt-5 space-y-0">
              {TIMELINE.map((label, i) => {
                const done = i <= stage;
                const last = i === TIMELINE.length - 1;
                return (
                  <li key={label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "grid h-6 w-6 shrink-0 place-items-center rounded-full border",
                          done ? "border-primary bg-primary text-primary-foreground" : "border-border",
                        )}
                      >
                        {done && <Check className="h-3 w-3" />}
                      </span>
                      {!last && (
                        <span className={cn("w-px flex-1", i < stage ? "bg-primary" : "bg-border")} />
                      )}
                    </div>
                    <div className={cn("pb-6", last && "pb-0")}>
                      <div className={cn("text-sm font-semibold", !done && "text-muted-foreground")}>
                        {label}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            {order.awb_code && (
              <div className="mt-2 rounded-xl bg-surface p-3 text-xs">
                <div className="font-semibold">Tracking number: {order.awb_code}</div>
                {order.tracking_url && (
                  <a
                    href={order.tracking_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block font-bold text-primary"
                  >
                    Track shipment
                  </a>
                )}
              </div>
            )}
          </section>

          {/* Items */}
          <section className="rounded-2xl border border-border">
            <h2 className="border-b border-border p-4 text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Items
            </h2>
            <ul className="divide-y divide-border">
              {items.map((it) => (
                <li key={it.id} className="flex items-baseline justify-between gap-3 p-4 text-sm">
                  <div className="min-w-0">
                    <p className="line-clamp-2 font-semibold">{it.product_name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Qty {it.quantity}</p>
                  </div>
                  <div className="shrink-0 font-bold">{inr(Number(it.price) * it.quantity)}</div>
                </li>
              ))}
            </ul>
          </section>

          {/* Address */}
          <section className="rounded-2xl border border-border p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
              <MapPin className="h-4 w-4" /> Delivery address
            </h2>
            <p className="mt-3 text-sm leading-relaxed">
              <span className="font-semibold">{order.full_name}</span>
              <br />
              <span className="text-muted-foreground">
                {order.address}, {order.city}, {order.state} — {order.pincode}
                <br />
                Mobile: {order.phone}
              </span>
            </p>
          </section>
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Price details
            </h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <Line label="Subtotal" value={inr(Number(order.subtotal))} />
              {Number(order.discount) > 0 && (
                <Line
                  label={order.discount_code ? `Discount (${order.discount_code})` : "Discount"}
                  value={`− ${inr(Number(order.discount))}`}
                  success
                />
              )}
              <Line
                label="Delivery charges"
                value={Number(order.shipping) === 0 ? "FREE" : inr(Number(order.shipping))}
                success={Number(order.shipping) === 0}
              />
            </dl>
            <div className="my-4 border-t border-dashed border-border" />
            <div className="flex items-baseline justify-between">
              <span className="text-base font-bold">Total amount</span>
              <span className="text-xl font-bold">{inr(Number(order.total))}</span>
            </div>
          </section>
          <Button asChild variant="outline" className="h-12 w-full rounded-full">
            <Link to="/products">Continue shopping</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}

function Line({ label, value, success }: { label: string; value: string; success?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium", success && "text-success")}>{value}</dd>
    </div>
  );
}
