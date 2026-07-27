import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Save } from "lucide-react";

export const Route = createFileRoute("/aurona-console-9f2x7k/settings")({
  component: SettingsAdmin,
});

const KEYS = [
  { key: "company_name", label: "Company Name", default: "Aurona Lighting Industries" },
  { key: "company_tagline", label: "Tagline", default: "Light, sculpted for India" },
  { key: "contact_email", label: "Contact Email", default: "support@aurona.in" },
  { key: "contact_phone", label: "Contact Phone", default: "+91 " },
  { key: "whatsapp_number", label: "WhatsApp Number", default: "" },
  { key: "address_line", label: "Address", default: "" },
  { key: "social_instagram", label: "Instagram URL", default: "" },
  { key: "social_facebook", label: "Facebook URL", default: "" },
  { key: "social_youtube", label: "YouTube URL", default: "" },
  { key: "gst_percentage", label: "GST %", default: "18" },
  { key: "free_shipping_threshold", label: "Free Shipping Above (₹)", default: "999" },
  { key: "distributor_price_visible", label: "Show Distributor Prices ('true'/'false')", default: "true" },
  { key: "maintenance_mode", label: "Maintenance Mode ('true'/'false')", default: "false" },
];

function SettingsAdmin() {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const q = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("key, value");
      const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, string>;
      return map;
    },
  });
  useRealtime(["site_settings"], () => q.refetch());

  const val = (k: string) => drafts[k] ?? q.data?.[k] ?? KEYS.find((x) => x.key === k)?.default ?? "";

  const saveAll = async () => {
    setSaving(true);
    const rows = Object.entries(drafts).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }));
    if (!rows.length) { setSaving(false); return; }
    const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved — live now");
    setDrafts({});
    qc.invalidateQueries({ queryKey: ["admin-settings"] });
    qc.invalidateQueries({ queryKey: ["site_settings"] });
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Website Settings</h1>
          <p className="text-sm text-slate-500">Changes go live immediately.</p>
        </div>
        <Button onClick={saveAll} disabled={saving || !Object.keys(drafts).length}>
          <Save className="w-4 h-4 mr-1" /> {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y">
        {KEYS.map((k) => (
          <label key={k.key} className="grid md:grid-cols-[240px_1fr] gap-3 p-4 items-center">
            <div className="text-sm font-medium">{k.label}</div>
            <Input value={val(k.key)} onChange={(e) => setDrafts((d) => ({ ...d, [k.key]: e.target.value }))} />
          </label>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
        <div className="font-semibold mb-1">Payment & Shipping Providers</div>
        Payment gateways (Razorpay, PhonePe, Stripe) and Shiprocket configuration will live in Phase 3 alongside audit logs and 2FA.
      </div>
    </div>
  );
}
