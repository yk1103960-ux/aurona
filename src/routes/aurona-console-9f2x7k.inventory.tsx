import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, Boxes, Minus, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminAdjustInventory, adminListInventory } from "@/lib/catalog-admin.functions";
import { useRealtime } from "@/hooks/useAdmin";

export const Route = createFileRoute("/aurona-console-9f2x7k/inventory")({
  component: InventoryAdmin,
});

type InventoryRow = {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  stock: number;
  reserved_stock: number;
  low_stock_threshold: number;
  is_active: boolean;
  updated_at: string;
  product_families: { name: string; slug: string; is_published: boolean } | null;
};

function InventoryAdmin() {
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [editing, setEditing] = useState<InventoryRow | null>(null);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["admin-inventory", search, lowOnly],
    queryFn: () => adminListInventory({ data: { search, lowOnly } }) as Promise<InventoryRow[]>,
  });

  useRealtime(["product_variants"], () => q.refetch());

  const adjust = async () => {
    if (!editing || !delta || reason.trim().length < 3) {
      toast.error("Enter a non-zero quantity and a clear reason");
      return;
    }
    setSaving(true);
    try {
      await adminAdjustInventory({ data: { variantId: editing.id, delta, reason: reason.trim() } });
      toast.success(`Inventory updated for ${editing.sku}`);
      setEditing(null);
      setDelta(0);
      setReason("");
      qc.invalidateQueries({ queryKey: ["admin-inventory"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update inventory");
    } finally {
      setSaving(false);
    }
  };

  const rows = q.data ?? [];
  const lowCount = rows.filter((row) => row.stock - row.reserved_stock <= row.low_stock_threshold).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><Boxes className="h-6 w-6" /> SKU Inventory</h1>
          <p className="mt-1 text-sm text-slate-500">Available, reserved and low-stock quantities for every sellable SKU.</p>
        </div>
        <Button variant={lowOnly ? "default" : "outline"} onClick={() => setLowOnly((value) => !value)}>
          <AlertTriangle className="mr-2 h-4 w-4" /> Low stock {lowCount ? `(${lowCount})` : ""}
        </Button>
      </div>

      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Search by SKU…" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="p-3">Product / SKU</th><th className="p-3">Options</th><th className="p-3 text-right">On hand</th><th className="p-3 text-right">Reserved</th><th className="p-3 text-right">Available</th><th className="p-3 text-right">Alert at</th><th className="p-3 text-right">Action</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const available = row.stock - row.reserved_stock;
                const low = available <= row.low_stock_threshold;
                return (
                  <tr key={row.id} className="border-t border-slate-200">
                    <td className="p-3"><div className="font-medium">{row.product_families?.name ?? "Product"}</div><div className="font-mono text-xs text-slate-500">{row.sku}</div></td>
                    <td className="p-3 text-xs text-slate-600">{Object.values(row.attributes ?? {}).filter(Boolean).join(" / ") || "Default"}</td>
                    <td className="p-3 text-right font-semibold">{row.stock}</td>
                    <td className="p-3 text-right text-slate-500">{row.reserved_stock}</td>
                    <td className={`p-3 text-right font-semibold ${low ? "text-rose-600" : "text-emerald-700"}`}>{available}</td>
                    <td className="p-3 text-right">{row.low_stock_threshold}</td>
                    <td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => { setEditing(row); setDelta(0); setReason(""); }}>Adjust</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!q.isLoading && rows.length === 0 && <div className="p-10 text-center text-sm text-slate-500">No SKUs match this view.</div>}
        {q.isLoading && <div className="p-10 text-center text-sm text-slate-500">Loading inventory…</div>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="Adjust inventory">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <div><h2 className="text-lg font-semibold">Adjust {editing.sku}</h2><p className="text-sm text-slate-500">Current on-hand quantity: {editing.stock}</p></div>
            <div className="grid grid-cols-[44px_1fr_44px] gap-2">
              <Button size="icon" variant="outline" onClick={() => setDelta((value) => value - 1)} aria-label="Decrease adjustment"><Minus className="h-4 w-4" /></Button>
              <Input type="number" value={delta} onChange={(event) => setDelta(Number(event.target.value))} className="text-center" />
              <Button size="icon" variant="outline" onClick={() => setDelta((value) => value + 1)} aria-label="Increase adjustment"><Plus className="h-4 w-4" /></Button>
            </div>
            <Input placeholder="Reason, e.g. stock received or damaged" value={reason} onChange={(event) => setReason(event.target.value)} />
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={adjust} disabled={saving}>{saving ? "Saving…" : "Apply adjustment"}</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
