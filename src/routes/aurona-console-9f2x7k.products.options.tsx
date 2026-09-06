import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Archive, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminArchiveCatalogOption, adminListCatalogOptions, adminSaveCatalogOption } from "@/lib/catalog-admin.functions";

export const Route = createFileRoute("/aurona-console-9f2x7k/products/options")({ component: CatalogOptions });
type Kind = "brand" | "attribute" | "colour" | "warranty" | "size_guide";
type Row = { id: string; kind: Kind; name: string; code: string | null; details: Record<string, unknown>; sort_order: number; active: boolean };
const KINDS: { key: Kind; label: string; help: string }[] = [
  { key: "brand", label: "Brands", help: "Reusable product brands and optional brand codes." },
  { key: "attribute", label: "Attributes", help: "Reusable variation axes such as wattage, colour and pack size." },
  { key: "colour", label: "Colours", help: "Named colours with an optional CSS hex code." },
  { key: "warranty", label: "Warranties", help: "Reusable warranty labels and policy details." },
  { key: "size_guide", label: "Size Guides", help: "Reusable guide labels and content references." },
];

function CatalogOptions() {
  const [kind, setKind] = useState<Kind>("brand");
  const [editing, setEditing] = useState<Row | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [details, setDetails] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-catalog-options", kind], queryFn: () => adminListCatalogOptions({ data: { kind } }) });
  const reset = () => { setEditing(null); setName(""); setCode(""); setDetails(""); setActive(true); };
  const edit = (row: Row) => { setEditing(row); setName(row.name); setCode(row.code ?? ""); setDetails(typeof row.details?.description === "string" ? row.details.description : ""); setActive(row.active); };
  const save = async () => {
    if (!name.trim()) return toast.error("Name is required");
    setBusy(true);
    try { await adminSaveCatalogOption({ data: { id: editing?.id, kind, name, code, details: details.trim() ? { description: details.trim() } : {}, sort_order: editing?.sort_order ?? 0, active } }); toast.success(editing ? "Option updated" : "Option created"); reset(); await qc.invalidateQueries({ queryKey: ["admin-catalog-options", kind] }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not save option"); }
    finally { setBusy(false); }
  };
  const archive = async (id: string) => { if (!confirm("Archive this option? Existing products will keep their saved values.")) return; try { await adminArchiveCatalogOption({ data: { id } }); toast.success("Option archived"); await qc.invalidateQueries({ queryKey: ["admin-catalog-options", kind] }); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not archive option"); } };
  const current = KINDS.find((x) => x.key === kind)!;
  return <div className="space-y-4"><div><h1 className="text-2xl font-semibold">Brands & Product Attributes</h1><p className="text-sm text-slate-500">Reusable catalog data for consistent family and variant setup.</p></div>
    <div className="flex flex-wrap gap-2">{KINDS.map((item) => <Button key={item.key} variant={kind === item.key ? "default" : "outline"} onClick={() => { setKind(item.key); reset(); }}>{item.label}</Button>)}</div>
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]"><div className="overflow-hidden rounded-xl border bg-white"><div className="border-b p-4"><h2 className="font-semibold">{current.label}</h2><p className="text-xs text-slate-500">{current.help}</p></div><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Name</th><th className="p-3">Code</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr></thead><tbody className="divide-y">{((q.data ?? []) as Row[]).map((row) => <tr key={row.id}><td className="p-3 font-medium">{row.name}</td><td className="p-3 font-mono text-xs">{row.code || "—"}</td><td className="p-3">{row.active ? "Active" : "Inactive"}</td><td className="p-3"><div className="flex justify-end gap-1"><button className="rounded p-2 hover:bg-slate-100" title="Edit" onClick={() => edit(row)}><Pencil className="h-4 w-4" /></button><button className="rounded p-2 text-rose-600 hover:bg-rose-50" title="Archive" onClick={() => archive(row.id)}><Archive className="h-4 w-4" /></button></div></td></tr>)}{!q.isLoading && !q.data?.length && <tr><td colSpan={4} className="p-8 text-center text-slate-500">No {current.label.toLowerCase()} yet.</td></tr>}</tbody></table></div>
      <div className="space-y-3 rounded-xl border bg-white p-4"><h2 className="font-semibold">{editing ? `Edit ${editing.name}` : `Add ${current.label.replace(/s$/, "")}`}</h2><label className="block text-xs font-medium text-slate-600">Name<Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} /></label><label className="block text-xs font-medium text-slate-600">{kind === "colour" ? "Hex code" : "Code (optional)"}<Input className="mt-1" value={code} placeholder={kind === "colour" ? "#ffffff" : "Optional"} onChange={(e) => setCode(e.target.value)} /></label><label className="block text-xs font-medium text-slate-600">Description / Details<Input className="mt-1" value={details} onChange={(e) => setDetails(e.target.value)} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />Active</label><div className="flex gap-2"><Button onClick={save} disabled={busy}><Plus className="mr-1 h-4 w-4" />{editing ? "Save Changes" : "Add Option"}</Button>{editing && <Button variant="outline" onClick={reset}>Cancel</Button>}</div></div>
    </div>
  </div>;
}
