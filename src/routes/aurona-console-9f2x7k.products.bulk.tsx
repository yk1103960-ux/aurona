import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Download, RotateCcw, Upload } from "lucide-react";
import {
  adminCommitCatalogImport,
  adminExportCatalog,
  adminListCatalogImports,
  adminPreviewCatalogImport,
  adminRollbackCatalogImport,
} from "@/lib/operations-admin.functions";

export const Route = createFileRoute("/aurona-console-9f2x7k/products/bulk")({
  component: BulkCatalog,
});
type CsvRow = {
  name: string;
  sku: string;
  slug?: string;
  category_id?: string;
  price: string | number;
  mrp: string | number;
  stock?: string | number;
  short_description?: string;
  brand?: string;
};

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([Papa.unparse(rows)], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}

function BulkCatalog() {
  const qc = useQueryClient();
  const previewFn = useServerFn(adminPreviewCatalogImport);
  const commitFn = useServerFn(adminCommitCatalogImport);
  const exportFn = useServerFn(adminExportCatalog);
  const rollbackFn = useServerFn(adminRollbackCatalogImport);
  const listFn = useServerFn(adminListCatalogImports);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const batches = useQuery({ queryKey: ["catalog-imports"], queryFn: () => listFn() });

  const parse = (file: File) =>
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        setRows(result.data);
        setBusy(true);
        try {
          setPreview(await previewFn({ data: { rows: result.data as any } }));
          toast.success(`Checked ${result.data.length} rows`);
        } catch (error: any) {
          toast.error(error?.message || "Could not validate file");
        } finally {
          setBusy(false);
        }
      },
      error: (error) => toast.error(error.message),
    });
  const commit = async () => {
    if (!preview || preview.errorCount)
      return toast.error("Fix every validation error before importing");
    setBusy(true);
    try {
      const result = await commitFn({ data: { rows: rows as any } });
      toast.success(`Imported ${result.count} unpublished product families`);
      setRows([]);
      setPreview(null);
      qc.invalidateQueries({ queryKey: ["catalog-imports"] });
    } catch (error: any) {
      toast.error(error?.message || "Import failed; no rows were committed");
    } finally {
      setBusy(false);
    }
  };
  const exportCatalog = async () => {
    try {
      const families: any[] = await exportFn();
      const output = families.flatMap((family: any) =>
        (family.product_variants ?? []).map((variant: any) => ({
          family_name: family.name,
          family_sku: family.main_sku,
          slug: family.slug,
          brand: family.brand,
          category_id: family.category_id ?? "",
          published: family.is_published,
          sku: variant.sku,
          attributes_json: JSON.stringify(variant.attributes ?? {}),
          price: variant.price,
          mrp: variant.mrp,
          stock: variant.stock,
          reserved_stock: variant.reserved_stock,
          low_stock_threshold: variant.low_stock_threshold,
          active: variant.is_active,
        })),
      );
      downloadCsv(`aurona-catalog-${new Date().toISOString().slice(0, 10)}.csv`, output);
    } catch (error: any) {
      toast.error(error?.message || "Export failed");
    }
  };
  const rollback = async (id: string) => {
    if (
      !confirm(
        "Archive every product created by this import? Existing references will be preserved.",
      )
    )
      return;
    try {
      const result = await rollbackFn({ data: { batchId: id } });
      toast.success(`Archived ${result.count} imported families`);
      qc.invalidateQueries({ queryKey: ["catalog-imports"] });
    } catch (error: any) {
      toast.error(error?.message || "Rollback failed");
    }
  };
  const template = () =>
    downloadCsv("aurona-family-import-template.csv", [
      {
        name: "Sample LED Bulb",
        sku: "SKU-001",
        slug: "sample-led-bulb",
        category_id: "",
        price: 199,
        mrp: 299,
        stock: 50,
        short_description: "9W LED bulb",
        brand: "Aurona",
      },
    ]);

  return (
    <div className="max-w-6xl space-y-5">
      <Link
        to="/aurona-console-9f2x7k/products"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to products
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bulk catalog operations</h1>
          <p className="text-sm text-slate-500">
            Validate first, then create unpublished families atomically. Existing SKUs are never
            overwritten.
          </p>
        </div>
        <Button variant="outline" onClick={exportCatalog}>
          <Download className="mr-1 h-4 w-4" /> Export catalog
        </Button>
      </div>
      <div className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={template}>
            <Download className="mr-1 h-4 w-4" /> Template
          </Button>
          <label>
            <input
              hidden
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => e.target.files?.[0] && parse(e.target.files[0])}
            />
            <Button asChild>
              <span>
                <Upload className="mr-1 h-4 w-4" /> Choose CSV
              </span>
            </Button>
          </label>
          {rows.length > 0 && (
            <Button disabled={busy || !preview || preview.errorCount > 0} onClick={commit}>
              {busy ? "Working…" : `Import ${preview?.validCount ?? 0} families`}
            </Button>
          )}
        </div>
        {preview && (
          <div
            className={`mt-4 rounded-lg border p-3 text-sm ${preview.errorCount ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}
          >
            {preview.errorCount ? (
              <>
                <AlertTriangle className="mr-1 inline h-4 w-4" /> {preview.errorCount} rows need
                attention. Nothing was imported.
              </>
            ) : (
              `${preview.validCount} rows are valid and ready.`
            )}
          </div>
        )}
        {preview && (
          <div className="mt-4 max-h-96 overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Row</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">SKU</th>
                  <th className="p-2 text-left">Price</th>
                  <th className="p-2 text-left">Validation</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.rows.map((row: any) => (
                  <tr key={row.index}>
                    <td className="p-2">{row.index + 2}</td>
                    <td className="p-2">{row.value?.name ?? rows[row.index]?.name}</td>
                    <td className="p-2 font-mono">{row.value?.sku ?? rows[row.index]?.sku}</td>
                    <td className="p-2">{row.value?.price ?? rows[row.index]?.price}</td>
                    <td
                      className={`p-2 ${row.errors.length ? "text-rose-700" : "text-emerald-700"}`}
                    >
                      {row.errors.join("; ") || "Ready"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b p-4 font-semibold">Recent imports</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3 text-left">Created</th>
              <th className="p-3 text-left">Rows</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(batches.data ?? []).map((batch: any) => (
              <tr key={batch.id}>
                <td className="p-3">{new Date(batch.created_at).toLocaleString()}</td>
                <td className="p-3">{batch.row_count}</td>
                <td className="p-3 capitalize">{batch.status.replace("_", " ")}</td>
                <td className="p-3 text-right">
                  {batch.status === "completed" && (
                    <Button size="sm" variant="outline" onClick={() => rollback(batch.id)}>
                      <RotateCcw className="mr-1 h-4 w-4" /> Roll back
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
