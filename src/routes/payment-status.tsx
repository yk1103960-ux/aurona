import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { z } from "zod";
import { checkPhonePePayment } from "@/lib/phonepe.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/payment-status")({
  validateSearch: z.object({ order: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Payment Status — Aurona Lighting" },
      {
        name: "description",
        content: "Confirming your Aurona order payment and unlocking your order tracking details.",
      },
      { property: "og:title", content: "Payment Status — Aurona Lighting" },
      { property: "og:description", content: "Confirming your Aurona order payment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentStatusPage,
});

function PaymentStatusPage() {
  const { order } = useSearch({ from: "/payment-status" });
  const check = useServerFn(checkPhonePePayment);
  const [state, setState] = useState<
    "loading" | "paid" | "pending" | "failed" | "cancelled" | "expired"
  >("loading");
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  useEffect(() => {
    if (!order) {
      setState("failed");
      return;
    }
    let stopped = false;
    let attempts = 0;
    const map = {
      COMPLETED: "paid",
      FAILED: "failed",
      CANCELLED: "cancelled",
      EXPIRED: "expired",
      PENDING: "pending",
    } as const;

    const poll = async () => {
      attempts += 1;
      try {
        const res = await check({ data: { orderId: order } });
        if (stopped) return;
        setOrderNumber(res.orderNumber ?? null);
        const next = map[res.state as keyof typeof map] ?? "pending";
        setState(res.paid ? "paid" : next);
        // A bank may confirm a few seconds late — keep verifying server-side
        // instead of guessing from the browser redirect.
        if (!res.paid && next === "pending" && attempts < 6) {
          setTimeout(poll, 4000);
        }
      } catch {
        if (!stopped) setState(attempts < 3 ? "pending" : "failed");
        if (!stopped && attempts < 3) setTimeout(poll, 4000);
      }
    };
    poll();
    return () => {
      stopped = true;
    };
  }, [order, check]);

  return (
    <div className="container-x flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      {state === "loading" && (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <h1 className="text-display mt-6 text-2xl">Confirming your payment…</h1>
          <p className="mt-2 text-sm text-muted-foreground">Please don’t close this window.</p>
        </>
      )}
      {state === "paid" && (
        <>
          <CheckCircle2 className="h-12 w-12 text-primary" />
          <h1 className="text-display mt-6 text-3xl">Payment successful</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Order {orderNumber} is confirmed. We’ll notify you when it ships.
          </p>
        </>
      )}
      {(state === "cancelled" || state === "expired") && (
        <>
          <XCircle className="h-12 w-12 text-destructive" />
          <h1 className="text-display mt-6 text-2xl">
            {state === "cancelled" ? "Payment cancelled" : "Payment session expired"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No amount has been confirmed for order {orderNumber ?? "this order"}. You can retry
            payment from your orders page.
          </p>
        </>
      )}
      {state === "pending" && (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <h1 className="text-display mt-6 text-2xl">Your payment is being verified</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We’re confirming order {orderNumber ?? "your order"} with your bank. This page updates
            automatically — no amount is confirmed until verification completes.
          </p>
        </>
      )}
      {state === "failed" && (
        <>
          <XCircle className="h-12 w-12 text-destructive" />
          <h1 className="text-display mt-6 text-2xl">Payment not completed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Payment failed. No amount has been confirmed for this order. You can retry from your
            orders page.
          </p>
        </>
      )}
      <div className="mt-8 flex gap-3">
        <Button asChild className="rounded-full">
          <Link to="/account">View my orders</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/products">Continue shopping</Link>
        </Button>
      </div>
    </div>
  );
}
