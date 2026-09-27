import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminCommitDynamicCatalogImport, adminGetBulkUploadConfiguration, adminPreviewDynamicCatalogImport } from "@/lib/operations-admin.functions";
import { createBulkProductWorkbook, parseBulkProductWorkbook, type TemplateConfig } from "@/lib/bulk-product-workbook";
import { generateVariationCombinations } from "@/lib/sku-generation";

export const Route = createFileRoute("/aurona-console-9f2x7k/products/bulk")({ component: BulkCatalog });
type Choice = { id: string; name: string; valueText: string };

function BulkCatalog() {
  const configFn = useServerFn(adminGetBulkUploadConfiguration);
  const previewFn = useServerFn(adminPreviewDynamicCatalogImport);
  const commitFn = useServerFn(adminCommitDynamicCatalogImport);
  const config = useQuery({ queryKey: ["admin-dynamic-bulk-config"], queryFn: () => configFn(), retry: false });
  const [categoryId, setCategoryId] = useState("");
  const [productName, setProductName] = useState("");
  const [mainSku, setMainSku] = useState("");
  const [modelName, setModelName] = useState("");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [parsed, setParsed] = useState<any>();
  const [preview, setPreview] = useState<any>();
  const [busy, setBusy] = useState(false);
  const category = config.data?.categories?.find((row: any) => row.id === categoryId);
  const variations = choices.map((choice) => ({ name: choice.name, values: choice.valueText.split(",").map((x) => x.trim()).filter(Boolean) }));
  const combinations = useMemo(() => generateVariationCombinations(variations), [choices]);

  const addChoice = (id: string) => {
    const option = config.data?.variations?.find((row: any) => row.id === id);
    if (option && choices.length < 3 && !choices.some((choice) => choice.id === id)) setChoices((current) => [...current, { id, name: option.name, valueText: "" }]);
  };
  const generate = () => {
    if (!category || !productName.trim() || !mainSku.trim() || !choices.length || variations.some((v) => !v.values.length)) return toast.error("Complete the category, product and variation values first");
    try {
      const input: TemplateConfig = { categoryId, categoryName: category.name, productName: productName.trim(), mainSku: mainSku.trim().toUpperCase(), modelName: modelName.trim(), variations, combinations };
      const url = URL.createObjectURL(new Blob([createBulkProductWorkbook(input)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a"); link.href = url; link.download = `${input.mainSku}-product-master.xlsx`; link.click(); URL.revokeObjectURL(url);
      toast.success(`Generated ${combinations.length} variants`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Template generation failed"); }
  };
  const upload = async (file: File) => {
    setBusy(true); setPreview(undefined);
    try { const next = parseBulkProductWorkbook(await file.arrayBuffer()); setParsed(next); setPreview(await previewFn({ data: next as any })); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Excel validation failed"); }
    finally { setBusy(false); }
  };
  const commit = async () => {
    if (!preview || preview.errorCount) return;
    setBusy(true);
    try { const result = await commitFn({ data: { rows: preview.normalizedRows } as any }); toast.success(`Import complete: ${result.created_variants ?? 0} created, ${result.updated_variants ?? 0} updated`); setParsed(undefined); setPreview(undefined); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Import failed; no changes were committed"); }
    finally { setBusy(false); }
  };

  if (config.isError) {
    return (
      <div className="max-w-full space-y-5">
        <Link to="/aurona-console-9f2x7k/products" className="inline-flex items-center gap-1 text-sm text-slate-500">
          <ArrowLeft className="h-4 w-4" /> Back to products
        </Link>
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="font-semibold">Bulk upload configuration could not be loaded</div>
          <p className="mt-1">{config.error instanceof Error ? config.error.message : "Please retry."}</p>
          <Button className="mt-3" type="button" variant="outline" onClick={() => config.refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return <div className="max-w-full space-y-5">
    <Link to="/aurona-console-9f2x7k/products" className="inline-flex items-center gap-1 text-sm text-slate-500"><ArrowLeft className="h-4 w-4"/> Back to products</Link>
    <div><h1 className="text-2xl font-semibold">Dynamic Bulk Products Upload</h1><p className="text-sm text-slate-500">Configure one category, generate its variants and SKUs, then validate and preview before import.</p></div>
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="font-semibold">1. Product configuration</h2>
      <div className="grid gap-3 md:grid-cols-4">
        <select className="h-10 rounded-md border px-3" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Product category</option>{(config.data?.categories ?? []).map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <input className="h-10 rounded-md border px-3" placeholder="Product name" value={productName} onChange={(e) => setProductName(e.target.value)}/>
        <input className="h-10 rounded-md border px-3 font-mono uppercase" placeholder="Main SKU" value={mainSku} onChange={(e) => setMainSku(e.target.value)}/>
        <input className="h-10 rounded-md border px-3" placeholder="Model name" value={modelName} onChange={(e) => setModelName(e.target.value)}/>
      </div>
      <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">2. Variations in SKU order</span><select className="h-9 rounded-md border px-2" value="" disabled={choices.length >= 3} onChange={(e) => addChoice(e.target.value)}><option value="">Add variation…</option>{(config.data?.variations ?? []).filter((x: any) => !choices.some((c) => c.id === x.id)).map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
      <div className="grid gap-3 lg:grid-cols-3">{choices.map((choice, index) => <div key={choice.id} className="rounded-lg border p-3"><div className="flex justify-between font-medium"><span>{index + 1}. {choice.name}</span><button onClick={() => setChoices((x) => x.filter((_, i) => i !== index))}><X className="h-4 w-4"/></button></div><input className="mt-2 h-9 w-full rounded-md border px-2 text-sm" placeholder="Values separated by commas" value={choice.valueText} onChange={(e) => setChoices((all) => all.map((x, i) => i === index ? { ...x, valueText: e.target.value } : x))}/></div>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3"><span className="text-sm"><strong>{combinations.length}</strong> combinations generated</span><Button onClick={generate}><Download className="mr-1 h-4 w-4"/> Generate Excel Template</Button></div>
    </section>
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="font-semibold">3. Upload, validate and preview</h2>
      <label><input hidden type="file" accept=".xlsx" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}/><Button asChild disabled={busy}><span><Upload className="mr-1 h-4 w-4"/> Choose completed Excel</span></Button></label>
      {preview && <><div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">{[["Products", preview.productsDetected], ["New products", preview.productsToCreate], ["Product updates", preview.productsToUpdate], ["New variants", preview.variantsToCreate], ["Variant updates", preview.variantsToUpdate], ["Errors", preview.errorCount]].map(([label, value]) => <div key={String(label)} className="rounded-lg border p-3"><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-semibold">{value}</div></div>)}</div><div className="max-h-[50vh] overflow-auto rounded-lg border" tabIndex={0}><table className="min-w-[850px] w-full text-sm"><thead className="sticky top-0 z-10 bg-slate-100"><tr>{["Row", "Function", "Main SKU", "Variant SKU", "Validation"].map((x) => <th key={x} className="p-2 text-left">{x}</th>)}</tr></thead><tbody>{preview.rows.map((row: any) => <tr key={row.excelRow} className="border-t"><td className="p-2">{row.excelRow}</td><td className="p-2 capitalize">{row.action}</td><td className="p-2 font-mono">{row.mainSku}</td><td className="p-2 font-mono">{row.variantSku}</td><td className={`p-2 ${row.errors.length ? "text-red-700" : "text-emerald-700"}`}>{row.errors.join("; ") || "Ready"}</td></tr>)}</tbody></table></div><Button disabled={busy || preview.errorCount > 0 || !parsed} onClick={commit}>{busy ? "Importing…" : "Confirm Import"}</Button></>}
    </section>
  </div>;
}
