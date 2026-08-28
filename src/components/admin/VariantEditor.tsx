import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Save } from "lucide-react";

type Variant = {
  id: string;
  family_id: string;
  sku: string;
  mrp: number | null;
  price: number | null;
  retailer_price: number | null;
  distributor_price: number | null;
  moq: number | null;
  stock: number | null;
};

const num = (v: string) => (v === "" ? null : Number(v));

/**
 * Editable grid of the variants belonging to the family that owns this product
 * SKU. Variant rows drive the prices shown on the storefront, so wholesale and
 * retail values must be editable here too.
 */
export function VariantEditor({ productSku, productId }: { productSku: string; productId: string }) {
  const [rows, setRows] = useState<Variant[]>([]);
  const [saving, setSaving] = useState(false);

  const q = useQuery({
    queryKey: ["admin-product-variants", productSku],
    enabled: !!productSku,
    queryFn: async () => {
      const { data: fam } = await supabase
        .from("product_families")
        .select("id, name")
        .eq("main_sku", productSku)
        .maybeSingle();
      if (!fam) return { family: null, variants: [] as Variant[] };
      const { data, error } = await supabase
        .from("product_variants")
        .select("id, family_id, sku, mrp, price, retailer_price, distributor_price, moq, stock")
        .eq("family_id", fam.id)
        .order("sort_order");
      if (error) throw error;
      return { family: fam, variants: (data ?? []) as Variant[] };
    },
  });

  useEffect(() => {
    if (q.data) setRows(q.data.variants);
  }, [q.data]);

  const family = q.data?.family;
  if (!family || rows.length === 0) return null;

  const upd = (id: string, patch: Partial<Variant>) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const saveAll = async () => {
    setSaving(true);
    for (const r of rows) {
      const { error } = await supabase
        .from("product_variants")
        .update({
          mrp: r.mrp ?? 0,
          price: r.price ?? 0,
          retailer_price: r.retailer_price,
          distributor_price: r.distributor_price,
          moq: r.moq ?? 1,
          stock: r.stock ?? 0,
        })
        .eq("id", r.id);
      if (error) {
        setSaving(false);
        return toast.error(`${r.sku}: ${error.message}`);
      }
    }

    // Keep the family range and the storefront product row in sync.
    const prices = rows.map((r) => Number(r.price ?? 0)).filter((n) => n > 0);
    const mrps = rows.map((r) => Number(r.mrp ?? 0)).filter((n) => n > 0);
    const stock = rows.reduce((s, r) => s + Number(r.stock ?? 0), 0);
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
    toast.success("Variant pricing saved");
    q.refetch();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 md:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-sm uppercase tracking-wider text-slate-500">
          Variants &amp; Wholesale Pricing
        </div>
        <Button size="sm" onClick={saveAll} disabled={saving}>
          <Save className="w-4 h-4 mr-1" /> {saving ? "Saving…" : "Save variants"}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="p-2 text-left">SKU</th>
              <th className="p-2 text-right">MRP</th>
              <th className="p-2 text-right">Price</th>
              <th className="p-2 text-right">Retailer</th>
              <th className="p-2 text-right">Distributor</th>
              <th className="p-2 text-right">MOQ</th>
              <th className="p-2 text-right">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-2 font-mono text-xs">{r.sku}</td>
                {(["mrp", "price", "retailer_price", "distributor_price", "moq", "stock"] as const).map((k) => (
                  <td key={k} className="p-2">
                    <Input
                      type="number"
                      className="h-9 text-right"
                      value={r[k] ?? ""}
                      onChange={(e) => upd(r.id, { [k]: num(e.target.value) } as Partial<Variant>)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-slate-500">
        Prices here drive the storefront. Leave retailer or distributor blank to fall back to the normal price.
      </div>
    </div>
  );
}
