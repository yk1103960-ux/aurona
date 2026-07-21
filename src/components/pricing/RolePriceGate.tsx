import { Link } from "@tanstack/react-router";
import { ShieldCheck, Clock, Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMyRole } from "@/lib/pricing";
import { useQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const settingsQuery = queryOptions({
  queryKey: ["site-settings-contact"],
  staleTime: 5 * 60_000,
  queryFn: async () => {
    const { data } = await supabase.from("site_settings").select("key,value")
      .in("key", ["support_phone", "support_email", "whatsapp_number", "social_whatsapp"]);
    const m: Record<string, string> = {};
    for (const r of (data ?? []) as { key: string; value: string }[]) m[r.key] = r.value;
    return m;
  },
});

export function useContactSettings() {
  return useQuery(settingsQuery);
}

/** Shows verification banner for pending partners */
export function PartnerVerificationBanner() {
  const role = useMyRole();
  if (!role.isPartnerPending) return null;
  const label = role.role === "distributor" ? "distributor" : "retailer";
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm">
      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div>
        <div className="font-semibold text-primary">Your {label} account is under verification</div>
        <div className="mt-0.5 text-muted-foreground">
          {label === "distributor" ? "Distributor" : "Retailer"} pricing will unlock once our team approves your application.
          For urgent orders, please contact sales.
        </div>
      </div>
    </div>
  );
}

/** Card shown to distributors instead of add-to-cart / buy-now */
export function ContactSalesCard({ productName, sku }: { productName?: string; sku?: string }) {
  const { data: s } = useContactSettings();
  const phone = s?.support_phone ?? "+91 96025 70026";
  const email = s?.support_email ?? "support@auronalighting.com";
  const wa = s?.social_whatsapp ?? "https://wa.me/919602570026";
  const subject = encodeURIComponent(`Distributor enquiry: ${productName ?? sku ?? "Aurona product"}`);
  const body = encodeURIComponent(`Hello Aurona Sales,\n\nI would like a distributor quote for:\nProduct: ${productName ?? ""}\nSKU: ${sku ?? ""}\n\nQuantity:\nRegion:\nCompany:\n\nRegards,`);
  return (
    <div className="rounded-2xl border-2 border-primary/25 bg-gradient-to-br from-primary/5 to-accent/10 p-5 shadow-sky">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
        <ShieldCheck className="h-4 w-4" /> Distributor Channel
      </div>
      <h3 className="mt-2 text-display text-2xl">Contact Sales for Distributor Pricing</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Distributor orders are handled directly by our sales team — no online checkout.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button asChild size="lg" className="h-12 gap-2 rounded-full">
          <a href={`tel:${phone.replace(/\s+/g, "")}`}>
            <Phone className="h-4 w-4" /> Call {phone}
          </a>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12 gap-2 rounded-full">
          <a href={wa} target="_blank" rel="noreferrer">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        </Button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button asChild variant="ghost" className="h-11 justify-start gap-2 rounded-lg text-xs">
          <a href={`mailto:${email}?subject=${subject}&body=${body}`}>
            📧 Request Quote via Email
          </a>
        </Button>
        <Button asChild variant="ghost" className="h-11 justify-start gap-2 rounded-lg text-xs">
          <a href={`mailto:${email}?subject=${encodeURIComponent("Schedule a business call")}`}>
            📅 Schedule Business Call
          </a>
        </Button>
      </div>

      <div className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">
        Sales: <span className="font-semibold text-foreground">{phone}</span> · {email}
      </div>
    </div>
  );
}

/** Simple sign-in prompt for guests */
export function LoginToViewPricing() {
  return (
    <Link to="/auth" className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10">
      Sign in to view your price
    </Link>
  );
}
