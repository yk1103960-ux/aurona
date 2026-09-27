import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Download, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  adminCommitDynamicCatalogImport,
  adminGetBulkUploadConfiguration,
  adminPreviewDynamicCatalogImport,
} from "@/lib/operations-admin.functions";
import {
  createBulkProductWorkbook,
  parseBulkProductWorkbook,
  type TemplateConfig,
} from "@/lib/bulk-product-workbook";
import {
  generateVariantSku,
  generateVariationCombinations,
  variantName,
} from "@/lib/sku-generation";

export const Route = createFileRoute("/aurona-console-9f2x7k/products/bulk")({
  component: BulkCatalog,
});

type VariationOption = {
  id: string;
  axisKey?: string;
  name: string;
  values: string[];
};

type Choice = {
  id: string;
  axisKey?: string;
  name: string;
  availableValues: string[];
  selectedValues: string[];
};

const uniqueValues = (values: unknown[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = String(raw ?? "").trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
};

function BulkCatalog() {
  const configFn = useServerFn(adminGetBulkUploadConfiguration);
  const previewFn = useServerFn(adminPreviewDynamicCatalogImport);
  const commitFn = useServerFn(adminCommitDynamicCatalogImport);
  const config = useQuery({
    queryKey: ["admin-dynamic-bulk-config"],
    queryFn: () => configFn(),
    retry: false,
  });

  const [categoryId, setCategoryId] = useState("");
  const [productName, setProductName] = useState("");
  const [mainSku, setMainSku] = useState("");
  const [brandName, setBrandName] = useState("AURONA");
  const [unit, setUnit] = useState("Pc");
  const [modelName, setModelName] = useState("");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [parsed, setParsed] = useState<any>();
  const [preview, setPreview] = useState<any>();
  const [busy, setBusy] = useState(false);

  const category = config.data?.categories?.find((row: any) => row.id === categoryId);

  const availableVariations = useMemo<VariationOption[]>(() => {
    if (!categoryId || !config.data) return [];

    const categorySpecific = (
      (config.data as any).categoryVariations?.[categoryId] ?? []
    ) as VariationOption[];
    if (categorySpecific.length) {
      return categorySpecific.map((option) => ({
        ...option,
        values: uniqueValues(option.values ?? []),
      }));
    }

    const colourValues = uniqueValues(
      ((config.data as any).variations ?? [])
        .filter((row: any) => row.kind === "colour")
        .map((row: any) => row.name),
    );

    return (((config.data as any).variations ?? []) as any[])
      .filter((row) => row.kind === "attribute")
      .map((row) => {
        const detailValues = Array.isArray(row.details?.values) ? row.details.values : [];
        const values = /colou?r/i.test(String(row.name ?? "")) && !detailValues.length
          ? colourValues
          : detailValues;
        return {
          id: String(row.id),
          axisKey: String(row.code || row.name),
          name: String(row.name),
          values: uniqueValues(values),
        };
      });
  }, [categoryId, config.data]);

  const variations = choices.map((choice) => ({
    name: choice.name,
    values: choice.selectedValues,
  }));
  const combinations = useMemo(
    () => (choices.length && choices.every((choice) => choice.selectedValues.length)
      ? generateVariationCombinations(variations)
      : []),
    [choices],
  );

  const readyToGenerate =
    Boolean(category && productName.trim() && mainSku.trim()) &&
    choices.length > 0 &&
    choices.every((choice) => choice.selectedValues.length > 0) &&
    combinations.length > 0;

  const resetCategory = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
    setChoices([]);
    setParsed(undefined);
    setPreview(undefined);
  };

  const addChoice = (id: string) => {
    if (!id) return;
    const option = availableVariations.find((row) => row.id === id);
    if (!option || choices.length >= 3 || choices.some((choice) => choice.id === id)) return;
    setChoices((current) => [
      ...current,
      {
        id: option.id,
        axisKey: option.axisKey,
        name: option.name,
        availableValues: option.values,
        selectedValues: [],
      },
    ]);
  };

  const moveChoice = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= choices.length) return;
    setChoices((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const toggleValue = (choiceIndex: number, value: string) => {
    setChoices((current) =>
      current.map((choice, index) => {
        if (index !== choiceIndex) return choice;
        const selected = choice.selectedValues.includes(value)
          ? choice.selectedValues.filter((item) => item !== value)
          : [...choice.selectedValues, value];
        return { ...choice, selectedValues: selected };
      }),
    );
  };

  const generate = () => {
    if (!readyToGenerate || !category) {
      toast.error("Complete Steps 1–3 before generating the Excel template.");
      return;
    }

    try {
      const input: TemplateConfig = {
        categoryId,
        categoryName: category.name,
        productName: productName.trim(),
        mainSku: mainSku.trim().toUpperCase(),
        brandName: brandName.trim() || "AURONA",
        unit: unit.trim() || "Pc",
        modelName: modelName.trim(),
        variations,
        combinations,
      };
      const url = URL.createObjectURL(
        new Blob([createBulkProductWorkbook(input)], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${input.mainSku}-product-master.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Generated ${combinations.length} exact variant combinations`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Template generation failed");
    }
  };

  const upload = async (file: File) => {
    setBusy(true);
    setPreview(undefined);
    try {
      const next = parseBulkProductWorkbook(await file.arrayBuffer());
      setParsed(next);
      setPreview(await previewFn({ data: next as any }));
    } catch (error) {
      setParsed(undefined);
      toast.error(error instanceof Error ? error.message : "Excel validation failed");
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!preview || preview.errorCount || !parsed) return;
    setBusy(true);
    try {
      const result = await commitFn({ data: { rows: preview.normalizedRows } as any });
      toast.success(
        `Import complete: ${result.created_variants ?? 0} created, ${result.updated_variants ?? 0} updated`,
      );
      setParsed(undefined);
      setPreview(undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed; no changes were committed");
    } finally {
      setBusy(false);
    }
  };

  if (config.isError) {
    return (
      <div className="max-w-full space-y-5">
        <Link
          to="/aurona-console-9f2x7k/products"
          className="inline-flex items-center gap-1 text-sm text-slate-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to products
        </Link>
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <div className="font-semibold">Bulk upload configuration could not be loaded</div>
          <p className="mt-1">
            {config.error instanceof Error ? config.error.message : "Please retry."}
          </p>
          <Button
            className="mt-3"
            type="button"
            variant="outline"
            onClick={() => config.refetch()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full space-y-5">
      <Link
        to="/aurona-console-9f2x7k/products"
        className="inline-flex items-center gap-1 text-sm text-slate-500"
      >
        <ArrowLeft className="h-4 w-4" /> Back to products
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Dynamic Bulk Products Upload</h1>
        <p className="text-sm text-slate-500">
          Category → Variations → Variation Values → Excel Template → Validate, Preview and Import.
        </p>
      </div>

      <section className="space-y-5 rounded-xl border bg-white p-5">
        <div>
          <h2 className="font-semibold">Step 1 – Select Category</h2>
          <p className="mt-1 text-xs text-slate-500">
            Select one product category. The variation choices in Step 2 are loaded from that category's saved product axes.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Product Category</span>
            <select
              className="h-10 w-full rounded-md border px-3"
              value={categoryId}
              onChange={(event) => resetCategory(event.target.value)}
            >
              <option value="">Select category…</option>
              {(config.data?.categories ?? []).map((row: any) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Product Name</span>
            <input
              className="h-10 w-full rounded-md border px-3"
              placeholder="Example: Nexa"
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Main SKU / SKU Prefix</span>
            <input
              className="h-10 w-full rounded-md border px-3 font-mono uppercase"
              placeholder="Example: CL-NEXA"
              value={mainSku}
              onChange={(event) => setMainSku(event.target.value)}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Brand Name</span>
            <input
              className="h-10 w-full rounded-md border px-3"
              value={brandName}
              onChange={(event) => setBrandName(event.target.value)}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Unit</span>
            <input
              className="h-10 w-full rounded-md border px-3"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Model Name</span>
            <input
              className="h-10 w-full rounded-md border px-3"
              placeholder="Example: NEXA"
              value={modelName}
              onChange={(event) => setModelName(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-white p-5">
        <div>
          <h2 className="font-semibold">Step 2 – Select Variations</h2>
          <p className="mt-1 text-xs text-slate-500">
            Select variations in the exact order required for variant names and SKU generation. Use the arrows to change the order.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-10 rounded-md border px-3"
            value=""
            disabled={!categoryId || choices.length >= 3}
            onChange={(event) => addChoice(event.target.value)}
          >
            <option value="">Add variation…</option>
            {availableVariations
              .filter((option) => !choices.some((choice) => choice.id === option.id))
              .map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
          </select>
          <span className="text-xs text-slate-500">
            The supplied Product Master template has 3 variation slots.
          </span>
        </div>

        {categoryId && availableVariations.length === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            No saved variation axes/values were found for this category. Configure the category's product variations first; Bulk Upload will not invent values.
          </div>
        )}

        {choices.length > 0 && (
          <div className="space-y-2">
            {choices.map((choice, index) => (
              <div
                key={choice.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <div className="text-xs text-slate-500">Variation {index + 1}</div>
                  <div className="font-medium">{choice.name}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    disabled={index === 0}
                    onClick={() => moveChoice(index, -1)}
                    title="Move variation up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    disabled={index === choices.length - 1}
                    onClick={() => moveChoice(index, 1)}
                    title="Move variation down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => setChoices((current) => current.filter((_, i) => i !== index))}
                    title="Remove variation"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-xl border bg-white p-5">
        <div>
          <h2 className="font-semibold">Step 3 – Select Variation Values</h2>
          <p className="mt-1 text-xs text-slate-500">
            Select only the values needed for this upload. Combinations are generated only from these selected values.
          </p>
        </div>

        {choices.length === 0 ? (
          <div className="text-sm text-slate-500">Select at least one variation in Step 2.</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {choices.map((choice, choiceIndex) => (
              <div key={choice.id} className="rounded-lg border p-4">
                <div className="font-medium">
                  {choiceIndex + 1}. {choice.name}
                </div>
                {choice.availableValues.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {choice.availableValues.map((value) => {
                      const selected = choice.selectedValues.includes(value);
                      return (
                        <label
                          key={value}
                          className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${
                            selected
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={selected}
                            onChange={() => toggleValue(choiceIndex, value)}
                          />
                          {value}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                    No saved values are available for this variation in the selected category.
                  </div>
                )}
                <div className="mt-3 text-xs text-slate-500">
                  {choice.selectedValues.length} value{choice.selectedValues.length === 1 ? "" : "s"} selected
                </div>
              </div>
            ))}
          </div>
        )}

        {combinations.length > 0 && (
          <div className="rounded-lg border bg-slate-50 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm">{combinations.length} exact combinations</strong>
              <span className="text-xs text-slate-500">Order follows Step 2.</span>
            </div>
            <div className="max-h-56 overflow-auto rounded-md border bg-white">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-100">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Variant</th>
                    <th className="p-2 text-left">Generated SKU</th>
                  </tr>
                </thead>
                <tbody>
                  {combinations.map((combination, index) => (
                    <tr key={generateVariantSku(mainSku || "SKU", combination)} className="border-t">
                      <td className="p-2">{index + 1}</td>
                      <td className="p-2">{variantName(combination)}</td>
                      <td className="p-2 font-mono">
                        {mainSku.trim() ? generateVariantSku(mainSku, combination) : "Enter Main SKU"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-xl border bg-white p-5">
        <div>
          <h2 className="font-semibold">Step 4 – Generate Excel Template</h2>
          <p className="mt-1 text-xs text-slate-500">
            The workbook keeps the exact 70-column Product Master header structure and fills one row per selected combination.
          </p>
        </div>
        <Button onClick={generate} disabled={!readyToGenerate}>
          <Download className="mr-1 h-4 w-4" /> Generate Excel Template
        </Button>
      </section>

      <section className="space-y-4 rounded-xl border bg-white p-5">
        <div>
          <h2 className="font-semibold">
            Step 5 – Upload Completed Excel → Validate → Preview → Import
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Uploads are accepted only when the Product Master header names, serial numbers and column order match the master template.
          </p>
        </div>

        <label>
          <input
            hidden
            type="file"
            accept=".xlsx"
            onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])}
          />
          <Button asChild disabled={busy}>
            <span>
              <Upload className="mr-1 h-4 w-4" /> Choose completed Excel
            </span>
          </Button>
        </label>

        {preview && (
          <>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ["Products", preview.productsDetected],
                ["New products", preview.productsToCreate],
                ["Product updates", preview.productsToUpdate],
                ["New variants", preview.variantsToCreate],
                ["Variant updates", preview.variantsToUpdate],
                ["Errors", preview.errorCount],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border p-3">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="text-xl font-semibold">{value}</div>
                </div>
              ))}
            </div>

            <div
              className="max-h-[50vh] overflow-auto rounded-lg border"
              tabIndex={0}
            >
              <table className="min-w-[850px] w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100">
                  <tr>
                    {["Row", "Function", "Main SKU", "Variant SKU", "Validation"].map((label) => (
                      <th key={label} className="p-2 text-left">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row: any) => (
                    <tr key={row.excelRow} className="border-t">
                      <td className="p-2">{row.excelRow}</td>
                      <td className="p-2 capitalize">{row.action}</td>
                      <td className="p-2 font-mono">{row.mainSku}</td>
                      <td className="p-2 font-mono">{row.variantSku}</td>
                      <td
                        className={`p-2 ${
                          row.errors.length ? "text-red-700" : "text-emerald-700"
                        }`}
                      >
                        {row.errors.join("; ") || "Ready"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button
              disabled={busy || preview.errorCount > 0 || !parsed}
              onClick={commit}
            >
              {busy ? "Importing…" : "Confirm Import"}
            </Button>
          </>
        )}
      </section>
    </div>
  );
}
