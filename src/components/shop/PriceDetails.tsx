import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PriceLine = { label: string; value: string; tone?: "default" | "success" | "muted" };

/** Amazon/Flipkart-style price breakdown card. */
export function PriceDetails({
  count,
  subtotal,
  mrpSavings,
  discount,
  couponCode,
  delivery,
  deliveryKnown,
  total,
  className,
}: {
  count: number;
  subtotal: number;
  mrpSavings: number;
  discount: number;
  couponCode?: string | null;
  delivery: number;
  deliveryKnown: boolean;
  total: number;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-surface p-4 sm:p-5", className)}>
      <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
        Price details
      </h2>
      <dl className="mt-4 space-y-2.5 text-sm">
        <Line label={`Price (${count} item${count === 1 ? "" : "s"})`} value={inr(subtotal + mrpSavings)} />
        {mrpSavings > 0 && (
          <Line label="Discount" value={`− ${inr(mrpSavings)}`} tone="success" />
        )}
        {discount > 0 && (
          <Line
            label={couponCode ? `Coupon (${couponCode.toUpperCase()})` : "Coupon discount"}
            value={`− ${inr(discount)}`}
            tone="success"
          />
        )}
        <Line
          label="Delivery charges"
          value={!deliveryKnown ? "—" : delivery === 0 ? "FREE" : inr(delivery)}
          tone={deliveryKnown && delivery === 0 ? "success" : "default"}
        />
      </dl>
      <div className="my-4 border-t border-dashed border-border" />
      <div className="flex items-baseline justify-between">
        <span className="text-base font-bold">Total amount</span>
        <span className="text-xl font-bold">{inr(total)}</span>
      </div>
      {mrpSavings + discount > 0 && (
        <p className="mt-3 rounded-xl bg-success/10 px-3 py-2 text-xs font-semibold text-success">
          You will save {inr(mrpSavings + discount)} on this order
        </p>
      )}
    </section>
  );
}

function Line({ label, value, tone = "default" }: PriceLine) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-medium",
          tone === "success" && "text-success",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
