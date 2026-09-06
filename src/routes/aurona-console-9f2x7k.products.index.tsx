import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useAdmin";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Archive, Copy, Eye, EyeOff, ExternalLink, Pencil, Plus, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { adminBulkProductFamilyAction, adminDuplicateProductFamily, adminListProductFamilies } from "@/lib/catalog-admin.functions";

export const Route = createFileRoute("/aurona-console-9f2x7k/products/")({ component: ProductsAdmin });

type Publication = "all" | "published" | "hidden" | "archived";
type Stock = "all" | "in_stock" | "low_stock" | "out_of_stock";
type Sort = "newest" | "name_asc" | "name_desc" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc" | "rating_desc";
type FamilyRow = { id: string; legacy_product_id: string; name: string; main_sku: string; slug: string; brand: string; category_id: string | null; min_price: number | null; max_price: number | null; total_stock: number; is_published: boolean; is_featured: boolean; is_bestseller: boolean; rating: number | null; review_count: number | null; archived_at: string | null; categories?: { name?: string } | null };

const PAGE_SIZE = 30;
const selectClass = "h-10 rounded-md border border-slate-200 bg-white px-3 text-sm";

function ProductsAdmin() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brand, setBrand] = useState("");
  const [publication, setPublication] = useState<Publication>("all");
  const [stock, setStock] = useState<Stock>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const qc = useQueryClient();
  const nav = useNavigate();
  const categories = useQuery({ queryKey: ["admin-product-filter-categories"], queryFn: async () => { const { data, error } = await supabase.from("categories").select("id, name").order("name"); if (error) throw error; return data ?? []; } });
  const brands = useQuery({ queryKey: ["admin-product-filter-brands"], queryFn: async () => { const { data, error } = await (supabase as any).from("product_families").select("brand").is("archived_at", null).order("brand"); if (error) throw error; return [...new Set((data ?? []).map((row: { brand?: string }) => row.brand).filter(Boolean))] as string[]; } });
  const q = useQuery({ queryKey: ["admin-product-families", search, categoryId, brand, publication, stock, sort, page], queryFn: async () => adminListProductFamilies({ data: { search, categoryId: categoryId || null, brand, publication, stock, sort, page, pageSize: PAGE_SIZE } }) });
  useRealtime(["product_families", "product_variants"], () => q.refetch());
  const rows = (q.data?.rows ?? []) as FamilyRow[];
  const refresh = async () => { setSelected(new Set()); await qc.invalidateQueries({ queryKey: ["admin-product-families"] }); };
  const runAction = async (action: "publish" | "unpublish" | "archive" | "restore" | "feature" | "unfeature" | "deal" | "undeal", ids = [...selected]) => {
    if (!ids.length) return;
    if (action === "archive" && !confirm(`Archive ${ids.length} product family/families? Orders, SKUs and history will be preserved.`)) return;
    setBusy(true);
    try { await adminBulkProductFamilyAction({ data: { familyIds: ids, action } }); toast.success(`${ids.length} product family/families updated`); await refresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not update products"); }
    finally { setBusy(false); }
  };
  const duplicate = async (familyId: string) => {
    setBusy(true);
    try { const result = await adminDuplicateProductFamily({ data: { familyId } }); toast.success("Complete family duplicated as a hidden draft"); await refresh(); nav({ to: "/aurona-console-9f2x7k/products/$id", params: { id: result.product_id } }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not duplicate product"); }
    finally { setBusy(false); }
  };
  const updateFilter = (setter: (value: any) => void, value: string) => { setter(value); setPage(0); setSelected(new Set()); };
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Products</h1><p className="text-sm text-slate-500">{q.data?.count ?? "…"} product families · family data is authoritative</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => nav({ to: "/aurona-console-9f2x7k/products/bulk" })}>Bulk Import / Export</Button><Button onClick={() => nav({ to: "/aurona-console-9f2x7k/products/new" })}><Plus className="mr-1 h-4 w-4" />New Product</Button></div></div>
    <div className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2 lg:grid-cols-6">
      <div className="relative sm:col-span-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Search name, family SKU or slug…" value={search} onChange={(e) => updateFilter(setSearch, e.target.value)} /></div>
      <select aria-label="Category filter" className={selectClass} value={categoryId} onChange={(e) => updateFilter(setCategoryId, e.target.value)}><option value="">All categories</option>{(categories.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <select aria-label="Brand filter" className={selectClass} value={brand} onChange={(e) => updateFilter(setBrand, e.target.value)}><option value="">All brands</option>{(brands.data ?? []).map((x) => <option key={x} value={x}>{x}</option>)}</select>
      <select aria-label="Publication filter" className={selectClass} value={publication} onChange={(e) => updateFilter(setPublication, e.target.value as Publication)}><option value="all">Active + hidden</option><option value="published">Published</option><option value="hidden">Hidden drafts</option><option value="archived">Archived</option></select>
      <select aria-label="Stock filter" className={selectClass} value={stock} onChange={(e) => updateFilter(setStock, e.target.value as Stock)}><option value="all">All stock</option><option value="in_stock">In stock</option><option value="low_stock">Low stock (1–10)</option><option value="out_of_stock">Out of stock</option></select>
      <select aria-label="Sort products" className={selectClass} value={sort} onChange={(e) => updateFilter(setSort, e.target.value as Sort)}><option value="newest">Recently updated</option><option value="name_asc">Name A–Z</option><option value="name_desc">Name Z–A</option><option value="price_asc">Price low–high</option><option value="price_desc">Price high–low</option><option value="stock_asc">Stock low–high</option><option value="stock_desc">Stock high–low</option><option value="rating_desc">Rating high–low</option></select>
    </div>
    {selected.size > 0 && <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-900 p-3 text-sm text-white"><span className="mr-2 font-medium">{selected.size} selected</span>{publication === "archived" ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => runAction("restore")}><RotateCcw className="mr-1 h-4 w-4" />Restore</Button> : <><Button size="sm" variant="secondary" disabled={busy} onClick={() => runAction("publish")}>Publish</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => runAction("unpublish")}>Unpublish</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => runAction("feature")}>Feature</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => runAction("deal")}>Today’s Deal</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => runAction("archive")}><Archive className="mr-1 h-4 w-4" />Archive</Button></>}</div>}
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-[980px] w-full text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-10 p-3"><input aria-label="Select visible products" type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((x) => x.id)))} /></th><th className="p-3 text-left">Family</th><th className="p-3 text-left">Category / Brand</th><th className="p-3 text-right">Variant price</th><th className="p-3 text-right">SKU stock</th><th className="p-3 text-center">Flags</th><th className="p-3 text-right">Actions</th></tr></thead><tbody className="divide-y">
      {rows.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="p-3 text-center"><input aria-label={`Select ${row.name}`} type="checkbox" checked={selected.has(row.id)} onChange={() => setSelected((current) => { const next = new Set(current); next.has(row.id) ? next.delete(row.id) : next.add(row.id); return next; })} /></td><td className="p-3"><Link to="/aurona-console-9f2x7k/products/$id" params={{ id: row.legacy_product_id }} className="font-medium hover:text-sky-700">{row.name}</Link><div className="font-mono text-xs text-slate-500">{row.main_sku}</div></td><td className="p-3"><div>{row.categories?.name || "Uncategorised"}</div><div className="text-xs text-slate-500">{row.brand}</div></td><td className="p-3 text-right font-medium">{inr(Number(row.min_price ?? 0))}{Number(row.max_price ?? 0) > Number(row.min_price ?? 0) ? ` – ${inr(Number(row.max_price))}` : ""}</td><td className={`p-3 text-right font-semibold ${Number(row.total_stock) <= 10 ? "text-rose-600" : ""}`}>{row.total_stock}</td><td className="p-3"><div className="flex flex-wrap justify-center gap-1"><span className={`rounded px-2 py-1 text-xs ${row.archived_at ? "bg-rose-100 text-rose-700" : row.is_published ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>{row.archived_at ? "Archived" : row.is_published ? "Published" : "Hidden"}</span>{row.is_featured && <span className="rounded bg-violet-100 px-2 py-1 text-xs text-violet-700">Featured</span>}{row.is_bestseller && <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-700">Deal</span>}</div></td><td className="p-3"><div className="flex justify-end gap-1"><Link to="/products/$slug" params={{ slug: row.slug }} target="_blank" className="rounded p-2 hover:bg-slate-100" title="View storefront"><ExternalLink className="h-4 w-4" /></Link><Link to="/aurona-console-9f2x7k/products/$id" params={{ id: row.legacy_product_id }} className="rounded p-2 hover:bg-slate-100" title="Edit family"><Pencil className="h-4 w-4" /></Link>{!row.archived_at && <><button disabled={busy} onClick={() => runAction(row.is_published ? "unpublish" : "publish", [row.id])} className="rounded p-2 hover:bg-slate-100" title={row.is_published ? "Hide" : "Publish"}>{row.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button><button disabled={busy} onClick={() => duplicate(row.id)} className="rounded p-2 hover:bg-slate-100" title="Duplicate complete family"><Copy className="h-4 w-4" /></button><button disabled={busy} onClick={() => runAction("archive", [row.id])} className="rounded p-2 text-rose-600 hover:bg-rose-50" title="Archive"><Archive className="h-4 w-4" /></button></>}{row.archived_at && <button disabled={busy} onClick={() => runAction("restore", [row.id])} className="rounded p-2 text-emerald-700 hover:bg-emerald-50" title="Restore"><RotateCcw className="h-4 w-4" /></button>}</div></td></tr>)}
      {q.isLoading && <tr><td colSpan={7} className="p-10 text-center text-slate-500">Loading product families…</td></tr>}{q.isError && <tr><td colSpan={7} className="p-10 text-center text-rose-600">Could not load product families.</td></tr>}{!q.isLoading && !q.isError && rows.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-slate-500">No product families match these filters.</td></tr>}
    </tbody></table></div>
    {q.data && q.data.count > PAGE_SIZE && <div className="flex items-center justify-between text-sm"><span>Page {page + 1} of {Math.ceil(q.data.count / PAGE_SIZE)}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((x) => x - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={(page + 1) * PAGE_SIZE >= q.data.count} onClick={() => setPage((x) => x + 1)}>Next</Button></div></div>}
  </div>;
}
