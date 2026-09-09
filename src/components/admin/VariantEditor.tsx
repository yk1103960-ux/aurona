import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Save,
  Plus,
  Trash2,
  Users,
  Store,
  Warehouse,
  Truck,
  SlidersHorizontal,
  Pencil,
  Image as ImageIcon,
  Copy,
  ArrowLeft,
  ArrowRight,
  Upload,
  Star,
} from "lucide-react";
import {
  adminLoadVariantMatrix,
  adminSaveVariantMatrix,
  adminSetPrimaryProductImage,
} from "@/lib/catalog-admin.functions";
import { ProductImageManager } from "@/components/admin/ProductImageManager";
import { missingCombinations } from "@/lib/variant-options";

import {
  newVariation,
  prepareVariationAxes,
  variationIssues,
  VARIATION_STEPS,
  type Variant,
  type Axis,
} from "@/lib/variant-workflow";
import {
  persistVariationPhotos,
  validateVariationPhoto,
  type VariationPhotoDraft,
} from "@/lib/variant-photo-drafts";

type Tab = "quick" | "options" | "customer" | "retailer" | "distributor" | "shipping";

const toNumber = (value: string): number | null => (value === "" ? null : Number(value));

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const discountAmount = (mrp: number | null, price: number | null) => {
  const m = Number(mrp ?? 0);
  const p = Number(price ?? 0);
  return Math.max(0, m - p);
};

const discountPercent = (mrp: number | null, price: number | null) => {
  const m = Number(mrp ?? 0);
  const p = Number(price ?? 0);

  if (m <= 0 || p >= m) return 0;

  return ((m - p) / m) * 100;
};

const variantName = (row: Variant) => {
  if (row.attributes?.variant_label) return row.attributes.variant_label;
  const values = Object.values(row.attributes ?? {}).filter(Boolean);
  return values.length ? values.join(" / ") : row.sku;
};

const optionToken = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

export function VariantEditor({
  productSku,
  productId,
  familyId,
  onManageImages,
  initialTab = "options",
}: {
  productSku: string;
  productId: string;
  familyId?: string | null;
  onManageImages?: (sku: string) => void;
  initialTab?: Tab;
}) {
  const [rows, setRows] = useState<Variant[]>([]);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>(initialTab === "options" ? "quick" : initialTab);
  const [showAllTabs, setShowAllTabs] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [axesDirty, setAxesDirty] = useState(false);
  const [axisRows, setAxisRows] = useState<Axis[]>([]);
  const [excluded, setExcluded] = useState<Record<string, string[]>>({});
  const [wizardStep, setWizardStep] = useState(0);
  const [copying, setCopying] = useState(false);
  const [photoDrafts, setPhotoDrafts] = useState<Record<string, VariationPhotoDraft[]>>({});
  const objectUrls = useRef(new Set<string>());
  const committedRows = useRef<Variant[]>([]);
  const photosPending = Object.values(photoDrafts).some((photos) => photos.length > 0);
  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  const dirty = useRef(false);
  const qc = useQueryClient();
  const busy = saving || copying;
  useBlocker({
    shouldBlockFn: () =>
      (dirty.current || axesDirty || photosPending || busy) &&
      !window.confirm(
        busy
          ? "A save is in progress. Leave this page anyway?"
          : "Leave without saving your variation changes? Stay on this page to save them first.",
      ),
    enableBeforeUnload: () => dirty.current || axesDirty || photosPending || busy,
  });

  const q = useQuery({
    queryKey: ["admin-product-variants", familyId ?? null, productId, productSku],
    enabled: !!productSku || !!familyId,
    refetchOnWindowFocus: false,

    queryFn: async () => {
      const result = await adminLoadVariantMatrix({
        data: { familyId: familyId ?? null, productId, productSku },
      });

      return {
        family: result.family,
        variants: (result.variants ?? []).map((row: Partial<Variant>) => ({
          ...row,
          barcode: row.barcode ?? "",
          expected_stock: Number(row.stock ?? 0),
        })) as Variant[],
        axes: (result.axes ?? []).map((axis: Axis) => ({
          ...axis,
          values: Array.isArray(axis.values) ? axis.values : [],
        })) as Axis[],
      };
    },
  });

  useRealtime(["product_variants"], () => {
    if (!dirty.current && !axesDirty && !photosPending && !busy) q.refetch();
  });

  const lastLoadedData = useRef<typeof q.data>(undefined);
  useEffect(() => {
    if (!q.data || q.data === lastLoadedData.current) return;
    lastLoadedData.current = q.data;
    if (q.data && !dirty.current) {
      setRows(q.data.variants);
      if (committedRows.current.length) {
        const mappings = committedRows.current.flatMap((old) => {
          const saved = q.data.variants.find(
            (row) => row.sku.trim().toUpperCase() === old.sku.trim().toUpperCase(),
          );
          return saved && old.id !== saved.id ? [[old.id, saved.id] as const] : [];
        });
        setPhotoDrafts((current) => {
          const next = { ...current };
          for (const [from, to] of mappings)
            if (next[from]) {
              next[to] = next[from];
              delete next[from];
            }
          return next;
        });
        setEditingId((current) => mappings.find(([from]) => from === current)?.[1] ?? current);
        committedRows.current = [];
      }
    }
    if (q.data && !axesDirty) setAxisRows(q.data.axes);
  }, [q.data, axesDirty]);

  useEffect(() => {
    setTab(initialTab === "options" ? "quick" : initialTab);
  }, [initialTab]);

  const family = q.data?.family;
  const axes = axisRows;

  if (q.isLoading) {
    return (
      <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Loading product variations…
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        <div className="font-semibold">Could not load product variations</div>
        <p className="mt-1">{q.error instanceof Error ? q.error.message : "Please retry."}</p>
        <Button className="mt-3" type="button" variant="outline" onClick={() => q.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!family) {
    return (
      <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <div className="font-semibold">Variation family is not ready</div>
        <p className="mt-1">
          Save the main product first, then reopen Manage Variations. If it was already saved, apply
          the product-admin parity migration and retry.
        </p>
        <Button className="mt-3" type="button" variant="outline" onClick={() => q.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const updateRow = (id: string, patch: Partial<Variant>) => {
    if (busy) return;
    dirty.current = true;

    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    if (busy) return;
    const draft = newVariation(family.id, productSku, rows);
    dirty.current = true;
    setRows([...rows, draft]);
    setWizardStep(0);
    setEditingId(draft.id);
  };

  const duplicateRow = async (source: Variant) => {
    if (busy) return;
    setCopying(true);
    try {
      let photos: VariationPhotoDraft[] = (photoDrafts[source.id] ?? []).map((photo) => ({
        id: crypto.randomUUID(),
        previewUrl: photo.previewUrl,
        file: photo.file,
        imageUrl: photo.imageUrl,
        altText: photo.altText,
        primary: photo.primary,
      }));
      if (!source.id.startsWith("new-")) {
        const result = await supabase
          .from("product_images")
          .select("image_url,alt_text,is_primary")
          .eq("family_id", family.id)
          .eq("variant_sku", source.sku)
          .order("sort_order");
        if (result.error) throw result.error;
        const persisted = (result.data ?? []).map((photo) => ({
          id: crypto.randomUUID(),
          previewUrl: photo.image_url,
          imageUrl: photo.image_url,
          altText: photo.alt_text ?? "",
          primary: photo.is_primary,
        }));
        photos = [
          ...persisted,
          ...photos.filter(
            (photo) =>
              !photoDrafts[source.id]?.find(
                (original) => original.previewUrl === photo.previewUrl && original.attached,
              ),
          ),
        ];
      }
      if (photos.length > 12)
        throw new Error(
          "This variation has more than 12 images. Manage its images before duplicating it.",
        );
      if (photos.length) {
        const primary = Math.max(
          0,
          photos.findIndex((photo) => photo.primary),
        );
        photos = photos.map((photo, index) => ({ ...photo, primary: index === primary }));
      }
      const draft = newVariation(family.id, productSku, rows, source);
      dirty.current = true;
      setRows([...rows, draft]);
      setPhotoDrafts((current) => ({ ...current, [draft.id]: photos }));
      setWizardStep(0);
      setEditingId(draft.id);
      toast.info(
        "Copy ready. Check its images, SKU, option values and prices. Stock is zero and the copy is inactive.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not prepare a complete copy. No variation was created.",
      );
    } finally {
      setCopying(false);
    }
  };

  const generateCombinations = (sourceAxes: Axis[] = axes, sourceRows: Variant[] = rows) => {
    try {
      const combinations = missingCombinations(sourceAxes, sourceRows);
      if (!combinations.length) return toast.info("All selected combinations already exist");
      const usedSkus = new Set(sourceRows.map((row) => row.sku.trim().toUpperCase()));
      const added = combinations.map((attributes, index) => {
        const suffix = sourceAxes.map((axis) => optionToken(attributes[axis.axis_key])).join("-");
        const base = `${productSku}-${suffix}`;
        let sku = base.slice(0, 120);
        let attempt = 2;
        while (usedSkus.has(sku.toUpperCase())) {
          const ending = `-${attempt++}`;
          sku = base.slice(0, 120 - ending.length) + ending;
        }
        usedSkus.add(sku.toUpperCase());
        return {
          id: `new-${crypto.randomUUID()}`,
          family_id: family.id,
          sku,
          barcode: "",
          attributes,
          mrp: null,
          price: null,
          discount_pct: 0,
          retailer_price: null,
          distributor_price: null,
          moq: 1,
          retailer_moq: null,
          distributor_moq: null,
          stock: 0,
          pack_size: null,
          weight_g: null,
          dim_l: null,
          dim_w: null,
          dim_h: null,
          pack_weight_g: null,
          pack_l: null,
          pack_w: null,
          pack_h: null,
          is_active: false,
          sort_order: sourceRows.length + index,
          low_stock_threshold: 10,
        } satisfies Variant;
      });
      dirty.current = true;
      setRows([...sourceRows, ...added]);
      toast.success(
        `${added.length} inactive drafts generated. Existing SKUs are unchanged. Enter prices and specifications before activating.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate variations");
    }
  };

  const removeRow = (row: Variant) => {
    if (!confirm(`Archive variant ${row.sku}? Existing orders will keep their SKU snapshot.`))
      return;
    dirty.current = true;
    if (row.id.startsWith("new-")) {
      setRows((current) => current.filter((item) => item.id !== row.id));
      setPhotoDrafts((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
    } else {
      updateRow(row.id, { is_active: false });
    }
    toast.success("Variant marked inactive. Save variants to apply.");
  };

  const saveMatrix = async (): Promise<Variant[] | null> => {
    if (busy) return null;
    let cleaned: Axis[];
    try {
      cleaned = prepareVariationAxes(axisRows, q.data?.axes ?? [], rows);
      for (const row of rows) {
        const issues = variationIssues(row, rows, cleaned);
        if (issues.length) throw new Error(`${row.sku || "Variation"}: ${issues[0]}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Review your variation details.");
      return null;
    }
    const snapshot = rows;
    const pending = photoDrafts;
    setSaving(true);
    let committed = false;
    try {
      await adminSaveVariantMatrix({
        data: {
          familyId: family.id,
          axes: cleaned,
          variants: snapshot.map((row) => ({
            ...row,
            id: row.id.startsWith("new-") ? undefined : row.id,
            sku: row.sku.trim(),
            discount_pct: discountPercent(row.mrp, row.price),
            low_stock_threshold: row.low_stock_threshold ?? 10,
          })),
        },
      });
      committed = true;
      committedRows.current = snapshot;
      dirty.current = false;
      setAxesDirty(false);
      const refreshed = await q.refetch();
      if (refreshed.error || !refreshed.data?.family)
        throw new Error(
          "The save succeeded, but the refreshed variations could not be loaded. Retry loading before saving again.",
        );
      const saved = refreshed.data.variants;
      setRows(saved);
      setAxisRows(refreshed.data.axes);
      setExcluded((current) => {
        const next: Record<string, string[]> = {};
        for (const axis of cleaned) {
          const updated = refreshed.data?.axes.find((item) => item.axis_key === axis.axis_key);
          if (updated && current[axis.id]) next[updated.id] = current[axis.id];
        }
        return next;
      });
      for (const [draftId, photos] of Object.entries(pending)) {
        if (!photos.length) continue;
        const original = snapshot.find((row) => row.id === draftId);
        const target = saved.find(
          (row) =>
            row.id === draftId ||
            (original && row.sku.trim().toUpperCase() === original.sku.trim().toUpperCase()),
        );
        if (!target)
          throw new Error(
            "A saved SKU could not be matched to its pending photos. Reload before retrying.",
          );
        const existing = await supabase
          .from("product_images")
          .select("id")
          .eq("family_id", family.id)
          .eq("variant_sku", target.sku);
        if (existing.error) throw existing.error;
        photos.forEach((photo, index) => {
          photo.sortOrder ??= (existing.data?.length ?? 0) + index;
        });
        await persistVariationPhotos(photos, {
          upload: async (photo) => {
            if (!photo.file) throw new Error("Choose this image again.");
            validateVariationPhoto(photo.file);
            const ext = (
              {
                "image/jpeg": "jpg",
                "image/png": "png",
                "image/webp": "webp",
                "image/gif": "gif",
                "image/avif": "avif",
              } as Record<string, string>
            )[photo.file.type];
            const path = `products/${family.id}/${crypto.randomUUID()}.${ext}`;
            const uploaded = await supabase.storage
              .from("media")
              .upload(path, photo.file, { cacheControl: "31536000", upsert: false });
            if (uploaded.error) throw uploaded.error;
            return `/api/public/product-image/${path}`;
          },
          attach: async (photo, url) => {
            const result = await supabase.from("product_images").upsert(
              {
                id: photo.id,
                family_id: family.id,
                product_id: null,
                variant_sku: target.sku,
                image_url: url,
                alt_text: photo.altText || null,
                sort_order: photo.sortOrder ?? 0,
                is_primary: false,
              },
              { onConflict: "id" },
            );
            if (result.error) throw result.error;
          },
          makePrimary: async (imageId) => {
            await adminSetPrimaryProductImage({ data: { imageId } });
          },
        });
        setPhotoDrafts((current) => {
          const next = { ...current };
          delete next[draftId];
          delete next[target.id];
          return next;
        });
      }
      toast.success("Options, variations and selected images saved.");
      return saved;
    } catch (error) {
      if (committed)
        toast.error(
          `Variation details saved; photo upload or refresh needs attention. ${error instanceof Error ? error.message : "Retry without creating another variation."}`,
        );
      else toast.error(error instanceof Error ? error.message : "Could not save variations.");
      return null;
    } finally {
      for (const key of [
        "admin-product-variants",
        "admin-product-images",
        "admin-inventory",
        "admin-product-master",
        "admin-products",
        "admin-product",
        "admin-dashboard",
        "product-images",
        "products",
        "families-page",
        "product",
        "family",
        "family-products",
        "browse-products",
        "search-suggest",
      ])
        void qc.invalidateQueries({
          queryKey: [key],
          refetchType: key === "admin-product-variants" ? "none" : "active",
        });
      setSaving(false);
      setPhotoDrafts((current) => ({ ...current }));
    }
  };
  const saveAll = async () => Boolean(await saveMatrix());
  const saveAxes = async (generate: boolean) => {
    let generationAxes: Axis[];
    let cleaned: Axis[];
    try {
      cleaned = prepareVariationAxes(axisRows, q.data?.axes ?? [], rows);
      generationAxes = cleaned.map((axis) => ({
        ...axis,
        values: axis.values.filter((value) => !(excluded[axis.id] ?? []).includes(value)),
      }));
      if (generate) missingCombinations(generationAxes, rows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Review the options.");
      return;
    }
    if (editingId) {
      // Do not lock a new, auto-generated SKU before the client reaches its SKU step.
      setAxisRows(cleaned);
      setAxesDirty(true);
      if (generate) {
        generateCombinations(generationAxes, rows);
        setEditingId(null);
        setTab("options");
      } else
        toast.info(
          "Options saved in this draft. Continue to SKU & values; Review & save writes the changes.",
        );
      return;
    }
    const saved = await saveMatrix();
    if (saved && generate) {
      generateCombinations(generationAxes, saved);
      setEditingId(null);
      setTab("options");
    }
  };
  const optionsEditor = (
    <AxisEditor
      rows={axisRows}
      variants={rows}
      saving={busy}
      saveAxes={saveAxes}
      setRows={(next) => {
        setAxisRows(next);
        setAxesDirty(true);
      }}
      excluded={excluded}
      setExcluded={setExcluded}
      draftOnly={Boolean(editingId)}
    />
  );

  return (
    <fieldset
      disabled={busy}
      className="md:col-span-2 min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      <div className="border-b border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wider text-slate-600">
              Product Variations
            </div>

            <div className="mt-1 text-xs text-slate-500">
              Manage options, customer pricing, partner pricing and shipping information for every
              SKU.
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" type="button" onClick={addRow}>
              <Plus className="mr-1 h-4 w-4" />
              Add Variation · step by step
            </Button>

            <Button size="sm" type="button" onClick={saveAll} disabled={busy || rows.length === 0}>
              <Save className="mr-1 h-4 w-4" />
              {saving ? "Saving…" : "Save Variants"}
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border-b border-slate-200">
        <div className="flex min-w-max gap-1 p-2">
          <TabButton
            active={tab === "quick"}
            onClick={() => setTab("quick")}
            icon={<SlidersHorizontal className="h-4 w-4" />}
          >
            Options & Variants
          </TabButton>

          {showAllTabs && (
            <TabButton
              active={tab === "options"}
              onClick={() => setTab("options")}
              icon={<SlidersHorizontal className="h-4 w-4" />}
            >
              All Variation Details
            </TabButton>
          )}

          <TabButton
            active={tab === "customer"}
            onClick={() => setTab("customer")}
            icon={<Users className="h-4 w-4" />}
          >
            Customer Price & Stock
          </TabButton>

          {showAllTabs && (
          <TabButton
            active={tab === "retailer"}
            onClick={() => setTab("retailer")}
            icon={<Store className="h-4 w-4" />}
          >
            Retailer Price & Stock
          </TabButton>
          )}

          {showAllTabs && (
          <TabButton
            active={tab === "distributor"}
            onClick={() => setTab("distributor")}
            icon={<Warehouse className="h-4 w-4" />}
          >
            Distributor Price & Stock
          </TabButton>
          )}

          {showAllTabs && (
          <TabButton
            active={tab === "shipping"}
            onClick={() => setTab("shipping")}
            icon={<Truck className="h-4 w-4" />}
          >
            Weight & Dimensions
          </TabButton>
          )}
          <button
            type="button"
            onClick={() => {
              const next = !showAllTabs;
              setShowAllTabs(next);
              if (!next && tab !== "quick" && tab !== "customer") setTab("quick");
            }}
            className="ml-2 shrink-0 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            {showAllTabs ? "Hide extra options" : "More options"}
          </button>
        </div>
      </div>

      {(dirty.current || axesDirty || photosPending) && (
        <div
          role="status"
          className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Unsaved changes. Save All Variant Changes saves shared options, SKU details and selected
          images together. Switching pricing tabs keeps your edits.
        </div>
      )}

      <div className="p-4">
        <div hidden={tab !== "quick"}>
          <QuickVariantsTab
            rows={rows}
            updateRow={updateRow}
            removeRow={removeRow}
            manageImages={onManageImages}
            optionsEditor={tab === "quick" && !editingId ? optionsEditor : null}
          />
        </div>

        <div hidden={tab !== "options"}>
          <OptionsTab
            axes={axes}
            rows={rows}
            updateRow={updateRow}
            removeRow={removeRow}
            editRow={(row) => {
              setWizardStep(0);
              setEditingId(row.id);
            }}
            duplicateRow={duplicateRow}
            manageImages={onManageImages}
            optionsEditor={editingId ? null : optionsEditor}
          />
        </div>

        {tab === "customer" && <CustomerTab rows={rows} updateRow={updateRow} />}

        {tab === "retailer" && <RetailerTab rows={rows} updateRow={updateRow} />}

        {tab === "distributor" && <DistributorTab rows={rows} updateRow={updateRow} />}

        {tab === "shipping" && <ShippingTab rows={rows} updateRow={updateRow} />}
      </div>

      <div className="flex justify-end border-t border-slate-200 bg-slate-50 p-4">
        <Button type="button" onClick={saveAll} disabled={busy || rows.length === 0}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving…" : "Save All Variant Changes"}
        </Button>
      </div>

      <VariantEditDialog
        row={rows.find((row) => row.id === editingId) ?? null}
        axes={axes}
        open={Boolean(editingId)}
        saving={busy}
        step={wizardStep}
        setStep={setWizardStep}
        rows={rows}
        optionsEditor={editingId ? optionsEditor : null}
        photos={editingId ? (photoDrafts[editingId] ?? []) : []}
        setPhotos={(photos) => {
          if (editingId) setPhotoDrafts((current) => ({ ...current, [editingId]: photos }));
        }}
        registerPreview={(file) => {
          const url = URL.createObjectURL(file);
          objectUrls.current.add(url);
          return url;
        }}
        productSku={productSku}
        productId={productId}
        duplicateRow={duplicateRow}
        onOpenChange={(open) => !open && setEditingId(null)}
        updateRow={updateRow}
        save={async () => {
          if (await saveAll()) setEditingId(null);
        }}
        manageImages={onManageImages}
      />
    </fieldset>
  );
}

type QuickField = "mrp" | "price" | "retailer_price" | "distributor_price" | "stock" | "pack_size";

const QUICK_FIELDS: { key: QuickField; label: string }[] = [
  { key: "mrp", label: "MRP" },
  { key: "price", label: "Customer price" },
  { key: "retailer_price", label: "Retailer price" },
  { key: "distributor_price", label: "Distributor price" },
  { key: "stock", label: "Stock" },
  { key: "pack_size", label: "Pack size" },
];

function QuickVariantsTab({
  rows,
  updateRow,
  removeRow,
  editRow,
  manageImages,
  optionsEditor,
}: {
  rows: Variant[];
  updateRow: (id: string, patch: Partial<Variant>) => void;
  removeRow: (row: Variant) => void;
  editRow: (row: Variant) => void;
  manageImages?: (sku: string) => void;
  optionsEditor: React.ReactNode;
}) {
  const [bulkField, setBulkField] = useState<QuickField>("price");
  const [bulkValue, setBulkValue] = useState("");

  const applyToAll = () => {
    const value = bulkValue === "" ? null : Number(bulkValue);
    if (value !== null && !Number.isFinite(value)) return toast.error("Enter a number first.");
    for (const row of rows) updateRow(row.id, { [bulkField]: value } as Partial<Variant>);
    toast.success(`Applied to all ${rows.length} variations. Save to keep the change.`);
  };

  const copyDown = (field: QuickField, index: number) => {
    const value = rows[index][field];
    for (const row of rows.slice(index + 1))
      updateRow(row.id, { [field]: value } as Partial<Variant>);
    toast.success("Copied to the rows below.");
  };

  return (
    <div className="space-y-5">
      {optionsEditor}

      <div>
        <h3 className="text-lg font-semibold">Variants · {rows.length}</h3>
        <p className="text-xs text-slate-500">
          Enter SKU, prices and stock right here. “Edit” opens weight, dimensions, barcode, MOQ and
          other advanced details.
        </p>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="text-xs font-medium text-slate-600">
            <span className="block">Fill every variation</span>
            <select
              className="mt-1 h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
              value={bulkField}
              onChange={(event) => setBulkField(event.target.value as QuickField)}
            >
              {QUICK_FIELDS.map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label}
                </option>
              ))}
            </select>
          </label>
          <Input
            className="h-9 w-32"
            inputMode="decimal"
            placeholder="Value"
            value={bulkValue}
            onChange={(event) => setBulkValue(event.target.value)}
          />
          <Button type="button" size="sm" variant="outline" onClick={applyToAll}>
            Apply to all
          </Button>
          <span className="text-xs text-slate-500">
            Nothing is saved until you use Save All Variant Changes.
          </span>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyVariants />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <Th>Variation</Th>
                <Th>SKU</Th>
                <Th>MRP</Th>
                <Th>Customer</Th>
                <Th>Retailer</Th>
                <Th>Distributor</Th>
                <Th>Stock</Th>
                <Th>Pack</Th>
                <Th>Live</Th>
                <Th>Actions</Th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className="border-t border-slate-200">
                  <Td>
                    <VariantIdentity row={row} />
                  </Td>

                  <Td>
                    <Input
                      value={row.sku ?? ""}
                      onChange={(event) => updateRow(row.id, { sku: event.target.value })}
                      className="h-9 w-40"
                    />
                  </Td>

                  {QUICK_FIELDS.map((field) => (
                    <Td key={field.key}>
                      <div className="flex items-center gap-1">
                        <NumberInput
                          value={row[field.key] as number | null}
                          onChange={(value) =>
                            updateRow(row.id, { [field.key]: value } as Partial<Variant>)
                          }
                        />
                        {index < rows.length - 1 && (
                          <button
                            type="button"
                            title={`Copy ${field.label} to the rows below`}
                            aria-label={`Copy ${field.label} to the rows below`}
                            onClick={() => copyDown(field.key, index)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </Td>
                  ))}

                  <Td>
                    <Switch
                      checked={Boolean(row.is_active)}
                      onCheckedChange={(checked) => updateRow(row.id, { is_active: checked })}
                    />
                  </Td>

                  <Td>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => editRow(row)}
                        title="Advanced details"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      {manageImages && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => manageImages(row.sku)}
                          title="Images for this SKU"
                        >
                          <ImageIcon className="h-4 w-4" />
                        </Button>
                      )}

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeRow(row)}
                        title="Remove this variation"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OptionsTab({
  axes,
  rows,
  updateRow,
  removeRow,
  editRow,
  duplicateRow,
  manageImages,
  optionsEditor,
}: {
  axes: Axis[];
  rows: Variant[];
  updateRow: (id: string, patch: Partial<Variant>) => void;
  removeRow: (row: Variant) => void;
  editRow: (row: Variant) => void;
  duplicateRow: (row: Variant) => void;
  manageImages?: (sku: string) => void;
  optionsEditor: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      {optionsEditor}
      <h3 className="text-lg font-semibold">All Variants · {rows.length}</h3>
      <VariantBulkEditor rows={rows} updateRow={updateRow} />
      {rows.length === 0 ? (
        <EmptyVariants />
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <VariantFullCard
              key={row.id}
              row={row}
              number={index + 1}
              axes={axes}
              updateRow={updateRow}
              removeRow={removeRow}
              editRow={editRow}
              duplicateRow={duplicateRow}
              manageImages={manageImages}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VariantBulkEditor({
  rows,
  updateRow,
}: {
  rows: Variant[];
  updateRow: (id: string, patch: Partial<Variant>) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [field, setField] = useState("price");
  const [value, setValue] = useState("");
  const fields = {
    price: "Customer price",
    mrp: "MRP",
    retailer_price: "Retailer price",
    distributor_price: "Distributor price",
    weight_g: "Weight (g)",
    dim_l: "Length (cm)",
    dim_w: "Width (cm)",
    dim_h: "Height (cm)",
    pack_weight_g: "Package weight (g)",
    pack_l: "Package length (cm)",
    pack_w: "Package width (cm)",
    pack_h: "Package height (cm)",
    pack_size: "Pack size",
    low_stock_threshold: "Low-stock threshold",
    is_active: "Active status",
  };
  const targets = rows.filter((row) => selected.includes(row.id));
  const apply = () => {
    const parsed = Number(value);
    if (
      value === "" ||
      !Number.isFinite(parsed) ||
      parsed < 0 ||
      (field === "pack_size" && (!Number.isInteger(parsed) || parsed < 1)) ||
      (field === "low_stock_threshold" && !Number.isInteger(parsed))
    ) {
      toast.error("Enter a valid non-negative value (pack size must be a positive integer)");
      return;
    }
    if (
      !confirm(
        `Stage ${fields[field as keyof typeof fields]} for ${targets.length} selected variants? Save Variants applies these changes.`,
      )
    )
      return;
    targets.forEach((row) =>
      updateRow(row.id, { [field]: field === "is_active" ? parsed === 1 : parsed }),
    );
    toast.success(`Updated ${targets.length} draft rows. Review and save variants.`);
  };
  return (
    <details className="rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer font-semibold">Bulk edit selected variants</summary>
      <p className="my-3 text-sm text-slate-500">
        Changes are staged for selected SKUs only. Stock quantities use the dedicated inventory
        workflow.
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={() => setSelected(targets.length === rows.length ? [] : rows.map((row) => row.id))}
      >
        Select / clear all
      </Button>
      <div className="my-3 grid max-h-48 gap-2 overflow-auto sm:grid-cols-2">
        {rows.map((row) => (
          <label key={row.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(row.id)}
              onChange={(event) =>
                setSelected((current) =>
                  event.target.checked
                    ? [...current, row.id]
                    : current.filter((id) => id !== row.id),
                )
              }
            />
            {row.sku} · {variantName(row)}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          Field
          <select
            className="block h-10 rounded-md border px-3"
            value={field}
            onChange={(event) => {
              setField(event.target.value);
              setValue("");
            }}
          >
            {Object.entries(fields).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          Value
          {field === "is_active" ? (
            <select
              className="block h-10 rounded-md border px-3"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            >
              <option value="">Choose status</option>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          ) : (
            <Input
              type="number"
              min="0"
              step="any"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          )}
        </label>
        <Button type="button" disabled={!targets.length || value === ""} onClick={apply}>
          Apply to {targets.length} selected
        </Button>
      </div>
    </details>
  );
}

function VariantFullCard({
  row,
  number,
  axes,
  updateRow,
  removeRow,
  editRow,
  duplicateRow,
  manageImages,
}: {
  row: Variant;
  number: number;
  axes: Axis[];
  updateRow: (id: string, patch: Partial<Variant>) => void;
  removeRow: (row: Variant) => void;
  editRow: (row: Variant) => void;
  duplicateRow: (row: Variant) => void;
  manageImages?: (sku: string) => void;
}) {
  const field = (key: keyof Variant, label: string, placeholder?: string) => (
    <label>
      <FieldTitle>{label}</FieldTitle>
      <NumberInput
        value={row[key] as number | null}
        placeholder={placeholder}
        onChange={(value) => updateRow(row.id, { [key]: value })}
      />
    </label>
  );

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-sky-700">
            Variation {number}
          </div>
          <div className="mt-0.5 font-semibold text-slate-950">{variantName(row)}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Switch
              checked={row.is_active !== false}
              onCheckedChange={(value) => updateRow(row.id, { is_active: value })}
            />
            Available
          </label>
          <Button type="button" size="sm" onClick={() => editRow(row)}>
            <Pencil className="h-4 w-4" /> Edit Variant
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => duplicateRow(row)}>
            <Copy className="h-4 w-4" /> Duplicate Variation
          </Button>
          {manageImages && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={row.id.startsWith("new-")}
              title={
                row.id.startsWith("new-")
                  ? "Save this SKU before attaching images"
                  : "Manage SKU images"
              }
              onClick={() => manageImages(row.sku)}
            >
              <ImageIcon className="h-4 w-4" /> Images
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant="destructive"
            aria-label={`Remove ${row.sku}`}
            onClick={() => removeRow(row)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="space-y-5 p-4">
        <VariantSection title="Name, options and SKU">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {axes.map((axis) => (
              <label key={axis.axis_key}>
                <FieldTitle>{axis.label}</FieldTitle>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={row.attributes?.[axis.axis_key] ?? ""}
                  onChange={(event) =>
                    updateRow(row.id, {
                      attributes: { ...row.attributes, [axis.axis_key]: event.target.value },
                    })
                  }
                >
                  <option value="">— Select —</option>
                  {axis.values.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label>
              <FieldTitle>SKU / Item Code</FieldTitle>
              <Input
                className="mt-1 font-mono"
                value={row.sku}
                readOnly={!row.id.startsWith("new-")}
                title={
                  row.id.startsWith("new-")
                    ? "Choose a unique SKU before saving"
                    : "Saved SKU codes are fixed to preserve order and image references"
                }
                onChange={(event) => updateRow(row.id, { sku: event.target.value })}
              />
            </label>
            <label>
              <FieldTitle>Barcode / GTIN</FieldTitle>
              <Input
                className="mt-1 font-mono"
                value={row.barcode ?? ""}
                placeholder="Optional barcode"
                onChange={(event) => updateRow(row.id, { barcode: event.target.value })}
              />
            </label>
          </div>
        </VariantSection>

        <VariantSection title="Prices">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {field("mrp", "MRP ₹")}
            {field("price", "Customer Price ₹")}
            {field("retailer_price", "Retailer Price ₹", "Fallback")}
            {field("distributor_price", "Distributor Price ₹", "Fallback")}
          </div>
        </VariantSection>

        <VariantSection title="Order quantities and inventory">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {field("moq", "Customer MOQ")}
            {field("retailer_moq", "Retailer MOQ")}
            {field("distributor_moq", "Distributor MOQ")}
            {field("pack_size", "Pieces / Pack")}
            {field("stock", "Stock")}
            {field("low_stock_threshold", "Low-stock Alert")}
          </div>
        </VariantSection>

        <div className="grid gap-4 xl:grid-cols-2">
          <VariantSection title="Single unit dimensions">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {field("weight_g", "Weight (g)")}
              {field("dim_l", "Length (cm)")}
              {field("dim_w", "Width (cm)")}
              {field("dim_h", "Height (cm)")}
            </div>
          </VariantSection>
          <VariantSection title="Package dimensions">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {field("pack_weight_g", "Weight (g)")}
              {field("pack_l", "Length (cm)")}
              {field("pack_w", "Width (cm)")}
              {field("pack_h", "Height (cm)")}
            </div>
          </VariantSection>
        </div>
      </div>
    </article>
  );
}

function VariantSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h4>
      {children}
    </section>
  );
}

function VariantEditDialog({
  row,
  rows,
  axes,
  open,
  saving,
  step,
  setStep,
  onOpenChange,
  updateRow,
  save,
  optionsEditor,
  photos,
  setPhotos,
  registerPreview,
  productSku,
  productId,
  duplicateRow,
}: {
  row: Variant | null;
  rows: Variant[];
  axes: Axis[];
  open: boolean;
  saving: boolean;
  step: number;
  setStep: (step: number) => void;
  onOpenChange: (open: boolean) => void;
  updateRow: (id: string, patch: Partial<Variant>) => void;
  save: () => Promise<void>;
  optionsEditor: React.ReactNode;
  photos: VariationPhotoDraft[];
  setPhotos: (photos: VariationPhotoDraft[]) => void;
  registerPreview: (file: File) => string;
  productSku: string;
  productId: string;
  duplicateRow: (row: Variant) => void;
  manageImages?: (sku: string) => void;
}) {
  if (!row) return null;
  const isNew = row.id.startsWith("new-");
  const issues = variationIssues(row, rows, axes);
  const numberField = (key: keyof Variant, label: string, min = 0) => (
    <label className="block space-y-1 text-sm font-medium text-slate-700">
      {label}
      <Input
        type="number"
        min={min}
        step={
          [
            "stock",
            "low_stock_threshold",
            "sort_order",
            "moq",
            "retailer_moq",
            "distributor_moq",
            "pack_size",
          ].includes(key)
            ? "1"
            : "any"
        }
        value={(row[key] as number | null) ?? ""}
        onChange={(event) => updateRow(row.id, { [key]: toNumber(event.target.value) })}
      />
    </label>
  );
  const addPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    try {
      if (photos.length + files.length > 12) throw new Error("Choose at most 12 images at a time.");
      const selected = Array.from(files);
      selected.forEach(validateVariationPhoto);
      setPhotos([
        ...photos,
        ...selected.map((file, index) => ({
          id: crypto.randomUUID(),
          file,
          previewUrl: registerPreview(file),
          altText: "",
          primary: !photos.length && index === 0,
        })),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not select images.");
    }
  };
  const next = () => {
    if (step === 1) {
      try {
        prepareVariationAxes(axes, [], rows);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Complete your options.");
        return;
      }
    }
    if (
      step === 2 &&
      (!row.sku.trim() ||
        rows.some(
          (other) =>
            other.id !== row.id && other.sku.trim().toUpperCase() === row.sku.trim().toUpperCase(),
        ))
    ) {
      toast.error("Choose a unique SKU before continuing.");
      return;
    }
    setStep(Math.min(VARIATION_STEPS.length - 1, step + 1));
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!saving) onOpenChange(value);
      }}
    >
      <DialogContent
        className="flex max-h-[94dvh] w-[calc(100vw-1rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0"
        aria-describedby="variation-step-description"
      >
        <DialogHeader className="shrink-0 border-b border-slate-200 px-5 py-4 pr-14">
          <DialogTitle>
            {isNew ? "Add variation" : "Edit variation"} · {row.sku || "New SKU"}
          </DialogTitle>
          <p id="variation-step-description" className="text-sm text-slate-500">
            Step {step + 1} of {VARIATION_STEPS.length} · {VARIATION_STEPS[step]}.{" "}
            {row.is_active
              ? "Available for sale after saving."
              : "Inactive until you choose to activate it."}
          </p>
        </DialogHeader>
        <nav
          aria-label="Variation setup steps"
          className="shrink-0 border-b border-slate-200 bg-slate-50 p-3"
        >
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {VARIATION_STEPS.map((label, index) => (
              <li key={label}>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setStep(index)}
                  aria-current={step === index ? "step" : undefined}
                  className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-sky-600 ${step === index ? "bg-sky-700 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-current text-xs">
                    {index + 1}
                  </span>
                  {label}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <fieldset disabled={saving} className="min-w-0 space-y-4">
            <section hidden={step !== 0} className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Add this variation’s images</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Choose images now; they attach to this SKU after the variation is saved. You can
                  skip this step and add them later.
                </p>
              </div>
              <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center focus-within:ring-2 focus-within:ring-sky-600">
                <Upload className="h-6 w-6 text-sky-700" />
                <span className="font-semibold">Choose images</span>
                <span className="text-sm text-slate-500">
                  JPG, PNG, WebP, GIF or AVIF · up to 8 MB each · 12 images per batch
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  multiple
                  className="max-w-full text-sm"
                  aria-label="Choose images for this variation"
                  onChange={(event) => {
                    addPhotos(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
              {photos.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {photos.map((photo) => (
                    <article
                      key={photo.id}
                      className="space-y-3 rounded-xl border border-slate-200 p-3"
                    >
                      <img
                        src={photo.previewUrl}
                        alt={photo.altText || "Selected variation image"}
                        className="aspect-square max-h-48 w-full rounded-lg bg-slate-50 object-contain"
                      />
                      <label className="block space-y-1 text-sm">
                        Image description
                        <Input
                          value={photo.altText}
                          disabled={photo.attached}
                          placeholder="Describe this image"
                          onChange={(event) =>
                            setPhotos(
                              photos.map((item) =>
                                item.id === photo.id
                                  ? { ...item, altText: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={photo.primary ? "default" : "outline"}
                          onClick={() =>
                            setPhotos(
                              photos.map((item) => ({
                                ...item,
                                primary: item.id === photo.id,
                                primaryApplied: false,
                              })),
                            )
                          }
                        >
                          <Star className="h-4 w-4" />{" "}
                          {photo.primary ? "Primary image" : "Set primary"}
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          disabled={photo.attached}
                          aria-label="Remove selected image"
                          title={
                            photo.attached
                              ? "This image is saved. Remove it in Saved images below."
                              : "Remove from this draft"
                          }
                          onClick={() => {
                            const rest = photos.filter((item) => item.id !== photo.id);
                            if (photo.primary && rest.length)
                              rest[0] = { ...rest[0], primary: true, primaryApplied: false };
                            setPhotos(rest);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500">
                        {photo.attached
                          ? "Association saved; retry completes any remaining primary-image step."
                          : photo.file
                            ? "Selected locally — not uploaded yet"
                            : "Copied image — a separate association will be saved for this SKU"}
                      </p>
                    </article>
                  ))}
                </div>
              )}
              {!isNew && (
                <ProductImageManager
                  productSku={productSku}
                  productId={productId}
                  initialVariantSku={row.sku}
                  variantOnly
                />
              )}
            </section>
            <section hidden={step !== 1} className="space-y-4">
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
                These options are shared by every variation in this product. Define them once here,
                then choose this SKU’s values in Step 3.
              </div>
              {optionsEditor}
            </section>
            <section hidden={step !== 2} className="space-y-4">
              <h3 className="text-lg font-semibold">Name, SKU and option values</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm font-medium">
                  SKU / item code
                  <Input
                    value={row.sku}
                    readOnly={!isNew}
                    maxLength={120}
                    onChange={(event) => updateRow(row.id, { sku: event.target.value })}
                    className="font-mono"
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Barcode / GTIN (optional)
                  <Input
                    value={row.barcode ?? ""}
                    onChange={(event) => updateRow(row.id, { barcode: event.target.value })}
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Variation name (optional)
                  <Input
                    value={row.attributes.variant_label ?? ""}
                    placeholder="Uses the selected values when left blank"
                    onChange={(event) =>
                      updateRow(row.id, {
                        attributes: { ...row.attributes, variant_label: event.target.value },
                      })
                    }
                  />
                </label>
                {numberField("sort_order", "Display order")}
              </div>
              {!isNew && (
                <p className="text-sm text-slate-500">
                  Saved SKU codes stay fixed to preserve orders and images. You can change the
                  variation name and option values.
                </p>
              )}
              {!axes.length && (
                <p className="text-sm text-slate-500">
                  No shared options yet. Go to Product options to add Wattage, Size, Colour or
                  another attribute.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {axes.map((axis) => (
                  <label key={axis.id} className="space-y-1 text-sm font-medium">
                    {axis.label}
                    <select
                      className="block h-11 w-full rounded-lg border border-slate-200 bg-white px-3"
                      value={row.attributes[axis.axis_key] ?? ""}
                      onChange={(event) =>
                        updateRow(row.id, {
                          attributes: { ...row.attributes, [axis.axis_key]: event.target.value },
                        })
                      }
                    >
                      <option value="">Select a value</option>
                      {[...new Set(axis.values.map((value) => value.trim()).filter(Boolean))].map(
                        (value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                ))}
              </div>
              <VariantSpecifications row={row} axes={axes} updateRow={updateRow} />
            </section>
            <section hidden={step !== 3} className="space-y-4">
              <h3 className="text-lg font-semibold">Prices and minimum order quantities</h3>
              <p className="text-sm text-slate-500">
                Set customer, retailer and distributor prices for this SKU. Blank partner prices
                keep the existing pricing fallback.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {numberField("mrp", "MRP ₹")}
                {numberField("price", "Customer price ₹")}
                {numberField("retailer_price", "Retailer price ₹")}
                {numberField("distributor_price", "Distributor price ₹")}
                {numberField("moq", "Customer MOQ", 1)}
                {numberField("retailer_moq", "Retailer MOQ", 1)}
                {numberField("distributor_moq", "Distributor MOQ", 1)}
                {numberField("pack_size", "Pieces per pack", 1)}
              </div>
            </section>
            <section hidden={step !== 4} className="space-y-5">
              <h3 className="text-lg font-semibold">Stock, weight and dimensions</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {numberField("stock", "Stock quantity")}
                {numberField("low_stock_threshold", "Low-stock alert threshold")}
              </div>
              <VariantSection title="Single unit">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {numberField("weight_g", "Weight (g)")}
                  {numberField("dim_l", "Length (cm)")}
                  {numberField("dim_w", "Width (cm)")}
                  {numberField("dim_h", "Height (cm)")}
                </div>
              </VariantSection>
              <VariantSection title="Shipping package">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {numberField("pack_weight_g", "Weight (g)")}
                  {numberField("pack_l", "Length (cm)")}
                  {numberField("pack_w", "Width (cm)")}
                  {numberField("pack_h", "Height (cm)")}
                </div>
              </VariantSection>
              <p className="text-sm text-slate-500">
                New and duplicated variations start with zero stock. Enter the real quantity; stock
                changes use the existing inventory safeguards.
              </p>
            </section>
            <section hidden={step !== 5} className="space-y-4">
              <h3 className="text-lg font-semibold">Review this variation</h3>
              <dl className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                {[
                  ["Variation", variantName(row)],
                  ["SKU", row.sku],
                  ["Customer price", row.price === null ? "Not set" : money(row.price)],
                  [
                    "Retailer price",
                    row.retailer_price === null ? "Existing fallback" : money(row.retailer_price),
                  ],
                  [
                    "Distributor price",
                    row.distributor_price === null
                      ? "Existing fallback"
                      : money(row.distributor_price),
                  ],
                  ["Stock", String(row.stock ?? 0)],
                  ["Selected images", String(photos.length)],
                  [
                    "Options",
                    axes
                      .map(
                        (axis) =>
                          `${axis.label}: ${row.attributes[axis.axis_key] || "Not selected"}`,
                      )
                      .join(" · ") || "No options",
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-sm text-slate-500">{label}</dt>
                    <dd className="mt-1 break-words text-sm font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 text-sm font-medium">
                <Switch
                  checked={row.is_active}
                  onCheckedChange={(value) => updateRow(row.id, { is_active: value })}
                />
                Available for sale after saving
              </label>
              {issues.length > 0 && (
                <div role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">Check these details</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-sm text-slate-500">
                Saving includes the shared options and all unsaved variations in this family. Image
                uploads follow the successful SKU save. If an image fails, the variation stays saved
                and you can retry the pending image.
              </p>
            </section>
          </fieldset>
        </div>
        <DialogFooter className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex sm:flex-wrap">
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Close · keep edits
          </Button>
          {!isNew && (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => duplicateRow(row)}
            >
              <Copy className="h-4 w-4" /> Duplicate variation
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={saving || step === 0}
            onClick={() => setStep(Math.max(0, step - 1))}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < VARIATION_STEPS.length - 1 ? (
            <Button type="button" disabled={saving} onClick={next}>
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" disabled={saving || issues.length > 0} onClick={save}>
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save all variant changes"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VariantSpecifications({
  row,
  axes,
  updateRow,
}: {
  row: Variant;
  axes: Axis[];
  updateRow: (id: string, patch: Partial<Variant>) => void;
}) {
  const [key, setKey] = useState("");
  const extra = Object.entries(row.attributes).filter(
    ([name]) => name !== "variant_label" && !axes.some((axis) => axis.axis_key === name),
  );
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold">SKU-specific specifications</h3>
      <p className="text-sm text-slate-500">
        Add only verified details for this SKU. These do not generate combinations. Common
        specifications belong to the family.
      </p>
      {extra.map(([name, value]) => (
        <label key={name} className="block text-sm">
          {name}
          <Input
            value={value}
            onChange={(event) =>
              updateRow(row.id, { attributes: { ...row.attributes, [name]: event.target.value } })
            }
          />
        </label>
      ))}
      <div className="flex gap-2">
        <Input
          aria-label="New specification name"
          placeholder="Specification name"
          value={key}
          onChange={(event) => setKey(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const name = key.trim();
            if (
              !name ||
              name === "variant_label" ||
              Object.hasOwn(row.attributes, name) ||
              axes.some((axis) => axis.axis_key === name)
            )
              return toast.error("Enter a new specification name");
            updateRow(row.id, { attributes: { ...row.attributes, [name]: "" } });
            setKey("");
          }}
        >
          Add specification
        </Button>
      </div>
    </section>
  );
}

function CustomerTab({
  rows,
  updateRow,
}: {
  rows: Variant[];
  updateRow: (id: string, patch: Partial<Variant>) => void;
}) {
  if (!rows.length) return <EmptyVariants />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1150px] w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <Th>Variant</Th>
            <Th>MRP / Unit</Th>
            <Th>Discount %</Th>
            <Th>Discount ₹</Th>
            <Th>Price / Unit</Th>
            <Th>MOQ</Th>
            <Th>PCs / Pack</Th>
            <Th>Pack Total</Th>
            <Th>Stock</Th>
            <Th>Low-stock alert</Th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const discount = discountPercent(row.mrp, row.price);

            const amount = discountAmount(row.mrp, row.price);

            const packTotal = Number(row.price ?? 0) * Number(row.pack_size ?? 1);

            return (
              <tr key={row.id} className="border-t border-slate-200">
                <Td>
                  <VariantIdentity row={row} />
                </Td>

                <Td>
                  <NumberInput
                    value={row.mrp}
                    onChange={(value) => updateRow(row.id, { mrp: value })}
                  />
                </Td>

                <Td>
                  <Calculated>{discount.toFixed(2)}%</Calculated>
                </Td>

                <Td>
                  <Calculated>{money(amount)}</Calculated>
                </Td>

                <Td>
                  <NumberInput
                    value={row.price}
                    onChange={(value) =>
                      updateRow(row.id, {
                        price: value,
                      })
                    }
                  />
                </Td>

                <Td>
                  <NumberInput
                    value={row.moq}
                    onChange={(value) => updateRow(row.id, { moq: value })}
                  />
                </Td>

                <Td>
                  <NumberInput
                    value={row.pack_size}
                    onChange={(value) =>
                      updateRow(row.id, {
                        pack_size: value,
                      })
                    }
                  />
                </Td>

                <Td>
                  <Calculated>{money(packTotal)}</Calculated>
                </Td>

                <Td>
                  <NumberInput
                    value={row.stock}
                    onChange={(value) =>
                      updateRow(row.id, {
                        stock: value,
                      })
                    }
                  />
                </Td>

                <Td>
                  <NumberInput
                    value={row.low_stock_threshold}
                    onChange={(value) =>
                      updateRow(row.id, { low_stock_threshold: Math.max(0, Number(value ?? 0)) })
                    }
                  />
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-3 text-xs text-slate-500">
        Discount percentage, discount amount and pack total are calculated automatically.
      </p>
    </div>
  );
}

function RetailerTab({
  rows,
  updateRow,
}: {
  rows: Variant[];
  updateRow: (id: string, patch: Partial<Variant>) => void;
}) {
  if (!rows.length) return <EmptyVariants />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[900px] w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <Th>Variant</Th>
            <Th>Customer MRP</Th>
            <Th>Retailer Price</Th>
            <Th>Saving ₹</Th>
            <Th>Saving %</Th>
            <Th>Retailer MOQ</Th>
            <Th>PCs / Pack</Th>
            <Th>Pack Total</Th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const amount = discountAmount(row.mrp, row.retailer_price);

            const percent = discountPercent(row.mrp, row.retailer_price);

            const packTotal =
              Number(row.retailer_price ?? row.price ?? 0) * Number(row.pack_size ?? 1);

            return (
              <tr key={row.id} className="border-t border-slate-200">
                <Td>
                  <VariantIdentity row={row} />
                </Td>

                <Td>
                  <Calculated>{money(Number(row.mrp ?? 0))}</Calculated>
                </Td>

                <Td>
                  <NumberInput
                    value={row.retailer_price}
                    placeholder="Fallback"
                    onChange={(value) =>
                      updateRow(row.id, {
                        retailer_price: value,
                      })
                    }
                  />
                </Td>

                <Td>
                  <Calculated>{money(amount)}</Calculated>
                </Td>

                <Td>
                  <Calculated>{percent.toFixed(2)}%</Calculated>
                </Td>

                <Td>
                  <NumberInput
                    value={row.retailer_moq}
                    onChange={(value) =>
                      updateRow(row.id, {
                        retailer_moq: value,
                      })
                    }
                  />
                </Td>

                <Td>
                  <Calculated>{row.pack_size ?? "—"}</Calculated>
                </Td>

                <Td>
                  <Calculated>{money(packTotal)}</Calculated>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
        The current database has retailer price and retailer MOQ, but does not have a separate
        retailer MRP or retailer stock column. This tab therefore safely uses the existing product
        MRP and shared stock until those columns are intentionally added.
      </div>
    </div>
  );
}

function DistributorTab({
  rows,
  updateRow,
}: {
  rows: Variant[];
  updateRow: (id: string, patch: Partial<Variant>) => void;
}) {
  if (!rows.length) return <EmptyVariants />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[900px] w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <Th>Variant</Th>
            <Th>Customer MRP</Th>
            <Th>Distributor Price</Th>
            <Th>Saving ₹</Th>
            <Th>Saving %</Th>
            <Th>Distributor MOQ</Th>
            <Th>PCs / Pack</Th>
            <Th>Pack Total</Th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const amount = discountAmount(row.mrp, row.distributor_price);

            const percent = discountPercent(row.mrp, row.distributor_price);

            const packTotal =
              Number(row.distributor_price ?? row.retailer_price ?? row.price ?? 0) *
              Number(row.pack_size ?? 1);

            return (
              <tr key={row.id} className="border-t border-slate-200">
                <Td>
                  <VariantIdentity row={row} />
                </Td>

                <Td>
                  <Calculated>{money(Number(row.mrp ?? 0))}</Calculated>
                </Td>

                <Td>
                  <NumberInput
                    value={row.distributor_price}
                    placeholder="Fallback"
                    onChange={(value) =>
                      updateRow(row.id, {
                        distributor_price: value,
                      })
                    }
                  />
                </Td>

                <Td>
                  <Calculated>{money(amount)}</Calculated>
                </Td>

                <Td>
                  <Calculated>{percent.toFixed(2)}%</Calculated>
                </Td>

                <Td>
                  <NumberInput
                    value={row.distributor_moq}
                    onChange={(value) =>
                      updateRow(row.id, {
                        distributor_moq: value,
                      })
                    }
                  />
                </Td>

                <Td>
                  <Calculated>{row.pack_size ?? "—"}</Calculated>
                </Td>

                <Td>
                  <Calculated>{money(packTotal)}</Calculated>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
        The current database has distributor price and distributor MOQ, but does not have separate
        distributor MRP or distributor stock columns. Shared MRP/stock are kept for now so existing
        data remains safe.
      </div>
    </div>
  );
}

function ShippingTab({
  rows,
  updateRow,
}: {
  rows: Variant[];
  updateRow: (id: string, patch: Partial<Variant>) => void;
}) {
  if (!rows.length) return <EmptyVariants />;

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.id} className="rounded-xl border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <VariantIdentity row={row} />
          </div>

          <div className="grid gap-6 p-4 lg:grid-cols-2">
            <div>
              <h4 className="mb-3 text-sm font-semibold">Single Unit / Piece</h4>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <DimensionField
                  label="Weight (g)"
                  value={row.weight_g}
                  onChange={(value) =>
                    updateRow(row.id, {
                      weight_g: value,
                    })
                  }
                />

                <DimensionField
                  label="Length (cm)"
                  value={row.dim_l}
                  onChange={(value) =>
                    updateRow(row.id, {
                      dim_l: value,
                    })
                  }
                />

                <DimensionField
                  label="Width (cm)"
                  value={row.dim_w}
                  onChange={(value) =>
                    updateRow(row.id, {
                      dim_w: value,
                    })
                  }
                />

                <DimensionField
                  label="Height (cm)"
                  value={row.dim_h}
                  onChange={(value) =>
                    updateRow(row.id, {
                      dim_h: value,
                    })
                  }
                />
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold">Package</h4>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <DimensionField
                  label="Weight (g)"
                  value={row.pack_weight_g}
                  onChange={(value) =>
                    updateRow(row.id, {
                      pack_weight_g: value,
                    })
                  }
                />

                <DimensionField
                  label="Length (cm)"
                  value={row.pack_l}
                  onChange={(value) =>
                    updateRow(row.id, {
                      pack_l: value,
                    })
                  }
                />

                <DimensionField
                  label="Width (cm)"
                  value={row.pack_w}
                  onChange={(value) =>
                    updateRow(row.id, {
                      pack_w: value,
                    })
                  }
                />

                <DimensionField
                  label="Height (cm)"
                  value={row.pack_h}
                  onChange={(value) =>
                    updateRow(row.id, {
                      pack_h: value,
                    })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      ))}

      <p className="text-xs text-slate-500">
        These values use the existing per-variant unit and package shipping columns.
      </p>
    </div>
  );
}

function AxisEditor({
  rows,
  variants,
  setRows,
  saving,
  saveAxes,
  excluded,
  setExcluded,
  draftOnly,
}: {
  rows: Axis[];
  variants: Variant[];
  setRows: (rows: Axis[]) => void;
  saving: boolean;
  saveAxes: (generate: boolean) => Promise<void>;
  excluded: Record<string, string[]>;
  setExcluded: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  draftOnly: boolean;
}) {
  const updateAxis = (id: string, patch: Partial<Axis>) =>
    setRows(rows.map((axis) => (axis.id === id ? { ...axis, ...patch } : axis)));
  const addAxis = (preset?: { key: string; label: string; values?: string[] }) => {
    let sequence = rows.length + 1;
    while (rows.some((axis) => axis.axis_key === `option_${sequence}`)) sequence++;
    const key = preset?.key ?? `option_${sequence}`;
    if (rows.some((axis) => axis.axis_key === key)) return;
    setRows([
      ...rows,
      {
        id: `new-${crypto.randomUUID()}`,
        axis_key: key,
        label: preset?.label ?? "New Option",
        values: preset?.values ?? [],
        sort_order: rows.length,
      },
    ]);
  };
  const removeAxis = (axis: Axis) => {
    if (variants.some((row) => row.attributes[axis.axis_key]))
      return toast.error(
        "This option is used by existing SKUs. Remap their values before removing it.",
      );
    if (confirm(`Remove option "${axis.label}" from this family?`))
      setRows(rows.filter((row) => row.id !== axis.id));
  };
  const activeAxes = rows.map((axis) => ({
    ...axis,
    values: axis.values
      .map((value) => value.trim())
      .filter((value) => Boolean(value) && !(excluded[axis.id] ?? []).includes(value)),
  }));
  let summary: { total: number; missing: number; existing: number } | null = null;
  try {
    summary = combinationSummary(activeAxes, variants);
  } catch {
    summary = null;
  }
  const generate = () => {
    if (summary && summary.missing === 0) {
      toast.info("Every combination from these values already exists.");
      return;
    }
    if (
      summary &&
      !confirm(
        `Generate ${summary.missing} new variation${summary.missing === 1 ? "" : "s"}?\n\n` +
          `${summary.existing} existing SKU${summary.existing === 1 ? "" : "s"} will be kept exactly as they are. Nothing is deleted.`,
      )
    )
      return;
    void saveAxes(true);
  };
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Variations / Options</div>

          <div className="mt-1 text-xs text-slate-500">
            Add the options this product actually needs (for example Wattage and Output Colour),
            paste their values, then generate the variations.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => addAxis()}>
            <Plus className="mr-1 h-4 w-4" />
            Add Option
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => saveAxes(false)}
            disabled={saving}
          >
            <Save className="mr-1 h-4 w-4" />
            {saving ? "Saving…" : "Save Options"}
          </Button>
          <Button type="button" size="sm" onClick={generate} disabled={saving || rows.length === 0}>
            <Plus className="h-4 w-4" />
            {saving ? "Saving…" : "GENERATE VARIATIONS"}
          </Button>
        </div>
      </div>

      {
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-800">
            Choose the variation types for this product:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { key: "wattage", label: "Wattage" },
              { key: "output_colour", label: "Output Colour" },
              { key: "body_colour", label: "Body / Housing Colour" },
              { key: "model", label: "Model" },
              { key: "size", label: "Size" },
              { key: "pack_size", label: "Pack Size" },
            ].map((preset) => (
              <Button
                key={preset.key}
                type="button"
                size="sm"
                variant="outline"
                disabled={rows.some((axis) => axis.axis_key === preset.key)}
                onClick={() => addAxis(preset)}
              >
                <Plus className="h-4 w-4" /> {preset.label}
              </Button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Only add the options this product needs. Values can be pasted from a list — commas, new
            lines or tabs all work.
          </p>
          {summary && (
            <p className="mt-2 text-sm text-slate-700">
              {summary.total} combination{summary.total === 1 ? "" : "s"} from these values ·{" "}
              <strong>{summary.missing} new</strong> · {summary.existing} already created.
            </p>
          )}
          <p className="mt-2 text-sm text-slate-600">
            {draftOnly
              ? "These buttons prepare your draft. Nothing is written until Review & save."
              : "Generate adds only the missing combinations, as inactive drafts. Existing SKUs, prices and stock are never changed or deleted."}
          </p>
        </div>
      }
      {rows.length > 0 && (
        <div className="mt-4 space-y-3">
          {rows.map((axis) => (
            <div
              key={axis.id}
              className="grid items-start gap-3 rounded-lg bg-slate-50 p-3 lg:grid-cols-[200px_1fr_auto]"
            >
              <label>
                <FieldTitle>Option Name</FieldTitle>

                <Input
                  className="mt-1"
                  value={axis.label}
                  placeholder="Wattage"
                  onChange={(e) =>
                    updateAxis(axis.id, {
                      label: e.target.value,
                      ...(axis.id.startsWith("new-")
                        ? {
                            axis_key:
                              e.target.value
                                .trim()
                                .toLowerCase()
                                .replace(/[^a-z0-9_]+/g, "_") || axis.axis_key,
                          }
                        : {}),
                    })
                  }
                />
                <span className="mt-1 block font-mono text-[11px] text-slate-400">
                  {axis.axis_key}
                </span>
              </label>

              <label>
                <FieldTitle>Values — paste or type (comma or one per line)</FieldTitle>

                <Textarea
                  className="mt-1 min-h-[76px]"
                  value={axis.values.join(", ")}
                  placeholder={"5W, 7W, 9W, 12W"}
                  onChange={(e) =>
                    updateAxis(axis.id, {
                      values: parsePastedValues(e.target.value),
                    })
                  }
                />
              </label>

              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={`Remove ${axis.label}`}
                onClick={() => removeAxis(axis)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              {axis.values.filter(Boolean).length > 0 && (
                <div className="flex flex-wrap gap-3 lg:col-span-3">
                  <span className="text-sm text-slate-500">Include in generation:</span>
                  {[...new Set(axis.values.map((value) => value.trim()).filter(Boolean))].map(
                    (value) => (
                      <label key={value} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!(excluded[axis.id] ?? []).includes(value)}
                          onChange={(event) =>
                            setExcluded((current) => ({
                              ...current,
                              [axis.id]: event.target.checked
                                ? (current[axis.id] ?? []).filter((item) => item !== value)
                                : [...(current[axis.id] ?? []), value],
                            }))
                          }
                        />
                        {value}
                      </label>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function VariantIdentity({ row }: { row: Variant }) {
  return (
    <div className="min-w-[170px]">
      <div className="font-medium text-slate-900">{variantName(row)}</div>

      <div className="mt-0.5 font-mono text-xs text-slate-500">{row.sku}</div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
}) {
  return (
    <Input
      type="number"
      step="any"
      className="min-w-[100px] text-right"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(toNumber(e.target.value))}
    />
  );
}

function DimensionField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label>
      <FieldTitle>{label}</FieldTitle>

      <Input
        type="number"
        step="any"
        className="mt-1"
        value={value ?? ""}
        onChange={(e) => onChange(toNumber(e.target.value))}
      />
    </label>
  );
}

function Calculated({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-[90px] rounded-md bg-slate-50 px-3 py-2 text-right text-sm text-slate-700">
      {children}
    </div>
  );
}

function FieldTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{children}</div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-3 font-semibold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="align-top px-3 py-3">{children}</td>;
}

function EmptyVariants() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
      No variants yet. Click <strong>Add Variant</strong> first.
    </div>
  );
}
