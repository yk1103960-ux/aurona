import { useState } from "react";
import { BadgePercent, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inr } from "@/lib/format";

/** Coupon entry — the discount itself is always validated on the server. */
export function CouponBox({
  code,
  valid,
  checking,
  reason,
  discount,
  onApply,
  onRemove,
}: {
  code: string | null;
  valid: boolean;
  checking: boolean;
  reason: string | null;
  discount: number;
  onApply: (code: string) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState("");

  if (code && valid) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success/5 p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-success/15 text-success">
          <Check className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{code.toUpperCase()} applied</div>
          <div className="text-xs text-success">You saved {inr(discount)}</div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:text-destructive"
          aria-label="Remove coupon"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <BadgePercent className="h-4 w-4 text-primary" /> Apply a coupon
      </div>
      <div className="mt-3 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase().slice(0, 32))}
          placeholder="Enter coupon code"
          className="h-11 flex-1"
        />
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0 rounded-xl px-4"
          disabled={draft.trim().length < 2 || checking}
          onClick={() => onApply(draft.trim())}
        >
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
        </Button>
      </div>
      {code && !valid && !checking && (
        <p className="mt-2 text-xs font-medium text-destructive">
          {reason ?? "This coupon is not valid for your order."}
        </p>
      )}
    </div>
  );
}
