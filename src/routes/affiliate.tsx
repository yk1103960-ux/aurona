import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/affiliate")({
  head: () => ({ meta: [{ title: "Become an Aurona Partner" }] }),
  component: Aff,
});

function Aff() {
  const [busy, setBusy] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => { setBusy(false); toast.success("Thank you — our team will reach out shortly."); (e.target as HTMLFormElement).reset(); }, 800);
  };
  return (
    <div>
      <section className="bg-surface">
        <div className="container-x py-16">
          <div className="text-eyebrow">Retailer & Distributor</div>
          <h1 className="text-display mt-3 max-w-3xl text-5xl">Become an Aurona partner.</h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Join 1000+ retailers and distributors across India. Enjoy competitive margins, dedicated
            support and access to Aurona's full 150+ product portfolio.
          </p>
        </div>
      </section>

      <section className="container-x grid gap-10 py-16 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          <h2 className="text-display text-3xl">Why partner with Aurona</h2>
          <ul className="space-y-4 text-sm text-muted-foreground">
            <li>· Manufacturer-direct pricing and priority stock</li>
            <li>· Dedicated retailer & distributor support</li>
            <li>· Full 150+ product portfolio access</li>
            <li>· Marketing collateral and product training</li>
            <li>· Reliable after-sales & warranty support</li>
          </ul>
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6">
          <div className="text-eyebrow mb-4">Application</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <F l="Name" /><F l="Company" /><F l="Phone" /><F l="Email" type="email" />
            <F l="City" /><F l="State" /><F l="Business type" /><F l="GSTIN" />
          </div>
          <div className="mt-3">
            <Label className="text-xs">Message</Label>
            <Textarea className="mt-1" rows={4} />
          </div>
          <Button className="mt-6 h-11 w-full rounded-full" disabled={busy}>{busy ? "Submitting…" : "Submit application"}</Button>
        </form>
      </section>
    </div>
  );
}
function F({ l, type = "text" }: { l: string; type?: string }) {
  return (
    <div>
      <Label className="text-xs">{l}</Label>
      <Input required type={type} className="mt-1 h-11" />
    </div>
  );
}
