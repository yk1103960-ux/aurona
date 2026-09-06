import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  adminArchiveShippingZone,
  adminArchiveTaxRule,
  adminSaveShippingZone,
  adminSaveTaxRule,
} from "@/lib/operations-admin.functions";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/aurona-console-9f2x7k/shipping-rules")({
  component: RulesAdmin,
});
const db = supabase as any;
const emptyZone = {
  name: "",
  pincode_prefixes: "",
  states: "",
  flat_rate: 0,
  free_above: "",
  min_days: 3,
  max_days: 7,
  cod_allowed: true,
  active: true,
  sort_order: 0,
};
const emptyTax = { name: "", hsn_code: "", gst_percent: 18, applies_to: "all", active: true };

function RulesAdmin() {
  const qc = useQueryClient();
  const saveZone = useServerFn(adminSaveShippingZone);
  const archiveZone = useServerFn(adminArchiveShippingZone);
  const saveTax = useServerFn(adminSaveTaxRule);
  const archiveTax = useServerFn(adminArchiveTaxRule);
  const [zone, setZone] = useState<any>(null);
  const [tax, setTax] = useState<any>(null);
  const q = useQuery({
    queryKey: ["admin-shipping-rules"],
    queryFn: async () => {
      const [zones, taxes] = await Promise.all([
        db.from("shipping_zones").select("*").is("archived_at", null).order("sort_order"),
        db.from("tax_rules").select("*").is("archived_at", null).order("name"),
      ]);
      if (zones.error) throw zones.error;
      if (taxes.error) throw taxes.error;
      return { zones: zones.data ?? [], taxes: taxes.data ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-shipping-rules"] });
  const saveCurrentZone = async () => {
    try {
      await saveZone({
        data: {
          id: zone.id,
          name: zone.name,
          pincode_prefixes: split(zone.pincode_prefixes),
          states: split(zone.states),
          flat_rate: Number(zone.flat_rate),
          free_above: zone.free_above === "" ? null : Number(zone.free_above),
          min_days: Number(zone.min_days),
          max_days: Number(zone.max_days),
          cod_allowed: Boolean(zone.cod_allowed),
          active: Boolean(zone.active),
          sort_order: Number(zone.sort_order),
        },
      });
      toast.success("Shipping zone saved");
      setZone(null);
      refresh();
    } catch (error: any) {
      toast.error(error?.message || "Could not save zone");
    }
  };
  const saveCurrentTax = async () => {
    try {
      await saveTax({
        data: {
          id: tax.id,
          name: tax.name,
          hsn_code: tax.hsn_code || null,
          gst_percent: Number(tax.gst_percent),
          applies_to: tax.applies_to,
          active: Boolean(tax.active),
        },
      });
      toast.success("Tax rule saved");
      setTax(null);
      refresh();
    } catch (error: any) {
      toast.error(error?.message || "Could not save tax rule");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Shipping zones & tax rules</h1>
        <p className="text-sm text-slate-500">
          Fallback delivery pricing, service windows, COD eligibility and GST classification.
        </p>
      </div>
      <RuleSection title="Shipping zones" add={() => setZone({ ...emptyZone })}>
        {(q.data?.zones ?? []).map((item: any) => (
          <div
            key={item.id}
            className="grid gap-2 border-t p-4 text-sm md:grid-cols-[1fr_1fr_auto]"
          >
            <div>
              <b>{item.name}</b>
              <div className="text-xs text-slate-500">
                {item.states.length ? item.states.join(", ") : "All unmatched states"}
              </div>
            </div>
            <div>
              {inr(Number(item.flat_rate))} · {item.min_days}–{item.max_days} days · COD{" "}
              {item.cod_allowed ? "yes" : "no"}
            </div>
            <Actions
              edit={() =>
                setZone({
                  ...item,
                  states: item.states.join(", "),
                  pincode_prefixes: item.pincode_prefixes.join(", "),
                })
              }
              archive={async () => {
                if (confirm("Archive this shipping zone?")) {
                  await archiveZone({ data: { id: item.id } });
                  refresh();
                }
              }}
            />
          </div>
        ))}
      </RuleSection>
      <RuleSection title="Tax rules" add={() => setTax({ ...emptyTax })}>
        {(q.data?.taxes ?? []).map((item: any) => (
          <div
            key={item.id}
            className="grid gap-2 border-t p-4 text-sm md:grid-cols-[1fr_1fr_auto]"
          >
            <div>
              <b>{item.name}</b>
              <div className="text-xs text-slate-500">HSN {item.hsn_code || "default"}</div>
            </div>
            <div>
              {item.gst_percent}% GST · {item.applies_to}
            </div>
            <Actions
              edit={() => setTax(item)}
              archive={async () => {
                if (confirm("Archive this tax rule?")) {
                  await archiveTax({ data: { id: item.id } });
                  refresh();
                }
              }}
            />
          </div>
        ))}
      </RuleSection>
      <Dialog open={!!zone} onOpenChange={(open) => !open && setZone(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Shipping zone</DialogTitle>
          </DialogHeader>
          {zone && (
            <div className="grid gap-3">
              <Field
                label="Name"
                value={zone.name}
                set={(value) => setZone({ ...zone, name: value })}
              />
              <Field
                label="States (comma separated)"
                value={zone.states}
                set={(value) => setZone({ ...zone, states: value })}
              />
              <Field
                label="Pincode prefixes"
                value={zone.pincode_prefixes}
                set={(value) => setZone({ ...zone, pincode_prefixes: value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Flat rate"
                  type="number"
                  value={zone.flat_rate}
                  set={(value) => setZone({ ...zone, flat_rate: value })}
                />
                <Field
                  label="Free above"
                  type="number"
                  value={zone.free_above}
                  set={(value) => setZone({ ...zone, free_above: value })}
                />
                <Field
                  label="Min days"
                  type="number"
                  value={zone.min_days}
                  set={(value) => setZone({ ...zone, min_days: value })}
                />
                <Field
                  label="Max days"
                  type="number"
                  value={zone.max_days}
                  set={(value) => setZone({ ...zone, max_days: value })}
                />
              </div>
              <label className="flex gap-2">
                <Switch
                  checked={zone.cod_allowed}
                  onCheckedChange={(value) => setZone({ ...zone, cod_allowed: value })}
                />
                COD allowed
              </label>
            </div>
          )}
          <DialogFooter>
            <Button onClick={saveCurrentZone}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!tax} onOpenChange={(open) => !open && setTax(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tax rule</DialogTitle>
          </DialogHeader>
          {tax && (
            <div className="grid gap-3">
              <Field
                label="Name"
                value={tax.name}
                set={(value) => setTax({ ...tax, name: value })}
              />
              <Field
                label="HSN code"
                value={tax.hsn_code}
                set={(value) => setTax({ ...tax, hsn_code: value })}
              />
              <Field
                label="GST percent"
                type="number"
                value={tax.gst_percent}
                set={(value) => setTax({ ...tax, gst_percent: value })}
              />
              <Field
                label="Applies to"
                value={tax.applies_to}
                set={(value) => setTax({ ...tax, applies_to: value })}
              />
            </div>
          )}
          <DialogFooter>
            <Button onClick={saveCurrentTax}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function split(value: unknown) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
function RuleSection({
  title,
  add,
  children,
}: {
  title: string;
  add: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="flex items-center justify-between p-4">
        <h2 className="font-semibold">{title}</h2>
        <Button size="sm" onClick={add}>
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </div>
      {children}
    </div>
  );
}
function Actions({ edit, archive }: { edit: () => void; archive: () => void }) {
  return (
    <div>
      <Button size="sm" variant="outline" onClick={edit}>
        Edit
      </Button>{" "}
      <Button size="sm" variant="ghost" onClick={archive}>
        Archive
      </Button>
    </div>
  );
}
function Field({
  label,
  value,
  set,
  type,
}: {
  label: string;
  value: any;
  set: (value: string) => void;
  type?: string;
}) {
  return (
    <label>
      <Label>{label}</Label>
      <Input type={type} value={value ?? ""} onChange={(event) => set(event.target.value)} />
    </label>
  );
}
