import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, IndianRupee, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getProductAffiliateLink } from "@/lib/affiliate.functions";
import { useAuth } from "@/hooks/useAuth";
import { inr } from "@/lib/format";

/**
 * Shown on a product page only to approved affiliates: their personal share
 * link for THIS product plus what they earn per unit sold through it.
 */
export function ProductAffiliateBar({ productId, slug }: { productId: string | null; slug: string }) {
  const { user } = useAuth();
  const fetchLink = useServerFn(getProductAffiliateLink);
  const [copied, setCopied] = useState(false);

  const { data } = useQuery({
    queryKey: ["product-affiliate-link", productId, user?.id],
    enabled: Boolean(user && productId),
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchLink({ data: { productId: productId!, slug } }),
  });

  const aff = data?.affiliate;
  if (!aff || !aff.enabled) return null;

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/products/${slug}?ref=${encodeURIComponent(aff.code)}`
      : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Your product link is copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — please copy the link manually.");
    }
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "Aurona", url });
        return;
      } catch {
        // user dismissed the share sheet
      }
    }
    copy();
  };

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-eyebrow text-primary">Your affiliate link</div>
          {aff.commissionEnabled ? (
            <div className="mt-1 flex items-center gap-1 text-sm font-semibold text-foreground">
              <IndianRupee className="h-3.5 w-3.5" />
              {inr(aff.perUnitEarning).replace("₹", "")} per unit sold
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (
                {aff.commissionKind === "percentage"
                  ? `${aff.commissionValue}% commission`
                  : `${inr(aff.commissionValue)} flat`}
                )
              </span>
            </div>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">
              Share this product — commission on it is set by Aurona.
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-2 rounded-full" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button size="sm" className="gap-2 rounded-full" onClick={share}>
            <Share2 className="h-4 w-4" /> Share
          </Button>
        </div>
      </div>
      <div className="mt-3 truncate rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-muted-foreground">
        {url}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        {aff.clicks} click{aff.clicks === 1 ? "" : "s"} · {inr(aff.earned)} earned from this product
      </div>
    </div>
  );
}
