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
  buildProductMasterColumnIndex,
  buildProductMasterColumns,
  type ProductMasterColumn,
  type ProductMasterColumnKey,
} from "@/lib/bulk-product-columns";
import {
  generateVariationCombinations,
  normalizeMainSku,
  variantName,
} from "@/lib/sku-generation";
import { expectedBulkVariantSku } from "@/lib/bulk-product-identity";
import {
  parsePastedValues,
  PRODUCT_VARIATION_PRESETS,
  variationAxisKey,
} from "@/lib/variant-options";

export const Route = createFileRoute("/aurona-console-9f2x7k/products/bulk")({
  component: BulkCatalog,
});

type Choice = {
  id: string;
  axisKey: string;
  name: string;
  selectedValues: string[];
};

type OnlineRow = {
  excelRow: number;
  values: unknown[];
};

const ONLINE_GROUPS = [
  { id: "basic", label: "Basic Details", groups: ["Product / Variant"] },
  { id: "single", label: "Single PC", groups: ["Single PC Details"] },
  { id: "customer", label: "Customer", groups: ["Customer Details"] },
  { id: "retailer", label: "Retailer", groups: ["Retailer Details"] },
  { id: "distributor", label: "Distributor", groups: ["Distributor Details"] },
  { id: "commission", label: "Commission", groups: ["Commission Details"] },
  { id: "seo", label: "SEO & Other", groups: ["SEO Details", "Shipping", "Warranty", "Frequently Bought Category"] },
] as const;

const ONLINE_READ_ONLY_KEYS = new Set<ProductMasterColumnKey>([
  "sr_no",
  "function",
  "category_name",
  "product_name",
  "main_sku",
  "brand",
  "unit",
  "model",
  "variant_name",
  "variant_sku",
]);

const isOnlineReadOnlyKey = (key: ProductMasterColumnKey) =>
  ONLINE_READ_ONLY_KEYS.has(key) || /^variation_\d+_(?:name|value)$/.test(key);

const ONLINE_NUMERIC_KEYS = new Set<ProductMasterColumnKey>([
  "mrp",
  "weight_g",
  "dim_l",
  "dim_w",
  "dim_h",
  "customer_discount",
  "customer_price",
  "customer_moq",
  "customer_stock",
  "customer_reserved_stock",
  "customer_pack_size",
  "customer_pack_weight_g",
  "customer_pack_l",
  "customer_pack_w",
  "customer_pack_h",
  "retailer_discount",
  "retailer_price",
  "retailer_moq",
  "retailer_stock",
  "retailer_reserved_stock",
  "retailer_pack_size",
  "retailer_pack_weight_g",
  "retailer_pack_l",
  "retailer_pack_w",
  "retailer_pack_h",
  "distributor_discount",
  "distributor_price",
  "distributor_moq",
  "distributor_stock",
  "distributor_reserved_stock",
  "distributor_pack_size",
  "distributor_pack_weight_g",
  "distributor_pack_l",
  "distributor_pack_w",
  "distributor_pack_h",
  "commission_value",
  "max_commission",
  "shipping_days",
]);

const onlineFieldLabel = (column: ProductMasterColumn) =>
  (column.detailHeader || column.topHeader).replace(/\s+/g, " ").trim();

function BulkApplyBar({
  columns,
  onApply,
}: {
  columns: ProductMasterColumn[];
  onApply: (key: ProductMasterColumnKey, value: string) => void;
}) {
  const editable = columns.filter((column) => !isOnlineReadOnlyKey(column.key));
  const [field, setField] = useState<ProductMasterColumnKey>(editable[0]?.key ?? "mrp");
  const [value, setValue] = useState("");

  if (!editable.length) return null;

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-slate-50 p-3">
      <label className="space-y-1 text-xs">
        <span className="font-medium text-slate-600">Apply field to all variants</span>
        <select
          className="h-9 min-w-[220px] rounded-md border bg-white px-2"
          value={field}
          onChange={(event) => setField(event.target.value as ProductMasterColumnKey)}
        >
          {editable.map((column) => (
            <option key={column.key} value={column.key}>
              #{column.serial} {onlineFieldLabel(column)}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-xs">
        <span className="font-medium text-slate-600">Value</span>
        <input
          className="h-9 min-w-[180px] rounded-md border bg-white px-2"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Enter value"
        />
      </label>
      <Button type="button" size="sm" variant="outline" onClick={() => onApply(field, value)}>
        Apply to All ↓
      </Button>
    </div>
  );
}

function OnlineGroupEditor({
  label,
  columns,
  rows,
  setCell,
  applyAll,
  open,
}: {
  label: string;
  columns: ProductMasterColumn[];
  rows: OnlineRow[];
  setCell: (rowIndex: number, key: ProductMasterColumnKey, value: string) => void;
  applyAll: (key: ProductMasterColumnKey, value: string) => void;
  open?: boolean;
}) {
  return (
    <details className="rounded-xl border bg-white" open={open}>
      <summary className="cursor-pointer select-none px-4 py-3 font-semibold">{label}</summary>
      <div className="space-y-3 border-t p-4">
        <BulkApplyBar columns={columns} onApply={applyAll} />
        <div className="max-h-[420px] overflow-auto rounded-lg border" tabIndex={0}>
          <table className="min-w-max border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100">
              <tr>
                <th className="sticky left-0 z-20 min-w-[56px] border-b border-r bg-slate-100 p-2 text-left">
                  Row
                </th>
                {columns.map((column) => (
                  <th key={column.key} className="min-w-[150px] max-w-[240px] border-b border-r p-2 text-left">
                    <div className="font-semibold">{onlineFieldLabel(column)}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-slate-400">#{column.serial}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={row.excelRow} className="border-t">
                  <td className="sticky left-0 z-10 border-r bg-white p-2 font-mono">{row.excelRow}</td>
                  {columns.map((column) => {
                    const value = row.values[column.serial - 1] ?? "";
                    const readOnly = isOnlineReadOnlyKey(column.key);
                    return (
                      <td key={column.key} className="border-r p-1.5">
                        <input
                          className={`h-9 w-full min-w-[140px] rounded-md border px-2 ${
                            readOnly ? "bg-slate-50 text-slate-500" : "bg-white"
                          }`}
                          type={ONLINE_NUMERIC_KEYS.has(column.key) ? "number" : "text"}
                          value={String(value)}
                          readOnly={readOnly}
                          onChange={(event) => setCell(rowIndex, column.key, event.target.value)}
                          title={column.productManagerField}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

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
  const [onlineRows, setOnlineRows] = useState<OnlineRow[]>([]);
  const [onlineMode, setOnlineMode] = useState(false);
  const [variationValueDrafts, setVariationValueDrafts] = useState<Record<string, string>>({});

  const category = config.data?.categories?.find((row: any) => row.id === categoryId);
  const activeColumns = useMemo(
    () => buildProductMasterColumns(choices.length || 3),
    [choices.length],
  );
  const activeColumnIndex = useMemo(
    () => buildProductMasterColumnIndex(activeColumns),
    [activeColumns],
  );

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
    choices.every((choice) => choice.name.trim() && choice.selectedValues.length > 0) &&
    new Set(choices.map((choice) => choice.axisKey)).size === choices.length &&
    combinations.length > 0;

  const buildOnlineRows = (): OnlineRow[] => {
    if (!category) return [];

    return combinations.map((combination, index) => {
      const values = Array(activeColumns.length).fill("");
      const set = (key: ProductMasterColumnKey, value: unknown) => {
        values[activeColumnIndex[key]] = value ?? "";
      };

      set("sr_no", index + 1);
      set("function", "Create");
      set("category_name", category.name);
      set("product_name", productName.trim());
      set("main_sku", normalizeMainSku(mainSku));
      set("brand", brandName.trim() || "AURONA");
      set("unit", unit.trim() || "Pc");
      set("model", modelName.trim());
      set("variant_name", variantName(combination));
      set("variant_sku", expectedBulkVariantSku(normalizeMainSku(mainSku), combination));
      combination.forEach((selection, slot) => {
        const nameKey = (`variation_${slot + 1}_name`) as ProductMasterColumnKey;
        const valueKey = (`variation_${slot + 1}_value`) as ProductMasterColumnKey;
        set(nameKey, selection.name);
        set(valueKey, selection.value);
      });
      set(
        "attributes_json",
        JSON.stringify(Object.fromEntries(combination.map((item) => [item.name, item.value]))),
      );

      return { excelRow: index + 4, values };
    });
  };

  const openOnlineEditor = () => {
    if (!readyToGenerate) {
      toast.error("Complete Steps 1–3 before entering product details.");
      return;
    }
    setOnlineRows(buildOnlineRows());
    setOnlineMode(true);
    setParsed(undefined);
    setPreview(undefined);
  };

  const setOnlineCell = (rowIndex: number, key: ProductMasterColumnKey, value: string) => {
    setOnlineRows((current) =>
      current.map((row, index) => {
        if (index !== rowIndex) return row;
        const values = [...row.values];
        values[activeColumnIndex[key]] = value;
        return { ...row, values };
      }),
    );
  };

  const applyOnlineAll = (key: ProductMasterColumnKey, value: string) => {
    setOnlineRows((current) =>
      current.map((row) => {
        const values = [...row.values];
        values[activeColumnIndex[key]] = value;
        return { ...row, values };
      }),
    );
    toast.success(
      `${onlineFieldLabel(activeColumns[activeColumnIndex[key]])} applied to all variants`,
    );
  };

  const previewOnline = async () => {
    if (!onlineRows.length || !category) return;
    setBusy(true);
    try {
      const payload = {
        metadata: {
          template_version: "aurona-product-master-v1",
          category_id: categoryId,
          category_name: category.name,
          main_sku: normalizeMainSku(mainSku),
          variation_configuration: variations,
          variation_count: choices.length,
          column_keys: activeColumns.map((column) => column.key),
          source: "online",
        },
        rows: onlineRows,
      };
      const nextPreview = await previewFn({ data: payload as any });
      setParsed(payload);
      setPreview(nextPreview);
      toast.success(
        nextPreview.errorCount
          ? "Validation completed with errors"
          : "Online details validated and ready to preview",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Online validation failed");
    } finally {
      setBusy(false);
    }
  };

  const resetCategory = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
    setChoices([]);
    setVariationValueDrafts({});
    setParsed(undefined);
    setPreview(undefined);
    setOnlineRows([]);
    setOnlineMode(false);
  };

  const invalidateOnlineDraft = () => {
    if (!onlineRows.length && !onlineMode) return;
    setOnlineRows([]);
    setOnlineMode(false);
    setParsed(undefined);
    setPreview(undefined);
  };

  const removeChoice = (index: number) => {
    invalidateOnlineDraft();
    setChoices((current) => {
      const removed = current[index];
      if (removed) {
        setVariationValueDrafts((drafts) => {
          const next = { ...drafts };
          delete next[removed.id];
          return next;
        });
      }
      return current.filter((_, choiceIndex) => choiceIndex !== index);
    });
  };

  const addChoice = (id: string) => {
    if (!id) return;
    setOnlineRows([]);
    setOnlineMode(false);
    setParsed(undefined);
    setPreview(undefined);

    if (id === "__other__") {
      const customId = `custom-${crypto.randomUUID()}`;
      setChoices((current) => [
        ...current,
        { id: customId, axisKey: `custom_${current.length + 1}`, name: "", selectedValues: [] },
      ]);
      return;
    }

    const preset = PRODUCT_VARIATION_PRESETS.find(([key]) => key === id);
    if (!preset || choices.some((choice) => choice.axisKey === preset[0])) return;
    setChoices((current) => [
      ...current,
      {
        id: preset[0],
        axisKey: preset[0],
        name: preset[1],
        selectedValues: [],
      },
    ]);
  };

  const updateChoice = (choiceIndex: number, patch: Partial<Choice>) => {
    invalidateOnlineDraft();
    setChoices((current) =>
      current.map((choice, index) => {
        if (index !== choiceIndex) return choice;
        const next = { ...choice, ...patch };
        if (patch.name !== undefined) next.axisKey = variationAxisKey(patch.name) || choice.axisKey;
        return next;
      }),
    );
  };

  const moveChoice = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    setOnlineRows([]);
    setOnlineMode(false);
    setParsed(undefined);
    setPreview(undefined);
    if (nextIndex < 0 || nextIndex >= choices.length) return;
    setChoices((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
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
        mainSku: normalizeMainSku(mainSku),
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
      setOnlineRows([]);
      setOnlineMode(false);
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
            Select one product category. Variation types are chosen manually in Step 2, just like Create Product.
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
              onChange={(event) => {
                invalidateOnlineDraft();
                setProductName(event.target.value);
              }}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Main SKU / SKU Prefix</span>
            <input
              className="h-10 w-full rounded-md border px-3 font-mono uppercase"
              placeholder="Example: CL-NEXA"
              value={mainSku}
              onChange={(event) => {
                invalidateOnlineDraft();
                setMainSku(event.target.value);
              }}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Brand Name</span>
            <input
              className="h-10 w-full rounded-md border px-3"
              value={brandName}
              onChange={(event) => {
                invalidateOnlineDraft();
                setBrandName(event.target.value);
              }}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Unit</span>
            <input
              className="h-10 w-full rounded-md border px-3"
              value={unit}
              onChange={(event) => {
                invalidateOnlineDraft();
                setUnit(event.target.value);
              }}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Model Name</span>
            <input
              className="h-10 w-full rounded-md border px-3"
              placeholder="Example: NEXA"
              value={modelName}
              onChange={(event) => {
                invalidateOnlineDraft();
                setModelName(event.target.value);
              }}
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
            disabled={!categoryId}
            onChange={(event) => addChoice(event.target.value)}
          >
            <option value="">Add variation…</option>
            {PRODUCT_VARIATION_PRESETS
              .filter(([key]) => !choices.some((choice) => choice.axisKey === key))
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            <option value="__other__">Other option…</option>
          </select>
          <span className="text-xs text-slate-500">
            Choose only what this product needs. Excel variation columns expand or contract automatically.
          </span>
        </div>

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
                    onClick={() => removeChoice(index)}
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
                <div className="grid gap-3 md:grid-cols-[200px_1fr]">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">{choiceIndex + 1}. Option</span>
                    <input
                      className="h-10 w-full rounded-md border px-3"
                      value={choice.name}
                      placeholder="Example: Watt"
                      onChange={(event) => updateChoice(choiceIndex, { name: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Values</span>
                    <textarea
                      className="min-h-[80px] w-full rounded-md border px-3 py-2"
                      value={variationValueDrafts[choice.id] ?? choice.selectedValues.join(", ")}
                      placeholder={
                        /watt/i.test(choice.name)
                          ? "5W, 7W, 9W"
                          : /output colou?r/i.test(choice.name)
                            ? "Red, White"
                            : /pack size/i.test(choice.name)
                              ? "6, 12"
                              : "Enter comma-separated values"
                      }
                      onChange={(event) => {
                        const raw = event.target.value;
                        setVariationValueDrafts((current) => ({ ...current, [choice.id]: raw }));
                        updateChoice(choiceIndex, {
                          selectedValues: parsePastedValues(raw),
                        });
                      }}
                      onBlur={() =>
                        setVariationValueDrafts((current) => {
                          const next = { ...current };
                          delete next[choice.id];
                          return next;
                        })
                      }
                    />
                    <span className="block text-xs text-slate-500">
                      Same entry style as Create Product: comma, line, tab or semicolon separated.
                    </span>
                  </label>
                </div>
                {choice.selectedValues.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {choice.selectedValues.map((value) => (
                      <span key={value} className="rounded-full border bg-slate-50 px-3 py-1 text-xs">
                        {value}
                      </span>
                    ))}
                  </div>
                )}
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
                    <tr key={expectedBulkVariantSku(mainSku || "SKU", combination)} className="border-t">
                      <td className="p-2">{index + 1}</td>
                      <td className="p-2">{variantName(combination)}</td>
                      <td className="p-2 font-mono">
                        {mainSku.trim() ? expectedBulkVariantSku(mainSku, combination) : "Enter Main SKU"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {combinations.length > 0 && (
        <section className="space-y-4 rounded-xl border bg-white p-5">
          <div>
            <h2 className="font-semibold">Choose how to enter product details</h2>
            <p className="mt-1 text-xs text-slate-500">
              Both options use the same dynamic Product Master mapping. Only variation Name/Value pairs change with your selection.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={openOnlineEditor}
              className="rounded-xl border-2 border-slate-900 bg-slate-900 p-4 text-left text-white transition hover:bg-slate-800"
            >
              <div className="text-base font-semibold">📝 Fill Product Details Online</div>
              <div className="mt-1 text-xs text-slate-200">Recommended for a few products</div>
            </button>
            <button
              type="button"
              onClick={generate}
              disabled={!readyToGenerate}
              className="rounded-xl border-2 border-slate-200 bg-white p-4 text-left transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="text-base font-semibold">📥 Download Excel for Bulk Entry</div>
              <div className="mt-1 text-xs text-slate-500">Recommended for many products</div>
            </button>
          </div>
        </section>
      )}

      {onlineMode && onlineRows.length > 0 && (
        <section className="space-y-4 rounded-xl border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Enter Product Details</h2>
              <p className="mt-1 text-xs text-slate-500">
                One row per generated variant. Generated product/SKU/variation fields are prefilled; fill only the remaining details.
              </p>
            </div>
            <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700">
              {onlineRows.length} variant{onlineRows.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="space-y-3">
            {ONLINE_GROUPS.map((group) => {
              const columns = activeColumns.filter((column) =>
                (group.groups as readonly string[]).includes(column.group),
              );
              return (
                <OnlineGroupEditor
                  key={group.id}
                  label={group.label}
                  columns={columns}
                  rows={onlineRows}
                  setCell={setOnlineCell}
                  applyAll={applyOnlineAll}
                  open={group.id === "basic"}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={previewOnline} disabled={busy}>
              {busy ? "Validating…" : "Validate & Preview Online Details"}
            </Button>
            <span className="text-xs text-slate-500">
              Uses the same validation and import path as an uploaded Product Master Excel file.
            </span>
          </div>
        </section>
      )}

      <details className="rounded-xl border bg-white">
        <summary className="cursor-pointer select-none p-5 font-semibold">
          View Technical Column Mapping ({activeColumns.length} columns)
        </summary>
        <div className="space-y-4 border-t p-5">
          <p className="text-xs text-slate-500">
            Reference only. This exact dynamic column definition drives online entry, Excel generation, upload validation,
            preview and database import.
          </p>
          <div className="max-h-[560px] overflow-auto rounded-lg border" tabIndex={0}>
            <table className="min-w-[1180px] w-full border-collapse text-sm">
              <thead className="sticky top-0 z-20 bg-slate-100 shadow-sm">
                <tr>
                  <th className="w-16 border-b p-2 text-left">#</th>
                  <th className="w-52 border-b p-2 text-left">Group</th>
                  <th className="w-72 border-b p-2 text-left">Excel field</th>
                  <th className="border-b p-2 text-left">Product Manager / Database mapping</th>
                </tr>
              </thead>
              <tbody>
                {activeColumns.map((column) => (
                  <tr key={column.serial} className="border-t bg-white align-top">
                    <td className="p-2 font-mono font-semibold">{column.serial}</td>
                    <td className="p-2">{column.group}</td>
                    <td className="p-2">
                      <div className="font-medium">
                        {column.detailHeader || column.topHeader.replace(/\s+/g, " ").trim()}
                      </div>
                      {column.detailHeader && column.topHeader && (
                        <div className="mt-0.5 text-xs text-slate-500">
                          Excel group: {column.topHeader.replace(/\s+/g, " ").trim()}
                        </div>
                      )}
                    </td>
                    <td className="p-2 font-mono text-xs text-slate-700">{column.productManagerField}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <section className="space-y-4 rounded-xl border bg-white p-5">
        <div>
          <h2 className="font-semibold">Step 4 – Generate Excel Template</h2>
          <p className="mt-1 text-xs text-slate-500">
            The workbook keeps every existing Product Master field unchanged and creates exactly {choices.length} Variation Name/Value pair{choices.length === 1 ? "" : "s"} for this product.
          </p>
        </div>
        <Button onClick={generate} disabled={!readyToGenerate}>
          <Download className="mr-1 h-4 w-4" /> Download Excel Template
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
              <Upload className="mr-1 h-4 w-4" /> Upload Completed Excel
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
