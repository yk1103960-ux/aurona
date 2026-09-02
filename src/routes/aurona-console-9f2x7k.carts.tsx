import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Play, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { adminListAbandonedCarts, adminRunCartReminders } from "@/lib/cart-admin.functions";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/aurona-console-9f2x7k/carts")({
  component: AbandonedCartsPage,
});

function AbandonedCartsPage() {
  const qc = useQueryClient();
  const list = useServerFn(adminListAbandonedCarts);
  const run = useServerFn(adminRunCartReminders);

  const q = useQuery({
    queryKey: ["admin-abandoned-carts"],
    queryFn: () => list({}),
    refetchInterval: 30_000,
  });

  const runNow = useMutation({
    mutationFn: () => run({ data: { limit: 50 } }),
    onSuccess: (r: any) => {
      toast.success(`Recovery pass done — ${r.nudged} reminders, ${r.couponed} coupon offers`);
      qc.invalidateQueries({ queryKey: ["admin-abandoned-carts"] });
    },
    onError: () => toast.error("Could not run the recovery pass"),
  });

  const rows = q.data ?? [];
  const totalValue = rows.reduce((s: number, r: any) => s + r.cartValue, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Abandoned carts</h1>
          <p className="text-sm text-muted-foreground">
            Carts left untouched, with the reminder already sent. Nudge goes out after 1 hour, a 20% coupon after 24
            hours.
          </p>
        </div>
        <Button className="gap-2 rounded-full" disabled={runNow.isPending} onClick={() => runNow.mutate()}>
          <Play className="h-4 w-4" /> {runNow.isPending ? "Running…" : "Run recovery now"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Open carts", String(rows.length)],
          ["Cart value at risk", inr(totalValue)],
          ["Reminded", String(rows.filter((r: any) => r.lastReminderStage).length)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="mt-1 text-xl font-semibold">{value}</div>
          </div>
        ))}
      </div>

      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading carts…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          <ShoppingCart className="mx-auto mb-2 h-6 w-6" />
          No open carts right now.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Customer</th>
                <th className="p-3">Items</th>
                <th className="p-3">Value</th>
                <th className="p-3">Idle</th>
                <th className="p-3">Reminder</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.userId} className="border-t border-border/70">
                  <td className="p-3">
                    <div className="font-medium">{r.customerName || "Customer"}</div>
                    <div className="text-xs text-muted-foreground">{r.phone || "—"}</div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{r.accountType}</div>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {r.itemCount} · {r.productNames.join(", ")}
                  </td>
                  <td className="p-3 font-semibold">{inr(r.cartValue)}</td>
                  <td className="p-3 text-xs">{r.hoursIdle}h</td>
                  <td className="p-3 text-xs">
                    {r.lastReminderStage ? (
                      <div className="space-y-1">
                        <Badge variant="secondary">{r.lastReminderStage}</Badge>
                        <div className="text-muted-foreground">
                          {new Date(r.lastReminderAt).toLocaleString("en-IN")}
                        </div>
                        {r.couponCode && <div className="font-semibold text-primary">{r.couponCode}</div>}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Not sent</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
