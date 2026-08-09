import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "cart", label: "Cart", to: "/cart" },
  { key: "address", label: "Address", to: "/address" },
  { key: "checkout", label: "Checkout", to: "/checkout" },
  { key: "payment", label: "Payment", to: "/payment" },
] as const;

export type FlowStep = (typeof STEPS)[number]["key"];

/** Compact cart → address → checkout → payment progress rail. */
export function FlowSteps({ current }: { current: FlowStep }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-center gap-1.5 overflow-hidden text-[11px] font-semibold">
      {STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        const inner = (
          <span
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1",
              active && "bg-primary text-primary-foreground",
              done && "bg-primary/10 text-primary",
              !active && !done && "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px]",
                active && "bg-primary-foreground text-primary",
                done && "bg-primary text-primary-foreground",
                !active && !done && "border border-border",
              )}
            >
              {done ? <Check className="h-2.5 w-2.5" /> : i + 1}
            </span>
            {s.label}
          </span>
        );
        return (
          <li key={s.key} className="flex min-w-0 items-center gap-1.5">
            {done ? <Link to={s.to}>{inner}</Link> : inner}
            {i < STEPS.length - 1 && <span className="h-px w-3 shrink-0 bg-border" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
