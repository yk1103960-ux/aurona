import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, MapPin, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact Aurona — Customer & Partner Support" }] }),
  component: Contact,
});

function Contact() {
  const [busy, setBusy] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => { setBusy(false); toast.success("Thanks — we'll reach out shortly."); (e.target as HTMLFormElement).reset(); }, 700);
  };
  return (
    <div className="container-x py-16">
      <div className="text-eyebrow">Support</div>
      <h1 className="text-display mt-3 text-5xl">Talk to Aurona.</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">Product enquiries, order support, warranty, and retailer/distributor questions.</p>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <Info Icon={Phone} label="Phone" v="+91 99999 99999" />
          <Info Icon={MessageCircle} label="WhatsApp" v="+91 99999 99999" />
          <Info Icon={Mail} label="Email" v="care@aurona.in" />
          <Info Icon={MapPin} label="Office" v="Aurona Industries, PAN India" />
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <F l="Full name" /><F l="Phone" />
            <F l="Email" type="email" full />
            <div className="sm:col-span-2">
              <Label className="text-xs">Category</Label>
              <select className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm" required>
                <option>Product enquiry</option><option>Order support</option><option>Warranty</option>
                <option>Retailer enquiry</option><option>Distributor enquiry</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Message</Label>
              <Textarea rows={5} required className="mt-1" />
            </div>
          </div>
          <Button className="mt-6 h-11 w-full rounded-full" disabled={busy}>{busy ? "Sending…" : "Send message"}</Button>
        </form>
      </div>
    </div>
  );
}
function F({ l, type = "text", full }: { l: string; type?: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <Label className="text-xs">{l}</Label>
      <Input required type={type} className="mt-1 h-11" />
    </div>
  );
}
function Info({ Icon, label, v }: { Icon: any; label: string; v: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border p-4">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-surface"><Icon className="h-4 w-4 text-gold" /></div>
      <div>
        <div className="text-eyebrow">{label}</div>
        <div className="mt-0.5 text-sm font-semibold">{v}</div>
      </div>
    </div>
  );
}
