import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Boxes, Search, SlidersHorizontal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminListProductMaster } from "@/lib/catalog-admin.functions";

const ROOT = "/aurona-console-9f2x7k";
type Segment = "customer" | "retailer" | "distributor";

export function WholesaleStockMatrix() {
  const [segment, setSegment] = useState<Segment>("customer");
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["ecommain-wholesale-master"], queryFn: () => adminListProductMaster({ page: 1, pageSize: 250, includeArchived: false }) });
  const families = ((data as any)?.families ?? (data as any)?.data ?? data ?? []) as any[];
  const rows = useMemo(() => families.flatMap((family:any) => (family.variants ?? []).map((variant:any) => ({ family, variant }))).filter(({family,variant}:any) => `${family.name} ${variant.sku}`.toLowerCase().includes(search.toLowerCase())), [families, search]);
  const price = (v:any) => segment === "customer" ? v.price : segment === "retailer" ? v.retailer_price : v.distributor_price;
  const mrp = (v:any) => segment === "customer" ? v.mrp : segment === "retailer" ? (v.retailer_mrp ?? v.mrp) : (v.distributor_mrp ?? v.mrp);
  const stock = (v:any) => segment === "customer" ? v.stock : segment === "retailer" ? v.retailer_stock : v.distributor_stock;
  const pack = (v:any) => segment === "customer" ? v.pack_size : segment === "retailer" ? v.retailer_pack_size : v.distributor_pack_size;
  const moq = (v:any) => segment === "customer" ? v.moq : segment === "retailer" ? v.retailer_moq : v.distributor_moq;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="flex items-center gap-2 text-slate-500"><Boxes className="h-4 w-4"/> Wholesale Products</div><h1 className="mt-1 text-2xl font-semibold">Wholesale Product Stock</h1><p className="mt-1 text-sm text-slate-500">Customer, Retailer and Distributor pricing, MOQ, pack and stock from the live product master.</p></div><Link to={`${ROOT}/products/master`} className="rounded bg-[#25b990] px-4 py-2 text-sm font-medium text-white">Open Product Master</Link></div>
    <div className="rounded border bg-white shadow-sm"><div className="flex flex-wrap gap-2 border-b p-4">{(["customer","retailer","distributor"] as Segment[]).map(s => <button key={s} onClick={()=>setSegment(s)} className={`rounded px-4 py-2 text-sm font-medium capitalize ${segment===s?"bg-[#25b990] text-white":"border bg-white text-slate-600"}`}>{s}</button>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div className="relative w-full max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded border py-2 pl-9 pr-3 text-sm" placeholder="Search product or SKU"/></div><span className="flex items-center gap-2 text-xs text-slate-500"><SlidersHorizontal className="h-4 w-4"/> {rows.length} variants</span></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Product","Variant / SKU","MRP","Selling Price","MOQ","Pack Size","Stock","Status"].map(h=><th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}</tr></thead><tbody>{isLoading?<tr><td colSpan={8} className="p-10 text-center text-slate-400">Loading product master…</td></tr>:rows.length===0?<tr><td colSpan={8} className="p-10 text-center text-slate-400">No variants found.</td></tr>:rows.map(({family,variant}:any)=><tr key={`${family.id}-${variant.id}`} className="border-t"><td className="px-4 py-3 font-medium">{family.name}</td><td className="px-4 py-3"><div>{Object.values(variant.attributes ?? {}).join(" / ") || "Default"}</div><div className="text-xs text-slate-400">{variant.sku}</div></td><td className="px-4 py-3">₹{Number(mrp(variant) ?? 0).toLocaleString("en-IN")}</td><td className="px-4 py-3 font-medium">₹{Number(price(variant) ?? 0).toLocaleString("en-IN")}</td><td className="px-4 py-3">{moq(variant) ?? 1}</td><td className="px-4 py-3">{pack(variant) ?? 1}</td><td className="px-4 py-3">{stock(variant) ?? 0}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${variant.is_active?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-500"}`}>{variant.is_active?"Active":"Inactive"}</span></td></tr>)}</tbody></table></div>
    </div>
  </div>;
}
