import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BadgeCheck, Check, Copy, ExternalLink, IndianRupee, MousePointerClick, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyAffiliate } from "@/lib/affiliate.functions";
import { useAuth } from "@/hooks/useAuth";
import { inr } from "@/lib/format";

/**
 * Affiliate summary shown inside the account dashboard.
 * Rendered only for affiliates whose application an admin has approved.
 */
export function AffiliatePanel() {
  const { user } = useAuth();
  const load = useServerFn(getMyAffiliate);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["my-affiliate", user?.id],
    enabled: Boolean(user),
    queryFn: () => load({ data: {} as never }),
  });

  const aff = data?.affiliate;
  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />;
  }
  if (!aff || aff.status !== "approved") return null;

  const balance = data?.balance;
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/?ref=${encodeURIComponent(aff.code)}`
      : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Affiliate link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — please copy the link manually.");
    }
  };

  const commissions = data?.commissions ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <BadgeCheck className="h-4 w-4" /> Affiliate approved
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Referral code <span className="font-mono font-semibold text-foreground">{aff.code}</span> ·{" "}
              {aff.commission_kind === "percentage"
                ? `${aff.commission_value}% commission`
                : `${inr(aff.commission_value)} flat per unit`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-2 rounded-full" onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button asChild size="sm" className="gap-2 rounded-full">
              <Link to="/affiliate">
                Manage <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="mt-3 truncate rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-muted-foreground">
          {link}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile Icon={Wallet} label="Available to withdraw" value={inr(balance?.available ?? 0)} />
        <Tile Icon={IndianRupee} label="Approved earnings" value={inr(balance?.approved ?? 0)} />
        <Tile Icon={MousePointerClick} label="Pending" value={inr(balance?.pending ?? 0)} />
        <Tile Icon={BadgeCheck} label="Paid out" value={inr(balance?.paid ?? 0)} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-display text-lg">Recent commissions</h3>
        {commissions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No commissions yet. Share your link — earnings appear here once a referred order is placed.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {commissions.slice(0, 6).map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.order_number ?? "Order"}</div>
                  <div className="text-xs capitalize text-muted-foreground">
                    {c.status} · {new Date(c.created_at).toLocaleDateString("en-IN")}
                  </div>
                </div>
                <div className="shrink-0 font-semibold">{inr(Number(c.amount))}</div>
              </div>
            ))}
          </div>
        )}
        <Button asChild variant="outline" size="sm" className="mt-4 rounded-full">
          <Link to="/affiliate">Open affiliate dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

function Tile({ Icon, label, value }: { Icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" /> {label}
      </div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  );
}
