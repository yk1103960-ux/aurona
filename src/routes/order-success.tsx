import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { CheckCircle2, Package, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { EmptyState } from "@/components/empty/EmptyState";
import { inr } from "@/lib/format";
import { PageLoading } from "@/components/layout/PageLoading";

export const Route = createFileRoute("/order-success")({
  validateSearch: z.object({ order: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Order Placed — Aurona Lighting" },
      {
        name: "description",
        content: "Your Aurona order is confirmed. Track your shipment and delivery date here.",
      },
      { property: "og:title", content: "Order Placed — Aurona Lighting" },
      { property: "og:description", content: "Your Aurona order is confirmed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderSuccessPage,
});

function expectedRange() {
  const from = new Date();
  from.setDate(from.getDate() + 3);
  const to = new Date();
  to.setDate(to.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  return `${fmt(from)} – ${fmt(to)}`;
}

function OrderSuccessPage() {
  const { order } = Route.useSearch();
  const { user, loading } = useAuth();

  const q = useQuery({
    queryKey: ["order", order],
    enabled: Boolean(order) && Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, total, payment_method, payment_status, status, city, state, pincode")
        .eq("id", order!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (loading) return <PageLoading label="Loading your order" />;
  if (!order || (!q.isLoading && !q.data))
    return (
      <EmptyState
        icon={Package}
        eyebrow="Orders"
        title="We couldn’t find that order"
        description="Check your orders list for the latest status of every Aurona order."
        primary={{ label: "My orders", to: "/account" }}
        secondary={{ label: "Continue shopping", to: "/products" }}
      />
    );

  const o = q.data;

  return (
    <div className="container-x py-10">
      <div className="mx-auto max-w-lg text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/10">
          <CheckCircle2 className="h-9 w-9 text-success" />
        </span>
        <h1 className="mt-5 text-2xl font-bold sm:text-3xl">Order placed successfully</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Thank you for your order. We’ve emailed you the details and will notify you as it ships.
        </p>

        <div className="mt-7 space-y-3 rounded-2xl border border-border bg-surface p-5 text-left">
          <Row label="Order ID" value={o?.order_number ?? "—"} bold />
          <Row label="Total paid" value={o ? inr(Number(o.total)) : "—"} />
          <Row
            label="Payment"
            value={
              o?.payment_status === "paid"
                ? "Paid"
                : o?.payment_method === "cod"
                  ? "Cash on delivery"
                  : "Payment being verified"
            }
          />
          <Row label="Expected delivery" value={expectedRange()} />
          {o && <Row label="Delivering to" value={`${o.city}, ${o.state} — ${o.pincode}`} />}
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="h-12 flex-1 rounded-full">
            <Link to="/orders/$orderId" params={{ orderId: order }}>
              Track order
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-12 flex-1 rounded-full">
            <Link to="/products">
              <ShoppingBag className="mr-2 h-4 w-4" /> Continue shopping
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-bold" : "font-medium"}>{value}</span>
    </div>
  );
}
