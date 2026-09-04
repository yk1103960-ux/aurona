import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useAdmin";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Copy, Trash2, Eye, EyeOff, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/aurona-console-9f2x7k/products/")({
  component: ProductsAdmin,
});

function ProductsAdmin() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;
  const qc = useQueryClient();
  const nav = useNavigate();

  const q = useQuery({
    queryKey: ["admin-products", search, page],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, name, sku, slug, price, mrp, stock, is_published, is_featured, is_bestseller, category_id, image_seed", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      const { data, error, count } = await query;
      if (error) throw error;
      const rows = data ?? [];

      // Variant-based products keep their prices on product_variants, so the
      // products row can be 0. Resolve a display range for those.
      const zeroSkus = rows.filter((r) => !Number(r.price)).map((r) => r.sku);
      const ranges: Record<string, { min: number; max: number }> = {};
      if (zeroSkus.length) {
        const { data: fams } = await supabase
          .from("product_families")
          .select("main_sku, min_price, max_price, id")
          .in("main_sku", zeroSkus);
        for (const fam of fams ?? []) {
          const { data: vs } = await supabase
            .from("product_variants")
            .select("price")
            .eq("family_id", fam.id);
          const prices = (vs ?? []).map((v) => Number(v.price)).filter((n) => n > 0);
          const min = prices.length ? Math.min(...prices) : Number(fam.min_price ?? 0);
          const max = prices.length ? Math.max(...prices) : Number(fam.max_price ?? 0);
          if (min > 0) ranges[fam.main_sku] = { min, max };
        }
      }
      return { rows, count: count ?? 0, ranges };
    },
  });
  useRealtime(["products"], () => q.refetch());

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    if (!q.data) return;
    if (selected.size === q.data.rows.length) setSelected(new Set());
    else setSelected(new Set(q.data.rows.map((r) => r.id)));
  };

  const bulkAction = async (action: "publish" | "unpublish" | "delete") => {
    const ids = [...selected];
    if (!ids.length) return;
    if (action === "delete" && !confirm(`Delete ${ids.length} product(s)? This cannot be undone.`)) return;
    const table = supabase.from("products");
    const { error } =
      action === "delete"
        ? await table.delete().in("id", ids)
        : await table.update({ is_published: action === "publish" }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} product(s) ${action}d`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  const duplicate = async (id: string) => {
    const { data: src } = await supabase.from("products").select("*").eq("id", id).single();
    if (!src) return;
    const stamp = Date.now().toString(36);
    const clone = { ...(src as Record<string, unknown>) };
    delete clone.id; delete clone.created_at;
    clone.slug = `${src.slug}-copy-${stamp}`;
    clone.sku = `${src.sku}-COPY-${stamp}`;
    clone.name = `${src.name} (Copy)`;
    clone.is_published = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("products").insert(clone as any);
    if (error) return toast.error(error.message);
    toast.success("Duplicated");
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  const removeOne = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  const togglePublish = async (id: string, is_published: boolean) => {
    const { error } = await supabase.from("products").update({ is_published: !is_published }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-sm text-slate-500">{q.data?.count ?? "…"} total</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => nav({ to: "/aurona-console-9f2x7k/products/bulk" })}>Bulk Upload</Button>
          <Button onClick={() => nav({ to: "/aurona-console-9f2x7k/products/new" })}>
            <Plus className="w-4 h-4 mr-1" /> New Product
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search by name or SKU…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 bg-slate-900 text-white rounded-md px-3 py-1.5 text-sm">
            <span>{selected.size} selected</span>
            <Button size="sm" variant="ghost" className="h-7 text-white hover:bg-white/10" onClick={() => bulkAction("publish")}>Publish</Button>
            <Button size="sm" variant="ghost" className="h-7 text-white hover:bg-white/10" onClick={() => bulkAction("unpublish")}>Unpublish</Button>
            <Button size="sm" variant="ghost" className="h-7 text-rose-300 hover:bg-white/10" onClick={() => bulkAction("delete")}>Delete</Button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="p-3 text-left w-8"><input type="checkbox" onChange={toggleAll} checked={!!q.data && selected.size === q.data.rows.length && q.data.rows.length > 0} /></th>
              <th className="p-3 text-left">Product</th>
              <th className="p-3 text-left">SKU</th>
              <th className="p-3 text-right">Price</th>
              <th className="p-3 text-right">Stock</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(q.data?.rows ?? []).map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="p-3"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></td>
                <td className="p-3">
                  <Link to="/aurona-console-9f2x7k/products/$id" params={{ id: p.id }} className="font-medium hover:text-sky-600">{p.name}</Link>
                  <div className="text-xs text-slate-500">{p.slug}</div>
                </td>
                <td className="p-3 text-xs font-mono text-slate-600">{p.sku}</td>
                <td className="p-3 text-right">
                  {Number(p.price) > 0 ? (
                    <>
                      <div className="font-semibold">{inr(Number(p.price))}</div>
                      {p.mrp && Number(p.mrp) > Number(p.price) && <div className="text-xs line-through text-slate-400">{inr(Number(p.mrp))}</div>}
                    </>
                  ) : q.data?.ranges?.[p.sku] ? (
                    <div className="font-semibold">
                      {inr(q.data.ranges[p.sku].min)}
                      {q.data.ranges[p.sku].max > q.data.ranges[p.sku].min && ` – ${inr(q.data.ranges[p.sku].max)}`}
                      <div className="text-xs font-normal text-slate-400">from variants</div>
                    </div>
                  ) : (
                    <Link to="/aurona-console-9f2x7k/products/$id" params={{ id: p.id }} className="text-xs font-medium text-amber-600 hover:underline">Set price</Link>
                  )}
                </td>
                <td className={`p-3 text-right font-semibold ${p.stock < 10 ? "text-rose-600" : ""}`}>{p.stock}</td>
                <td className="p-3 text-center">
                  <button onClick={() => togglePublish(p.id, p.is_published)} className={`px-2 py-1 rounded text-xs font-medium ${p.is_published ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                    {p.is_published ? "Published" : "Hidden"}
                  </button>
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Link to="/aurona-console-9f2x7k/products/$id" params={{ id: p.id }} className="p-1.5 hover:bg-slate-100 rounded" title="Edit"><Pencil className="w-4 h-4" /></Link>
                    <button onClick={() => togglePublish(p.id, p.is_published)} className="p-1.5 hover:bg-slate-100 rounded" title={p.is_published ? "Hide" : "Publish"}>
                      {p.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => duplicate(p.id)} className="p-1.5 hover:bg-slate-100 rounded" title="Duplicate"><Copy className="w-4 h-4" /></button>
                    <button onClick={() => removeOne(p.id)} className="p-1.5 hover:bg-rose-50 text-rose-600 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {q.isLoading && (
              <tr><td colSpan={7} className="p-8 text-center text-slate-500">Loading…</td></tr>
            )}
            {!q.isLoading && q.data?.rows.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-slate-500">No products found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {q.data && q.data.count > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <div>Page {page + 1} of {Math.ceil(q.data.count / PAGE_SIZE)}</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <Button size="sm" variant="outline" disabled={(page + 1) * PAGE_SIZE >= q.data.count} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
