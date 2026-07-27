import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Download, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/aurona-console-9f2x7k/products/bulk")({
  component: BulkUpload,
});

type Row = { name: string; sku: string; slug?: string; category_id?: string; price: string; mrp: string; stock?: string; short_description?: string };

function BulkUpload() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const parse = (file: File) => {
    Papa.parse<Row>(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => { setRows(res.data as Row[]); toast.success(`Parsed ${res.data.length} rows`); },
      error: (e) => toast.error(e.message),
    });
  };

  const importAll = async () => {
    if (!rows.length) return;
    setBusy(true);
    const payload = rows.map((r) => ({
      name: r.name,
      sku: r.sku,
      slug: r.slug || (r.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      price: Number(r.price || 0),
      mrp: Number(r.mrp || r.price || 0),
      stock: Number(r.stock || 25),
      short_description: r.short_description ?? null,
      category_id: r.category_id || null,
      brand: "Aurona",
    })).filter((r) => r.name && r.sku);
    const { error, count } = await supabase.from("products").insert(payload, { count: "exact" });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Imported ${count ?? payload.length} products`);
    setRows([]);
  };

  const downloadTemplate = () => {
    const csv = "name,sku,slug,category_id,price,mrp,stock,short_description\nSample LED Bulb,SKU-001,,,199,299,50,9W LED bulb";
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "aurona-products-template.csv";
    a.click();
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <Link to="/aurona-console-9f2x7k/products" className="text-sm text-slate-500 inline-flex items-center gap-1 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Back</Link>
      <h1 className="text-2xl font-semibold">Bulk Upload Products</h1>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadTemplate}><Download className="w-4 h-4 mr-1" /> Template CSV</Button>
          <label className="inline-flex">
            <input type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && parse(e.target.files[0])} />
            <Button asChild><span><Upload className="w-4 h-4 mr-1" /> Choose CSV</span></Button>
          </label>
          {rows.length > 0 && <Button onClick={importAll} disabled={busy}>{busy ? "Importing…" : `Import ${rows.length} products`}</Button>}
        </div>

        {rows.length > 0 && (
          <div className="overflow-auto max-h-96 border rounded">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0"><tr>{Object.keys(rows[0]).map((k) => <th key={k} className="p-2 text-left">{k}</th>)}</tr></thead>
              <tbody>{rows.slice(0, 50).map((r, i) => (
                <tr key={i} className="border-t">{Object.values(r).map((v, j) => <td key={j} className="p-2 truncate max-w-40">{String(v)}</td>)}</tr>
              ))}</tbody>
            </table>
            {rows.length > 50 && <div className="p-2 text-xs text-slate-500 text-center">…and {rows.length - 50} more</div>}
          </div>
        )}
      </div>
    </div>
  );
}
