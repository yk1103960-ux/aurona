import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Save, Plus, Trash2 } from "lucide-react";


type Variant = {
  id: string;
  family_id: string;
  sku: string;
  attributes: Record<string, string>;
  mrp: number | null;
  price: number | null;
  retailer_price: number | null;
  distributor_price: number | null;
  moq: number | null;
  retailer_moq: number | null;
  distributor_moq: number | null;
  stock: number | null;
  pack_size: number | null;
  weight_g: number | null;
  dim_l: number | null;
  dim_w: number | null;
  dim_h: number | null;
  is_active: boolean;
  sort_order: number;
};

const COLS = "id, family_id, sku, attributes, mrp, price, retailer_price, distributor_price, moq, retailer_moq, distributor_moq, stock, pack_size, weight_g, dim_l, dim_w, dim_h, is_active, sort_order";

const NUM_FIELDS = [
  ["mrp", "MRP"],
  ["price", "Price"],
  ["retailer_price", "Retailer"],
  ["distributor_price", "Distributor"],
  ["moq", "MOQ"],
  ["retailer_moq", "Ret. MOQ"],
  ["distributor_moq", "Dist. MOQ"],
  ["stock", "Stock"],
  ["pack_size", "Pack size"],
  ["weight_g", "Weight (g)"],
  ["dim_l", "L (cm)"],
  ["dim_w", "W (cm)"],
  ["dim_h", "H (cm)"],
] as const;

const num = (v: string) => (v === "" ? null : Number(v));

/**
 * Full variant workbench for the family that owns this product SKU: item code,
 * option values, every price tier, order quantities, stock, pack size, shipping
 * dimensions and availability — plus adding and removing variants.
 */
export function VariantEditor({ productSku, productId }: { productSku: string; productId: string }) {
  const [rows, setRows] = useState<Variant[]>([]);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  // Unsaved edits win over any background refresh.
  const dirty = useRef(false);

  const q = useQuery({
    queryKey: ["admin-product-variants", productSku],
    enabled: !!productSku,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data: fam } = await supabase
        .from("product_families")
        .select("id, name")
        .eq("main_sku", productSku)
        .maybeSingle();
      if (!fam) return { family: null, variants: [] as Variant[], axes: [] as { axis_key: string; label: string }[] };
      const [{ data, error }, { data: axes }] = await Promise.all([
        supabase.from("product_variants").select(COLS).eq("family_id", fam.id).order("sort_order"),
        supabase.from("product_variant_axes").select("axis_key, label, sort_order").eq("family_id", fam.id).order("sort_order"),
      ]);
      if (error) throw error;
      return {
        family: fam,
        variants: (data ?? []) as Variant[],
        axes: (axes ?? []) as { axis_key: string; label: string }[],
      };
    },
  });

  useRealtime(["product_variants"], () => {
    if (!dirty.current) q.refetch();
  });

  useEffect(() => {
    if (q.data && !dirty.current) setRows(q.data.variants);
  }, [q.data]);

  const family = q.data?.family;
  const axes = q.data?.axes ?? [];
  if (!family) return null;

  const axesBlock = <AxisEditor familyId={family.id} onSaved={() => q.refetch()} />;

  const upd = (id: string, patch: Partial<Variant>) => {
    dirty.current = true;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };


  const addRow = async () => {
    const { data, error } = await supabase
      .from("product_variants")
      .insert({
        family_id: family.id,
        sku: `${productSku}-NEW-${Date.now().toString().slice(-4)}`,
        attributes: {},
        mrp: 0,
        price: 0,
        moq: 1,
        stock: 0,
        sort_order: rows.length,
      })
      .select(COLS)
      .maybeSingle();
    if (error) return toast.error(error.message);
    if (data) setRows((r) => [...r, data as Variant]);
    toast.success("Variant added — set its item code and prices, then save");
  };

  const removeRow = async (r: Variant) => {
    if (!confirm(`Delete variant ${r.sku}?`)) return;
    const { error } = await supabase.from("product_variants").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    setRows((x) => x.filter((v) => v.id !== r.id));
    toast.success("Variant deleted");
  };

  const saveAll = async () => {
    setSaving(true);
    for (const r of rows) {
      const { error } = await supabase
        .from("product_variants")
        .update({
          sku: r.sku.trim(),
          attributes: r.attributes ?? {},
          mrp: r.mrp ?? 0,
          price: r.price ?? 0,
          retailer_price: r.retailer_price,
          distributor_price: r.distributor_price,
          moq: r.moq ?? 1,
          retailer_moq: r.retailer_moq,
          distributor_moq: r.distributor_moq,
          stock: r.stock ?? 0,
          pack_size: r.pack_size,
          weight_g: r.weight_g,
          dim_l: r.dim_l,
          dim_w: r.dim_w,
          dim_h: r.dim_h,
          is_active: r.is_active ?? true,
        })
        .eq("id", r.id);
      if (error) {
        setSaving(false);
        return toast.error(`${r.sku}: ${error.message}`);
      }
    }

    // Keep the family range and the storefront product row in sync.
    const live = rows.filter((r) => r.is_active !== false);
    const prices = live.map((r) => Number(r.price ?? 0)).filter((n) => n > 0);
    const mrps = live.map((r) => Number(r.mrp ?? 0)).filter((n) => n > 0);
    const stock = live.reduce((s, r) => s + Number(r.stock ?? 0), 0);
    await supabase
      .from("product_families")
      .update({
        min_price: prices.length ? Math.min(...prices) : null,
        max_price: prices.length ? Math.max(...prices) : null,
        min_mrp: mrps.length ? Math.min(...mrps) : null,
        max_mrp: mrps.length ? Math.max(...mrps) : null,
        total_stock: stock,
      })
      .eq("id", family.id);
    if (prices.length) {
      await supabase
        .from("products")
        .update({ price: Math.min(...prices), mrp: mrps.length ? Math.min(...mrps) : 0, stock })
        .eq("id", productId);
    }

    setSaving(false);
    dirty.current = false;
    toast.success("Variants saved");
    for (const key of ["products", "families-page", "product", "family", "family-products", "browse-products", "admin-products", "admin-product", "search-suggest"]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
    q.refetch();
  };


  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-semibold text-sm uppercase tracking-wider text-slate-500">
          Variants, pricing &amp; dimensions
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addRow}>
            <Plus className="w-4 h-4 mr-1" /> Add variant
          </Button>
          <Button size="sm" onClick={saveAll} disabled={saving || rows.length === 0}>
            <Save className="w-4 h-4 mr-1" /> {saving ? "Saving…" : "Save variants"}
          </Button>
        </div>
      </div>

      {axesBlock}

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No variants yet. Add one to start selling options for this product.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 p-3 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-[200px] flex-1 text-xs uppercase tracking-wider text-slate-500">
                  Item code (SKU)
                  <Input
                    className="mt-1 h-9 font-mono"
                    value={r.sku}
                    onChange={(e) => upd(r.id, { sku: e.target.value })}
                  />
                </label>
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <Switch
                    checked={r.is_active !== false}
                    onCheckedChange={(v) => upd(r.id, { is_active: v })}
                  />
                  Available
                </label>
                <Button size="sm" variant="outline" onClick={() => removeRow(r)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {axes.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {axes.map((a) => (
                    <label key={a.axis_key} className="text-xs uppercase tracking-wider text-slate-500">
                      {a.label}
                      <Input
                        className="mt-1 h-9"
                        value={(r.attributes ?? {})[a.axis_key] ?? ""}
                        onChange={(e) =>
                          upd(r.id, { attributes: { ...(r.attributes ?? {}), [a.axis_key]: e.target.value } })
                        }
                      />
                    </label>
                  ))}
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {NUM_FIELDS.map(([k, label]) => (
                  <label key={k} className="text-xs uppercase tracking-wider text-slate-500">
                    {label}
                    <Input
                      type="number"
                      className="mt-1 h-9 text-right"
                      value={r[k] ?? ""}
                      onChange={(e) => upd(r.id, { [k]: num(e.target.value) } as Partial<Variant>)}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-slate-500">
        Prices here drive the storefront. Leave retailer or distributor blank to fall back to the normal price. Weight and
        dimensions are used for shipping charges.
      </div>
    </div>
  );
}

type Axis = { id: string; axis_key: string; label: string; values: string[]; sort_order: number };

/** Manage the option lists (axes) shoppers pick from on the product page. */
function AxisEditor({ familyId, onSaved }: { familyId: string; onSaved: () => void }) {
  const [rows, setRows] = useState<Axis[]>([]);
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["admin-variant-axes", familyId],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variant_axes")
        .select("id, axis_key, label, values, sort_order")
        .eq("family_id", familyId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []).map((a) => ({
        ...a,
        values: Array.isArray(a.values) ? (a.values as string[]) : [],
      })) as Axis[];
    },
  });

  useEffect(() => {
    if (q.data && !dirty.current) setRows(q.data);
  }, [q.data]);

  const upd = (id: string, patch: Partial<Axis>) => {
    dirty.current = true;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const addAxis = async () => {
    const key = prompt("Option key (e.g. watt_option)")?.trim();
    if (!key) return;
    const { data, error } = await supabase
      .from("product_variant_axes")
      .insert({ family_id: familyId, axis_key: key, label: key.replace(/_/g, " "), values: [], sort_order: rows.length })
      .select("id, axis_key, label, values, sort_order")
      .maybeSingle();
    if (error) return toast.error(error.message);
    if (data) setRows((r) => [...r, { ...(data as any), values: [] }]);
  };

  const removeAxis = async (a: Axis) => {
    if (!confirm(`Delete option "${a.label}"?`)) return;
    const { error } = await supabase.from("product_variant_axes").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    setRows((r) => r.filter((x) => x.id !== a.id));
    toast.success("Option removed");
  };

  const saveAxes = async () => {
    setSaving(true);
    for (const a of rows) {
      const { error } = await supabase
        .from("product_variant_axes")
        .update({
          axis_key: a.axis_key.trim(),
          label: a.label.trim(),
          values: a.values.map((v) => v.trim()).filter(Boolean),
          sort_order: a.sort_order,
        })
        .eq("id", a.id);
      if (error) {
        setSaving(false);
        return toast.error(`${a.label}: ${error.message}`);
      }
    }
    setSaving(false);
    dirty.current = false;
    toast.success("Options saved");
    for (const key of ["product", "family", "family-products", "products", "admin-product-variants"]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
    q.refetch();
    onSaved();
  };

  return (
    <div className="rounded-lg border border-slate-200 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Product options (variant axes)</div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addAxis}>
            <Plus className="w-4 h-4 mr-1" /> Add option
          </Button>
          <Button size="sm" onClick={saveAxes} disabled={saving || rows.length === 0}>
            <Save className="w-4 h-4 mr-1" /> {saving ? "Saving…" : "Save options"}
          </Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No options yet. Add one (e.g. watt_option) to let shoppers choose.</p>
      ) : (
        rows.map((a) => (
          <div key={a.id} className="flex flex-wrap items-end gap-3">
            <label className="text-xs uppercase tracking-wider text-slate-500">
              Key
              <Input className="mt-1 h-9 font-mono w-40" value={a.axis_key} onChange={(e) => upd(a.id, { axis_key: e.target.value })} />
            </label>
            <label className="text-xs uppercase tracking-wider text-slate-500">
              Label
              <Input className="mt-1 h-9 w-40" value={a.label} onChange={(e) => upd(a.id, { label: e.target.value })} />
            </label>
            <label className="min-w-[240px] flex-1 text-xs uppercase tracking-wider text-slate-500">
              Values (comma separated)
              <Input
                className="mt-1 h-9"
                value={a.values.join(", ")}
                onChange={(e) => upd(a.id, { values: e.target.value.split(",").map((v) => v.replace(/^\s+/, "")) })}
              />
            </label>
            <Button size="sm" variant="outline" onClick={() => removeAxis(a)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))
      )}
      <p className="text-xs text-slate-500">
        These are the choices shown on the product page. Each variant below must use values from these lists.
      </p>
    </div>
  );
}
