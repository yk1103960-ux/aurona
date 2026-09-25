import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Save,
  Plus,
  Archive,
  RotateCcw,
  Trash2,
  Users,
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
  adminSetProductVariantState,
  adminDeleteProductVariantPermanent,
} from "@/lib/catalog-admin.functions";
import { ProductImageManager } from "@/components/admin/ProductImageManager";
import { Textarea } from "@/components/ui/textarea";
import { combinationSummary, missingCombinations, parsePastedValues } from "@/lib/variant-options";

import {
  newVariation,
  prepareVariationAxes,
  variationIssues,
  VARIATION_STEPS,
  type Variant,
  type Axis,
} from "@/lib/variant-workflow";
import { persistVariationPhotos, validateVariationPhoto, type VariationPhotoDraft } from "@/lib/variant-photo-drafts";

type Tab = "quick" | "options" | "customer" | "shipping";
type PriceSegment = "customer" | "retailer" | "distributor";

type PackageDimensionKey =
  | "pack_weight_g"
  | "pack_l"
  | "pack_w"
  | "pack_h"
  | "retailer_pack_weight_g"
  | "retailer_pack_l"
  | "retailer_pack_w"
  | "retailer_pack_h"
  | "distributor_pack_weight_g"
  | "distributor_pack_l"
  | "distributor_pack_w"
  | "distributor_pack_h";

const PACKAGE_DIMENSION_FIELDS: Array<{
  key: PackageDimensionKey;
  label: string;
  shortLabel: string;
  placeholder: string;
}> = [
  { key: "pack_weight_g", label: "Customer Weight (In Gms)", shortLabel: "Customer Wt", placeholder: "C Wt" },
  { key: "pack_l", label: "Customer Length (In cms)", shortLabel: "Customer L", placeholder: "C L" },
  { key: "pack_w", label: "Customer Width (In cms)", shortLabel: "Customer W", placeholder: "C W" },
  { key: "pack_h", label: "Customer Height (In cms)", shortLabel: "Customer H", placeholder: "C H" },
  { key: "retailer_pack_weight_g", label: "Retailer Weight (In Gms)", shortLabel: "Retailer Wt", placeholder: "R Wt" },
  { key: "retailer_pack_l", label: "Retailer Length (In cms)", shortLabel: "Retailer L", placeholder: "R L" },
  { key: "retailer_pack_w", label: "Retailer Width (In cms)", shortLabel: "Retailer W", placeholder: "R W" },
  { key: "retailer_pack_h", label: "Retailer Height (In cms)", shortLabel: "Retailer H", placeholder: "R H" },
  { key: "distributor_pack_weight_g", label: "Distributor Weight (In Gms)", shortLabel: "Distributor Wt", placeholder: "D Wt" },
  { key: "distributor_pack_l", label: "Distributor Length (In cms)", shortLabel: "Distributor L", placeholder: "D L" },
  { key: "distributor_pack_w", label: "Distributor Width (In cms)", shortLabel: "Distributor W", placeholder: "D W" },
  { key: "distributor_pack_h", label: "Distributor Height (In cms)", shortLabel: "Distributor H", placeholder: "D H" },
];

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

/** "Choose Options" order of the product being edited; names follow it exactly. */
const axisOrder: { keys: string[] } = { keys: [] };

const variantName = (row: Variant) => {
  if (row.attributes?.variant_label) return row.attributes.variant_label;
  const attrs = row.attributes ?? {};
  const ordered = axisOrder.keys.filter((key) => attrs[key]).map((key) => attrs[key]);
  const rest = Object.entries(attrs)
    .filter(([key, value]) => key !== "variant_label" && !axisOrder.keys.includes(key) && value)
    .map(([, value]) => value);
  const values = [...ordered, ...rest];
  return values.length ? values.join(" / ") : row.sku;
};

const optionToken = (value: string) => {
  const pack = value.trim().match(/^pack\s*(?:of)?\s*(\d+)$/i);
  if (pack) return `P${pack[1]}`;
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
};

export function VariantEditor({
  productSku,
  productId,
  familyId,
  onManageImages,
  initialTab = "options",
  customerPricingOnly = false,
  displayOnly,
  priceSegment,
  buyerWorkflow,
}: {
  productSku: string;
  productId: string;
  familyId?: string | null;
  onManageImages?: (sku: string) => void;
  initialTab?: Tab;
  customerPricingOnly?: boolean;
  displayOnly?: Exclude<Tab, "options">;
  priceSegment?: PriceSegment;
  buyerWorkflow?: PriceSegment;
}) {
  const sharedBuyerWorkflow = buyerWorkflow === "retailer" || buyerWorkflow === "distributor";
  const [rows, setRows] = useState<Variant[]>([]);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>(
    sharedBuyerWorkflow
      ? "customer"
      : displayOnly ?? (initialTab === "options" || initialTab === "quick" ? "quick" : initialTab),
  );
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
          const saved = q.data.variants.find((row) => row.sku.trim().toUpperCase() === old.sku.trim().toUpperCase());
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
    setTab(
      buyerWorkflow === "retailer" || buyerWorkflow === "distributor"
        ? "customer"
        : displayOnly ?? (initialTab === "options" || initialTab === "quick" ? "quick" : initialTab),
    );
  }, [initialTab, displayOnly, buyerWorkflow]);

  const family = q.data?.family;
  const axes = axisRows;
  axisOrder.keys = axes.map((axis) => axis.axis_key);

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
          Save the main product first, then reopen Price & Stock for Customers. If it was already saved, apply the product-admin
          parity migration and retry.
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
        throw new Error("This variation has more than 12 images. Manage its images before duplicating it.");
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
        error instanceof Error ? error.message : "Could not prepare a complete copy. No variation was created.",
      );
    } finally {
      setCopying(false);
    }
  };

  const generateCombinations = (
    sourceAxes: Axis[] = axes,
    sourceRows: Variant[] = rows,
    selectedCombinations?: Record<string, string>[],
  ) => {
    try {
      const allMissing = missingCombinations(sourceAxes, sourceRows);
      const combinationKey = (attributes: Record<string, string>) =>
        sourceAxes.map((axis) => `${axis.axis_key}=${attributes[axis.axis_key] ?? ""}`).join("||");
      const selectedKeys = selectedCombinations ? new Set(selectedCombinations.map(combinationKey)) : null;
      const combinations = selectedKeys
        ? allMissing.filter((attributes) => selectedKeys.has(combinationKey(attributes)))
        : allMissing;
      if (!combinations.length) return toast.info("All selected combinations already exist");
      const usedSkus = new Set(sourceRows.map((row) => row.sku.trim().toUpperCase()));
      const template =
        sourceRows.find((row) => row.is_active) ??
        sourceRows.find((row) => !row.id.startsWith("new-")) ??
        sourceRows[0];
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
          mrp: template?.mrp ?? null,
          price: template?.price ?? null,
          discount_pct: template?.discount_pct ?? 0,
          retailer_price: template?.retailer_price ?? null,
          distributor_price: template?.distributor_price ?? null,
          retailer_mrp: template?.retailer_mrp ?? null,
          distributor_mrp: template?.distributor_mrp ?? null,
          moq: template?.moq ?? 1,
          retailer_moq: template?.retailer_moq ?? null,
          distributor_moq: template?.distributor_moq ?? null,
          stock: 0,
          pack_size: template?.pack_size ?? null,
          weight_g: template?.weight_g ?? null,
          dim_l: template?.dim_l ?? null,
          dim_w: template?.dim_w ?? null,
          dim_h: template?.dim_h ?? null,
          pack_weight_g: template?.pack_weight_g ?? null,
          pack_l: template?.pack_l ?? null,
          pack_w: template?.pack_w ?? null,
          pack_h: template?.pack_h ?? null,
          retailer_pack_weight_g: template?.retailer_pack_weight_g ?? template?.pack_weight_g ?? null,
          retailer_pack_l: template?.retailer_pack_l ?? template?.pack_l ?? null,
          retailer_pack_w: template?.retailer_pack_w ?? template?.pack_w ?? null,
          retailer_pack_h: template?.retailer_pack_h ?? template?.pack_h ?? null,
          distributor_pack_weight_g: template?.distributor_pack_weight_g ?? template?.pack_weight_g ?? null,
          distributor_pack_l: template?.distributor_pack_l ?? template?.pack_l ?? null,
          distributor_pack_w: template?.distributor_pack_w ?? template?.pack_w ?? null,
          distributor_pack_h: template?.distributor_pack_h ?? template?.pack_h ?? null,
          is_active: false,
          sort_order: sourceRows.length + index,
          low_stock_threshold: 10,
          available_customer: template?.available_customer ?? true,
          available_retailer: template?.available_retailer ?? true,
          available_distributor: template?.available_distributor ?? true,
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
    if (!confirm(`Archive variant ${row.sku}? Existing orders will keep their SKU snapshot.`)) return;
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

  const archiveVariant = async (row: Variant) => {
    if (busy) return;
    if (row.id.startsWith("new-")) {
      removeRow(row);
      return;
    }
    if (!confirm(`Archive variant ${row.sku}? It can be restored later.`)) return;
    setSaving(true);
    try {
      await adminSetProductVariantState({ data: { variantId: row.id, action: "archive" } });
      dirty.current = false;
      await q.refetch();
      await qc.invalidateQueries({ queryKey: ["admin-product-master"] });
      toast.success(`Variant ${row.sku} archived.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not archive variant");
    } finally {
      setSaving(false);
    }
  };

  const restoreVariant = async (row: Variant) => {
    if (busy || row.id.startsWith("new-")) return;
    setSaving(true);
    try {
      await adminSetProductVariantState({ data: { variantId: row.id, action: "restore" } });
      dirty.current = false;
      await q.refetch();
      await qc.invalidateQueries({ queryKey: ["admin-product-master"] });
      toast.success(`Variant ${row.sku} restored.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not restore variant");
    } finally {
      setSaving(false);
    }
  };

  const deleteVariantPermanently = async (row: Variant) => {
    if (busy) return;
    if (row.id.startsWith("new-")) {
      removeRow(row);
      return;
    }
    if (!row.archived_at) {
      toast.error("Archive this variant before deleting it permanently.");
      return;
    }
    if (!confirm(`Permanently delete variant ${row.sku}? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await adminDeleteProductVariantPermanent({ data: { variantId: row.id } });
      setEditingId((current) => (current === row.id ? null : current));
      dirty.current = false;
      await q.refetch();
      await qc.invalidateQueries({ queryKey: ["admin-product-master"] });
      toast.success(`Variant ${row.sku} permanently deleted.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not permanently delete variant");
    } finally {
      setSaving(false);
    }
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
            row.id === draftId || (original && row.sku.trim().toUpperCase() === original.sku.trim().toUpperCase()),
        );
        if (!target) throw new Error("A saved SKU could not be matched to its pending photos. Reload before retrying.");
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
  const saveAxes = async (generate: boolean, selectedCombinations?: Record<string, string>[]) => {
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
    // Generating options must stay a local draft first. Saving the old matrix before
    // generation can fail when a legacy/base SKU does not yet have values for newly
    // added axes. Keep those legacy rows, but safely make incomplete ones inactive.
    if (generate) {
      const safeRows = rows.map((row) => {
        const missingNewOption = generationAxes.some(
          (axis) => !axis.values.includes(row.attributes?.[axis.axis_key] ?? ""),
        );
        return row.is_active && missingNewOption ? { ...row, is_active: false } : row;
      });
      const deactivated = safeRows.filter((row, index) => rows[index]?.is_active && !row.is_active).length;

      setAxisRows(cleaned);
      setAxesDirty(true);
      if (deactivated) {
        dirty.current = true;
        setRows(safeRows);
        toast.info(
          `${deactivated} old/base SKU${deactivated === 1 ? " was" : "s were"} kept but made inactive because it did not have values for the new options.`,
        );
      }
      generateCombinations(generationAxes, safeRows, selectedCombinations);
      setEditingId(null);
      setTab("customer");
      return;
    }

    if (editingId) {
      setAxisRows(cleaned);
      setAxesDirty(true);
      toast.info("Options saved in this draft. Continue editing; Review & save writes the changes.");
      return;
    }

    await saveMatrix();
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

  const workflowLabel =
    buyerWorkflow === "retailer"
      ? "Retailer"
      : buyerWorkflow === "distributor"
        ? "Distributor"
        : buyerWorkflow === "customer"
          ? "Customer"
          : null;
  const usesSharedSkuSet = buyerWorkflow === "retailer" || buyerWorkflow === "distributor";

  const sectionTitle =
    workflowLabel
      ? `Price & Stock for ${workflowLabel === "Customer" ? "Customers" : workflowLabel}`
      : displayOnly === "quick"
        ? "Options & Variations"
        : displayOnly === "shipping"
          ? "Weight & Dimensions"
          : priceSegment === "retailer"
            ? "Retailer Price & Stock"
            : priceSegment === "distributor"
              ? "Distributor Price & Stock"
              : priceSegment === "customer"
                ? "Customer Price & Stock"
                : "Product Variations";

  const sectionDescription =
    workflowLabel
      ? usesSharedSkuSet
        ? `Use the existing shared SKUs to enter independent ${workflowLabel.toLowerCase()} pricing and package dimensions. Customer pricing and shared stock are not changed.`
        : `Create shared variations once, enter ${workflowLabel.toLowerCase()} price and stock, then add weight and dimensions.`
      : displayOnly === "quick"
        ? "Create, edit or archive variation combinations and their shared SKUs."
        : displayOnly === "shipping"
          ? "Edit only single-unit and package weight and dimensions for each shared SKU."
          : priceSegment
            ? `Edit only ${priceSegment} pricing. Variations and dimensions stay in Price & Stock for Customers.`
            : "Manage options, pricing, stock, pack size and weight & dimensions for every SKU.";

  const saveActionLabel =
    workflowLabel
      ? `Save ${workflowLabel} Product Setup`
      : displayOnly === "quick"
        ? "Save Variations"
        : displayOnly === "shipping"
          ? "Save Weight & Dimensions"
          : priceSegment === "retailer"
            ? "Save Retailer Pricing"
            : priceSegment === "distributor"
              ? "Save Distributor Pricing"
              : priceSegment === "customer"
                ? "Save Customer Pricing"
                : "Save All Variant Changes";

  return (
    <fieldset
      disabled={busy}
      className="md:col-span-2 min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      <div className="border-b border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wider text-slate-600">{sectionTitle}</div>

            <div className="mt-1 text-xs text-slate-500">{sectionDescription}</div>
          </div>

          <div className="flex gap-2">
            {(!displayOnly || displayOnly === "quick") && !usesSharedSkuSet && (
              <Button size="sm" variant="outline" type="button" onClick={addRow}>
                <Plus className="mr-1 h-4 w-4" />
                Add Variation
              </Button>
            )}

            <Button size="sm" type="button" onClick={saveAll} disabled={busy || rows.length === 0}>
              <Save className="mr-1 h-4 w-4" />
              {saving ? "Saving…" : saveActionLabel}
            </Button>
          </div>
        </div>
      </div>

      {!displayOnly && (
        <div className="overflow-x-auto border-b border-slate-200">
          <div className="flex min-w-max gap-1 p-2">
            {!customerPricingOnly && !usesSharedSkuSet && (
              <TabButton
                active={tab === "quick"}
                onClick={() => setTab("quick")}
                icon={<SlidersHorizontal className="h-4 w-4" />}
              >
                {buyerWorkflow ? "1. Create Product Variations" : "Options & Variants"}
              </TabButton>
            )}

            <TabButton
              active={tab === "customer"}
              onClick={() => setTab("customer")}
              icon={<Users className="h-4 w-4" />}
            >
              {buyerWorkflow ? (usesSharedSkuSet ? "1. Price & Stock" : "2. Price & Stock") : "Customer Price & Stock"}
            </TabButton>

            <TabButton active={tab === "shipping"} onClick={() => setTab("shipping")} icon={<Truck className="h-4 w-4" />}>
              {buyerWorkflow ? (usesSharedSkuSet ? "2. Weight & Dimensions" : "3. Weight & Dimensions") : "Weight & Dimensions"}
            </TabButton>
          </div>
        </div>
      )}

      {(dirty.current || axesDirty || photosPending) && (
        <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Unsaved changes. Save All Variant Changes saves shared options, SKU details and selected images together.
          Switching pricing tabs keeps your edits.
        </div>
      )}

      <div className="p-4">
        <div hidden={tab !== "quick"}>
          <QuickVariantsTab
            rows={rows}
            updateRow={updateRow}
            archiveVariant={archiveVariant}
            restoreVariant={restoreVariant}
            deleteVariantPermanently={deleteVariantPermanently}
            editRow={(row) => {
              setWizardStep(0);
              setEditingId(row.id);
            }}
            manageImages={onManageImages}
            optionsEditor={tab === "quick" && !editingId ? optionsEditor : null}
          />
        </div>

        {tab === "customer" && (
          <CustomerTab
            rows={rows}
            updateRow={updateRow}
            editRow={(row) => {
              setWizardStep(0);
              setEditingId(row.id);
            }}
            removeRow={removeRow}
            initialSegment={priceSegment ?? "customer"}
            lockSegment={Boolean(priceSegment)}
          />
        )}

        {tab === "shipping" && (
          <ShippingTab rows={rows} updateRow={updateRow} initialScope={buyerWorkflow ?? "customer"} />
        )}
      </div>

      <div className="flex justify-end border-t border-slate-200 bg-slate-50 p-4">
        <Button type="button" onClick={saveAll} disabled={busy || rows.length === 0}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving…" : saveActionLabel}
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

function QuickVariantsTab({
  rows,
  updateRow,
  archiveVariant,
  restoreVariant,
  deleteVariantPermanently,
  editRow,
  manageImages,
  optionsEditor,
}: {
  rows: Variant[];
  updateRow: (id: string, patch: Partial<Variant>) => void;
  archiveVariant: (row: Variant) => void;
  restoreVariant: (row: Variant) => void;
  deleteVariantPermanently: (row: Variant) => void;
  editRow: (row: Variant) => void;
  manageImages?: (sku: string) => void;
  optionsEditor: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      {optionsEditor}

      <div>
        <h3 className="text-lg font-semibold">Variants · {rows.length}</h3>
        <p className="text-xs text-slate-500">
          Review the generated variation combinations and SKUs. Use Edit to change variation details; pricing and stock
          are managed only in Step 2.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyVariants />
      ) : (
        <div className="scrollbar-visible max-h-[70vh] overflow-auto overscroll-contain rounded-xl border border-slate-200" tabIndex={0} role="region" aria-label="Variants table">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="sticky top-0 z-30 bg-white shadow-sm">
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <Th>Variation</Th>
                <Th>Generated SKU</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200">
                  <Td>
                    <VariantIdentity row={row} />
                  </Td>

                  <Td>
                    <div className="min-w-[180px] break-all font-mono text-xs font-medium text-slate-700">
                      {row.sku}
                    </div>
                  </Td>

                  <Td>
                    <div className="flex min-w-[110px] items-center gap-2">
                      {!row.archived_at && (
                        <Switch
                          checked={Boolean(row.is_active)}
                          onCheckedChange={(checked) => updateRow(row.id, { is_active: checked })}
                        />
                      )}
                      <span className="text-xs font-medium text-slate-600">
                        {row.archived_at ? "Archived" : row.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </Td>

                  <Td>
                    <div className="flex min-w-[260px] flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => editRow(row)}
                        title="Edit variation"
                      >
                        <Pencil className="mr-1 h-4 w-4" />
                        Edit
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

                      {row.archived_at ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => restoreVariant(row)} title="Restore archived variant" aria-label={`Restore variant ${row.sku}`}>
                          <RotateCcw className="mr-1 h-4 w-4" /> Restore
                        </Button>
                      ) : (
                        <Button type="button" size="sm" variant="outline" onClick={() => archiveVariant(row)} title={row.id.startsWith("new-") ? "Remove unsaved variant" : "Archive variant"} aria-label={`${row.id.startsWith("new-") ? "Remove" : "Archive"} variant ${row.sku}`}>
                          <Archive className="mr-1 h-4 w-4" /> {row.id.startsWith("new-") ? "Remove" : "Archive"}
                        </Button>
                      )}

                      {!row.id.startsWith("new-") && (
                        <Button type="button" size="sm" variant="destructive" onClick={() => deleteVariantPermanently(row)} title={row.archived_at ? "Delete variant permanently" : "Archive before permanent deletion"} aria-label={`Permanently delete variant ${row.sku}`}>
                          <Trash2 className="mr-1 h-4 w-4" /> Delete permanently
                        </Button>
                      )}
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
    weight_g: "Weight (g)",
    dim_l: "Length (cm)",
    dim_w: "Width (cm)",
    dim_h: "Height (cm)",
    pack_weight_g: "Package weight (g)",
    pack_l: "Package length (cm)",
    pack_w: "Package width (cm)",
    pack_h: "Package height (cm)",
    retailer_pack_weight_g: "Retailer package weight (g)",
    retailer_pack_l: "Retailer package length (cm)",
    retailer_pack_w: "Retailer package width (cm)",
    retailer_pack_h: "Retailer package height (cm)",
    distributor_pack_weight_g: "Distributor package weight (g)",
    distributor_pack_l: "Distributor package length (cm)",
    distributor_pack_w: "Distributor package width (cm)",
    distributor_pack_h: "Distributor package height (cm)",
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
    targets.forEach((row) => updateRow(row.id, { [field]: field === "is_active" ? parsed === 1 : parsed }));
    toast.success(`Updated ${targets.length} draft rows. Review and save variants.`);
  };
  return (
    <details className="rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer font-semibold">Bulk edit selected variants</summary>
      <p className="my-3 text-sm text-slate-500">
        Changes are staged for selected SKUs only. Stock quantities use the dedicated inventory workflow.
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
                  event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id),
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
            <Input type="number" min="0" step="any" value={value} onChange={(event) => setValue(event.target.value)} />
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
          <div className="text-xs font-semibold uppercase tracking-wider text-sky-700">Variation {number}</div>
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
              title={row.id.startsWith("new-") ? "Save this SKU before attaching images" : "Manage SKU images"}
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
            <label>
              <FieldTitle>Tax / GST %</FieldTitle>
              <Input
                className="mt-1"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={row.attributes?.__tax_pct ?? ""}
                placeholder="e.g. 18"
                onChange={(event) =>
                  updateRow(row.id, {
                    attributes: { ...row.attributes, __tax_pct: event.target.value },
                  })
                }
              />
            </label>
          </div>
        </VariantSection>

        <VariantSection title="Order quantities and inventory">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {field("moq", "Customer MOQ")}
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
              {field("pack_weight_g", "Customer weight (g)")}
              {field("pack_l", "Customer length (cm)")}
              {field("pack_w", "Customer width (cm)")}
              {field("pack_h", "Customer height (cm)")}
              {field("retailer_pack_weight_g", "Retailer weight (g)")}
              {field("retailer_pack_l", "Retailer length (cm)")}
              {field("retailer_pack_w", "Retailer width (cm)")}
              {field("retailer_pack_h", "Retailer height (cm)")}
              {field("distributor_pack_weight_g", "Distributor weight (g)")}
              {field("distributor_pack_l", "Distributor length (cm)")}
              {field("distributor_pack_w", "Distributor width (cm)")}
              {field("distributor_pack_h", "Distributor height (cm)")}
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
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h4>
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
        rows.some((other) => other.id !== row.id && other.sku.trim().toUpperCase() === row.sku.trim().toUpperCase()))
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
            {row.is_active ? "Available for sale after saving." : "Inactive until you choose to activate it."}
          </p>
        </DialogHeader>
        <nav aria-label="Variation setup steps" className="shrink-0 border-b border-slate-200 bg-slate-50 p-3">
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
                  Choose images now; they attach to this SKU after the variation is saved. You can skip this step and
                  add them later.
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
                    <article key={photo.id} className="space-y-3 rounded-xl border border-slate-200 p-3">
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
                                item.id === photo.id ? { ...item, altText: event.target.value } : item,
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
                          <Star className="h-4 w-4" /> {photo.primary ? "Primary image" : "Set primary"}
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
                These options are shared by every variation in this product. Define them once here, then choose this
                SKU’s values in Step 3.
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
                  Saved SKU codes stay fixed to preserve orders and images. You can change the variation name and option
                  values.
                </p>
              )}
              {!axes.length && (
                <p className="text-sm text-slate-500">
                  No shared options yet. Go to Product options to add Wattage, Size, Colour or another attribute.
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
                      {[...new Set(axis.values.map((value) => value.trim()).filter(Boolean))].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <VariantSpecifications row={row} axes={axes} updateRow={updateRow} />
            </section>
            <section hidden={step !== 3} className="space-y-4">
              <h3 className="text-lg font-semibold">Prices and minimum order quantities</h3>
              <p className="text-sm text-slate-500">
                Set customer, retailer and distributor prices for this SKU. Blank partner prices remain unset and do
                not inherit Customer pricing.
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
                  {numberField("pack_weight_g", "Customer weight (g)")}
                  {numberField("pack_l", "Customer length (cm)")}
                  {numberField("pack_w", "Customer width (cm)")}
                  {numberField("pack_h", "Customer height (cm)")}
                  {numberField("retailer_pack_weight_g", "Retailer weight (g)")}
                  {numberField("retailer_pack_l", "Retailer length (cm)")}
                  {numberField("retailer_pack_w", "Retailer width (cm)")}
                  {numberField("retailer_pack_h", "Retailer height (cm)")}
                  {numberField("distributor_pack_weight_g", "Distributor weight (g)")}
                  {numberField("distributor_pack_l", "Distributor length (cm)")}
                  {numberField("distributor_pack_w", "Distributor width (cm)")}
                  {numberField("distributor_pack_h", "Distributor height (cm)")}
                </div>
              </VariantSection>
              <p className="text-sm text-slate-500">
                New and duplicated variations start with zero stock. Enter the real quantity; stock changes use the
                existing inventory safeguards.
              </p>
            </section>
            <section hidden={step !== 5} className="space-y-4">
              <h3 className="text-lg font-semibold">Review this variation</h3>
              <dl className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                {[
                  ["Variation", variantName(row)],
                  ["SKU", row.sku],
                  ["Customer price", row.price === null ? "Not set" : money(row.price)],
                  ["Retailer price", row.retailer_price === null ? "Not set" : money(row.retailer_price)],
                  [
                    "Distributor price",
                    row.distributor_price === null ? "Not set" : money(row.distributor_price),
                  ],
                  ["Stock", String(row.stock ?? 0)],
                  ["Selected images", String(photos.length)],
                  [
                    "Options",
                    axes
                      .map((axis) => `${axis.label}: ${row.attributes[axis.axis_key] || "Not selected"}`)
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
                <Switch checked={row.is_active} onCheckedChange={(value) => updateRow(row.id, { is_active: value })} />
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
                Saving includes the shared options and all unsaved variations in this family. Image uploads follow the
                successful SKU save. If an image fails, the variation stays saved and you can retry the pending image.
              </p>
            </section>
          </fieldset>
        </div>
        <DialogFooter className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex sm:flex-wrap">
          <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
            Close · keep edits
          </Button>
          {!isNew && (
            <Button type="button" variant="outline" disabled={saving} onClick={() => duplicateRow(row)}>
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
        Add only verified details for this SKU. These do not generate combinations. Common specifications belong to the
        family.
      </p>
      {extra.map(([name, value]) => (
        <label key={name} className="block text-sm">
          {name}
          <Input
            value={value}
            onChange={(event) => updateRow(row.id, { attributes: { ...row.attributes, [name]: event.target.value } })}
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

function LowestStartingPrice({
  rows,
  field,
  label,
}: {
  rows: Variant[];
  field: "price" | "retailer_price" | "distributor_price";
  label: string;
}) {
  const values = rows
    .map((row) => row[field])
    .filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0);
  const lowest = values.length ? Math.min(...values) : 0;

  return (
    <div className="grid gap-3 md:grid-cols-[320px_minmax(0,1fr)] md:items-center">
      <div className="text-sm font-medium text-slate-700">{label} *</div>
      <Input value={lowest} readOnly className="bg-slate-50" />
    </div>
  );
}

function LowStockEditor({
  rows,
  updateRow,
  title,
  quantityLabel,
}: {
  rows: Variant[];
  updateRow: (id: string, patch: Partial<Variant>) => void;
  title: string;
  quantityLabel: string;
}) {
  const first = rows[0]?.low_stock_threshold ?? 10;
  const applyAll = (value: number) => {
    for (const row of rows) updateRow(row.id, { low_stock_threshold: value });
  };

  return (
    <section className="space-y-3 border-t border-slate-200 pt-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="grid gap-3 md:grid-cols-[320px_minmax(0,1fr)] md:items-center">
        <div className="text-sm text-slate-700">{quantityLabel}</div>
        <Input
          type="number"
          min="0"
          step="1"
          value={first}
          onChange={(event) => applyAll(Math.max(0, Math.trunc(Number(event.target.value || 0))))}
        />
      </div>
    </section>
  );
}

function StockVisibilityReference({ prefix = "" }: { prefix?: string }) {
  return (
    <section className="space-y-3 border-t border-slate-200 pt-5">
      <h3 className="text-sm font-semibold text-slate-900">{prefix}Stock Visibility State</h3>
      <div className="space-y-2">
        <label className="flex items-center gap-3 text-sm text-slate-700">
          <input type="radio" checked readOnly />
          Show {prefix.toLowerCase()}Stock Quantity
        </label>
        <label className="flex items-center gap-3 text-sm text-slate-400">
          <input type="radio" disabled />
          Show {prefix.toLowerCase()}Stock With Text Only
        </label>
        <label className="flex items-center gap-3 text-sm text-slate-400">
          <input type="radio" disabled />
          Hide {prefix.toLowerCase()}Stock
        </label>
      </div>
      <p className="text-xs text-amber-700">
        Aurona currently stores stock quantity per SKU but has no persisted stock-visibility mode field. “Show Stock
        Quantity” remains the safe active behaviour until that database field is added.
      </p>
    </section>
  );
}

const SEGMENT_PRICE_FIELDS: Record<
  PriceSegment,
  { label: string; mrpKey: "mrp" | "retailer_mrp" | "distributor_mrp"; priceKey: "price" | "retailer_price" | "distributor_price"; stockKey: "stock" | "retailer_stock" | "distributor_stock"; packSizeKey: "pack_size" | "retailer_pack_size" | "distributor_pack_size" }
> = {
  customer: { label: "Customer", mrpKey: "mrp", priceKey: "price", stockKey: "stock", packSizeKey: "pack_size" },
  retailer: { label: "Retailer", mrpKey: "retailer_mrp", priceKey: "retailer_price", stockKey: "retailer_stock", packSizeKey: "retailer_pack_size" },
  distributor: { label: "Distributor", mrpKey: "distributor_mrp", priceKey: "distributor_price", stockKey: "distributor_stock", packSizeKey: "distributor_pack_size" },
};

const roundMoney = (value: number) => Number(value.toFixed(2));
const clampPct = (value: number) => Math.min(100, Math.max(0, value));

/** Discount shown for a row: persisted for customer, derived for the other two. */
function segmentDiscount(row: Variant, segment: PriceSegment): number {
  if (segment === "customer") return Number(row.discount_pct ?? 0);
  const { mrpKey, priceKey } = SEGMENT_PRICE_FIELDS[segment];
  const mrp = Number((row[mrpKey] as number | null) ?? 0);
  const price = Number((row[priceKey] as number | null) ?? 0);
  if (!mrp || !price || price > mrp) return 0;
  return Number(clampPct(((mrp - price) / mrp) * 100).toFixed(2));
}

/**
 * Bulk price setter for the currently selected account type only: pick an option
 * (Wattage, Size, Colour…) and one of its values, then apply MRP / discount / price.
 */
function BulkPriceByOption({
  rows,
  updateRow,
  segment,
}: {
  rows: Variant[];
  updateRow: (id: string, patch: Partial<Variant>) => void;
  segment: PriceSegment;
}) {
  const { label, mrpKey, priceKey, stockKey, packSizeKey } = SEGMENT_PRICE_FIELDS[segment];

  const optionKeys = React.useMemo(() => {
    const keys: string[] = [];
    for (const row of rows) {
      for (const key of Object.keys(row.attributes ?? {})) {
        if (key.startsWith("__")) continue;
        if (!keys.includes(key)) keys.push(key);
      }
    }
    return keys;
  }, [rows]);

  const defaultGroupKey = optionKeys.find((key) => /watt/i.test(key)) ?? optionKeys[0] ?? "";
  const [groupKey, setGroupKey] = useState(defaultGroupKey);
  const [drafts, setDrafts] = useState<
    Record<string, Partial<Record<"mrp" | "discount" | "price" | "stock" | "pack_size", string>>>
  >({});

  useEffect(() => {
    if (!optionKeys.length) {
      if (groupKey) setGroupKey("");
      return;
    }
    if (!optionKeys.includes(groupKey)) setGroupKey(defaultGroupKey);
  }, [optionKeys, groupKey, defaultGroupKey]);

  const activeKey = optionKeys.includes(groupKey) ? groupKey : defaultGroupKey;
  const groupValues = React.useMemo(() => {
    const values: string[] = [];
    for (const row of rows) {
      const value = row.attributes?.[activeKey];
      if (value && !values.includes(value)) values.push(value);
    }
    return values;
  }, [rows, activeKey]);

  const optionLabel = (key: string) =>
    key
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const setDraft = (
    group: string,
    field: "mrp" | "discount" | "price" | "stock" | "pack_size",
    value: string,
  ) =>
    setDrafts((current) => ({
      ...current,
      [group]: { ...current[group], [field]: value },
    }));

  const parseOptional = (raw: string | undefined, fieldLabel: string, integer = false) => {
    if (raw === undefined || raw.trim() === "") return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) {
      throw new Error(`Enter a valid ${fieldLabel.toLowerCase()}.`);
    }
    return value;
  };

  const applyGroup = (group: string) => {
    const matching = rows.filter((row) => row.attributes?.[activeKey] === group);
    if (!matching.length) {
      toast.error("No variations match that option.");
      return;
    }

    const draft = drafts[group] ?? {};
    try {
      const mrp = parseOptional(draft.mrp, "MRP");
      const discount = parseOptional(draft.discount, "discount");
      const price = parseOptional(draft.price, `${label} price`);
      const stock = parseOptional(draft.stock, "stock", true);
      const packSize = parseOptional(draft.pack_size, "pack size");

      if ([mrp, discount, price, stock, packSize].every((value) => value === null)) {
        toast.error(`Enter at least one value for ${group}.`);
        return;
      }

      for (const row of matching) {
        const patch: Record<string, unknown> = {};
        const currentMrp = Number((row[mrpKey] as number | null) ?? 0);
        const baseMrp = mrp ?? currentMrp;

        if (mrp !== null) patch[mrpKey] = mrp;
        if (price !== null) {
          patch[priceKey] = price;
          if (segment === "customer" && baseMrp > 0) {
            patch.discount_pct = Number(clampPct(((baseMrp - price) / baseMrp) * 100).toFixed(2));
          }
        } else if (discount !== null) {
          const safeDiscount = clampPct(discount);
          if (segment === "customer") patch.discount_pct = safeDiscount;
          if (baseMrp > 0) patch[priceKey] = roundMoney(baseMrp - (baseMrp * safeDiscount) / 100);
        } else if (mrp !== null) {
          const existingDiscount = segmentDiscount(row, segment);
          if (existingDiscount > 0) {
            patch[priceKey] = roundMoney(mrp - (mrp * existingDiscount) / 100);
          }
        }

        if (stock !== null) patch[stockKey] = stock;
        if (packSize !== null) patch[packSizeKey] = packSize;
        updateRow(row.id, patch as Partial<Variant>);
      }

      toast.success(
        `${label} pricing/details applied to ${matching.length} SKU${matching.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enter valid values.");
    }
  };

  if (!optionKeys.length || !activeKey || !groupValues.length) return null;

  const fields: Array<{
    key: "mrp" | "discount" | "price" | "stock" | "pack_size";
    label: string;
    placeholder: string;
  }> = [
    { key: "mrp", label: "MRP", placeholder: "MRP" },
    { key: "discount", label: "Discount %", placeholder: "%" },
    { key: "price", label, placeholder: `${label} price` },
    { key: "stock", label: "Stock", placeholder: "Stock" },
    { key: "pack_size", label: "Pack", placeholder: "Pack size" },
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="font-semibold text-slate-950">Set {label.toLowerCase()} prices by {optionLabel(activeKey)}</h3>
          <p className="mt-1 text-xs text-slate-500">
            Apply one set of {label.toLowerCase()} prices to every SKU sharing the same option value. Prices stay
            separate for this account type, including stock and pack size. The SKU identity remains shared.
          </p>
        </div>

        <label className="min-w-[220px] text-xs font-medium text-slate-600">
          Group pricing by
          <select
            className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500"
            value={activeKey}
            onChange={(event) => setGroupKey(event.target.value)}
          >
            {optionKeys.map((key) => (
              <option key={key} value={key}>
                {optionLabel(key)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="scrollbar-visible w-full min-w-0 overflow-x-auto overscroll-x-contain" tabIndex={0} role="region" aria-label={`${label} bulk pricing table`}>
        <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[17%]" />
            {fields.map((field) => (
              <col key={field.key} className="w-[11%]" />
            ))}
            <col className="w-[28%]" />
          </colgroup>
          <thead className="sticky top-0 z-30 bg-white shadow-sm">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <Th className="px-2">{optionLabel(activeKey)}</Th>
              {fields.map((field) => (
                <Th key={field.key} className="px-2">{field.label}</Th>
              ))}
              <Th className="px-2">Apply</Th>
            </tr>
          </thead>
          <tbody>
            {groupValues.map((group) => {
              const count = rows.filter((row) => row.attributes?.[activeKey] === group).length;
              return (
                <tr key={group} className="border-t border-slate-200 bg-white">
                  <Td className="px-2">
                    <div className="font-semibold text-slate-950">{group}</div>
                    <div className="text-xs text-slate-500">
                      {count} SKU{count === 1 ? "" : "s"}
                    </div>
                  </Td>
                  {fields.map((field) => (
                    <Td key={field.key} className="px-2">
                      <Input
                        type="number"
                        min="0"
                        step={field.key === "stock" ? "1" : "0.01"}
                        className="h-9 w-full min-w-0 px-2 text-xs"
                        inputMode={field.key === "stock" ? "numeric" : "decimal"}
                        placeholder={field.placeholder}
                        value={drafts[group]?.[field.key] ?? ""}
                        onChange={(event) => setDraft(group, field.key, event.target.value)}
                      />
                    </Td>
                  ))}
                  <Td className="px-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-auto min-h-9 w-full max-w-full whitespace-normal break-words px-1.5 py-1.5 text-center text-xs leading-tight"
                      onClick={() => applyGroup(group)}
                    >
                      Apply to {group}
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Blank fields keep their current values. Nothing is saved until you use the main save button.
      </p>
    </section>
  );
}

function CustomerTab({
  rows,
  updateRow,
  editRow,
  removeRow,
  initialSegment,
  lockSegment,
}: {
  rows: Variant[];
  updateRow: (id: string, patch: Partial<Variant>) => void;
  editRow: (row: Variant) => void;
  removeRow: (row: Variant) => void;
  initialSegment: PriceSegment;
  lockSegment: boolean;
}) {
  const [segment, setSegment] = React.useState<PriceSegment>(initialSegment);

  useEffect(() => {
    setSegment(initialSegment);
  }, [initialSegment]);

  if (!rows.length) {
    return (
      <div className="space-y-5">
        <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Price &amp; Stock</h2>
            <p className="mt-1 text-xs text-slate-500">
              No variations yet. Create one in Options &amp; Variations, then return here to set pricing.
            </p>
          </div>
        </section>

        <EmptyVariants />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!lockSegment && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
          {(["customer", "retailer", "distributor"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSegment(key)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${
                segment === key
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {key}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-500">
            Each account type keeps its own prices. Stock is shared by all three.
          </span>
        </div>
      )}

      <SegmentPriceTable
        rows={rows}
        updateRow={updateRow}
        segment={segment}
        editRow={editRow}
        removeRow={removeRow}
      />
    </div>
  );
}
type DimensionKey = "weight_g" | "dim_l" | "dim_w" | "dim_h" | PackageDimensionKey;

type DimensionScope = "unit" | "customer" | "retailer" | "distributor";

const DIMENSION_SCOPES: Array<{
  id: DimensionScope;
  label: string;
  fields: { weight: DimensionKey; l: DimensionKey; w: DimensionKey; h: DimensionKey };
}> = [
  { id: "unit", label: "Single Unit / Pc", fields: { weight: "weight_g", l: "dim_l", w: "dim_w", h: "dim_h" } },
  { id: "customer", label: "Customer package", fields: { weight: "pack_weight_g", l: "pack_l", w: "pack_w", h: "pack_h" } },
  {
    id: "retailer",
    label: "Retailer package",
    fields: { weight: "retailer_pack_weight_g", l: "retailer_pack_l", w: "retailer_pack_w", h: "retailer_pack_h" },
  },
  {
    id: "distributor",
    label: "Distributor package",
    fields: {
      weight: "distributor_pack_weight_g",
      l: "distributor_pack_l",
      w: "distributor_pack_w",
      h: "distributor_pack_h",
    },
  },
];

function BulkDimensionsByOption({
  rows,
  updateRow,
  initialScope,
}: {
  rows: Variant[];
  updateRow: (id: string, patch: Partial<Variant>) => void;
  initialScope: DimensionScope;
}) {
  const optionKeys = React.useMemo(() => {
    const keys: string[] = [];
    for (const row of rows) {
      for (const key of Object.keys(row.attributes ?? {})) {
        if (key.startsWith("__")) continue;
        if (!keys.includes(key)) keys.push(key);
      }
    }
    return keys;
  }, [rows]);

  const valuesByKey = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const key of optionKeys) {
      const list: string[] = [];
      for (const row of rows) {
        const value = row.attributes?.[key];
        if (value && !list.includes(value)) list.push(value);
      }
      map[key] = list;
    }
    return map;
  }, [rows, optionKeys]);

  const [filters, setFilters] = useState<Record<string, string>>({});
  const scope = initialScope;
  const [weight, setWeight] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");

  const matched = rows.filter((row) =>
    optionKeys.every((key) => {
      const wanted = filters[key];
      if (!wanted || wanted === "__all") return true;
      return row.attributes?.[key] === wanted;
    }),
  );

  const active = DIMENSION_SCOPES.find((entry) => entry.id === scope)!;

  const apply = () => {
    if (!matched.length) {
      toast.error("No variations match those options.");
      return;
    }
    const entries: Array<[DimensionKey, string]> = [
      [active.fields.weight, weight],
      [active.fields.l, length],
      [active.fields.w, width],
      [active.fields.h, height],
    ];
    const patch: Record<string, number> = {};
    for (const [key, raw] of entries) {
      if (raw.trim() === "") continue; // empty never overwrites existing values
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        toast.error("Enter valid numbers (zero or more).");
        return;
      }
      patch[key] = value;
    }
    if (!Object.keys(patch).length) {
      toast.error("Enter at least one measurement to apply.");
      return;
    }
    for (const row of matched) updateRow(row.id, patch as Partial<Variant>);
    toast.success(
      `${active.label} measurements applied to ${matched.length} variation${matched.length === 1 ? "" : "s"}.`,
    );
  };

  const selectClass =
    "h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300";

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Bulk update weight & dimensions</h3>
        <p className="mt-1 text-xs text-slate-500">
          Pick the variations to change, choose whose measurements you are setting, then fill only the fields you want
          to update. Blank fields keep their existing values.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {optionKeys.map((key) => (
          <label key={key} className="flex flex-col gap-1 text-xs text-slate-500">
            {key.replaceAll("_", " ")}
            <select
              className={selectClass}
              value={filters[key] ?? "__all"}
              onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))}
            >
              <option value="__all">All variants</option>
              {(valuesByKey[key] ?? []).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        ))}

      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Weight (g)
          <Input type="number" min="0" step="any" value={weight} onChange={(e) => setWeight(e.target.value)} className="h-9 w-28" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Length (cm)
          <Input type="number" min="0" step="any" value={length} onChange={(e) => setLength(e.target.value)} className="h-9 w-28" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Width (cm)
          <Input type="number" min="0" step="any" value={width} onChange={(e) => setWidth(e.target.value)} className="h-9 w-28" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Height (cm)
          <Input type="number" min="0" step="any" value={height} onChange={(e) => setHeight(e.target.value)} className="h-9 w-28" />
        </label>
        <Button type="button" onClick={apply} className="h-9">
          Apply to {matched.length} matching variant{matched.length === 1 ? "" : "s"}
        </Button>
      </div>
    </section>
  );
}

function ShippingTab({
  rows,
  updateRow,
  initialScope,
}: {
  rows: Variant[];
  updateRow: (id: string, patch: Partial<Variant>) => void;
  initialScope: DimensionScope;
}) {
  const scope = DIMENSION_SCOPES.find((entry) => entry.id === initialScope)!;
  const packageLabel = scope.label;
  const unitFields: Array<{ key: DimensionKey; label: string; placeholder: string }> = [
    { key: "weight_g", label: "Weight (g)", placeholder: "Weight" },
    { key: "dim_l", label: "Length (cm)", placeholder: "Length" },
    { key: "dim_w", label: "Width (cm)", placeholder: "Width" },
    { key: "dim_h", label: "Height (cm)", placeholder: "Height" },
  ];
  const fields: Array<{ key: DimensionKey; label: string; placeholder: string }> = [
    { key: scope.fields.weight, label: "Package Weight (g)", placeholder: "Weight" },
    { key: scope.fields.l, label: "Package Length (cm)", placeholder: "Length" },
    { key: scope.fields.w, label: "Package Width (cm)", placeholder: "Width" },
    { key: scope.fields.h, label: "Package Height (cm)", placeholder: "Height" },
  ];

  const copyDown = (field: DimensionKey | "pack_size", index: number) => {
    const value = rows[index]?.[field] as number | null;
    for (const row of rows.slice(index + 1)) {
      updateRow(row.id, { [field]: value } as Partial<Variant>);
    }
    toast.success("Measurement copied to every row below.");
  };

  if (!rows.length) return <EmptyVariants />;

  const inputCell = (
    row: Variant,
    index: number,
    field: DimensionKey | "pack_size",
    label: string,
    placeholder: string,
    integer = false,
  ) => (
    <Td key={field}>
      <div className="flex min-w-[110px] items-center gap-1">
        <Input
          type="number"
          min="0"
          step={integer ? "1" : "any"}
          inputMode={integer ? "numeric" : "decimal"}
          placeholder={placeholder}
          value={(row[field] as number | null) ?? ""}
          onChange={(event) =>
            updateRow(row.id, {
              [field]: event.target.value === "" ? null : Number(event.target.value),
            } as Partial<Variant>)
          }
          className="h-9 w-[84px] min-w-[84px] px-2 text-xs"
        />
        {index < rows.length - 1 && (
          <button
            type="button"
            title={`Copy ${label} to all rows below`}
            aria-label={`Copy ${label} to all rows below`}
            onClick={() => copyDown(field, index)}
            className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </Td>
  );

  return (
    <div className="space-y-4">
      <BulkDimensionsByOption rows={rows} updateRow={updateRow} initialScope="unit" />

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-4">
          <h3 className="text-base font-semibold text-slate-950">Single Product Weight & Dimensions</h3>
          <p className="mt-1 text-xs text-slate-500">
            Enter the weight, length, width and height for one individual product/SKU.
          </p>
        </div>
        <div className="scrollbar-visible max-h-[70vh] overflow-auto overscroll-contain" tabIndex={0} role="region" aria-label="Single product dimensions table">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="sticky top-0 z-30 bg-white shadow-sm">
              <tr className="bg-white text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <Th className={FREEZE_1}>Variation</Th>
                <Th className={FREEZE_2}>SKU</Th>
                {unitFields.map((field) => <Th key={field.key}>{field.label}</Th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className="border-t border-slate-200 align-middle hover:bg-slate-50/70">
                  <Td className={FREEZE_1}><div className="min-w-[210px] break-words font-semibold text-slate-950">{variantName(row)}</div></Td>
                  <Td className={FREEZE_2}><div className="min-w-[180px] break-all font-mono text-xs font-medium text-slate-600">{row.sku}</div></Td>
                  {unitFields.map((field) => inputCell(row, index, field.key, field.label, field.placeholder))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          These measurements belong to one single product, not its outer package.
        </div>
      </section>

      <BulkDimensionsByOption rows={rows} updateRow={updateRow} initialScope={initialScope} />

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-4">
          <h3 className="text-base font-semibold text-slate-950">{packageLabel} Packing Table</h3>
          <p className="mt-1 text-xs text-slate-500">
            Enter the pack quantity and outer package measurements for every shared SKU.
          </p>
        </div>

        <div className="scrollbar-visible max-h-[70vh] overflow-auto overscroll-contain" tabIndex={0} role="region" aria-label={`${packageLabel} package dimensions table`}>
          <table className="w-full min-w-[1150px] border-collapse text-sm">
            <thead className="sticky top-0 z-30 bg-white shadow-sm">
              <tr className="bg-white text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <Th className={FREEZE_1}>Variation</Th>
                <Th className={FREEZE_2}>SKU</Th>
                <Th>Pack Size</Th>
                {fields.map((field) => (
                  <Th key={field.key}>{field.label}</Th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className="border-t border-slate-200 align-middle hover:bg-slate-50/70">
                  <Td className={FREEZE_1}>
                    <div className="min-w-[210px] break-words font-semibold text-slate-950">{variantName(row)}</div>
                  </Td>
                  <Td className={FREEZE_2}>
                    <div className="min-w-[180px] break-all font-mono text-xs font-medium text-slate-600">{row.sku}</div>
                  </Td>
                  {inputCell(row, index, "pack_size", "Pack Size", "Pack size", true)}
                  {fields.map((field) =>
                    inputCell(row, index, field.key, field.label, field.placeholder),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          These values belong to {packageLabel.toLowerCase()}. Use the main save button to store all changes.
        </div>
      </section>
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
  saveAxes: (generate: boolean, selectedCombinations?: Record<string, string>[]) => Promise<void>;
  excluded: Record<string, string[]>;
  setExcluded: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  draftOnly: boolean;
}) {
  const [valueDrafts, setValueDrafts] = useState<Record<string, string>>({});
  const [selectedCombinationKeys, setSelectedCombinationKeys] = useState<Set<string>>(new Set());

  const updateAxis = (id: string, patch: Partial<Axis>) =>
    setRows(rows.map((axis) => (axis.id === id ? { ...axis, ...patch } : axis)));

  const addAxis = (preset?: { key: string; label: string }) => {
    let sequence = rows.length + 1;
    while (rows.some((axis) => axis.axis_key === `option_${sequence}`)) sequence++;
    const key = preset?.key ?? `option_${sequence}`;
    if (rows.some((axis) => axis.axis_key === key)) return;
    setRows([
      ...rows,
      {
        id: `new-${crypto.randomUUID()}`,
        axis_key: key,
        label: preset?.label ?? "Option",
        values: [],
        sort_order: rows.length,
      },
    ]);
  };

  const removeAxis = (axis: Axis) => {
    if (variants.some((row) => row.attributes[axis.axis_key]))
      return toast.error("This option is already used by an existing SKU.");
    if (confirm(`Remove ${axis.label}?`)) setRows(rows.filter((row) => row.id !== axis.id));
  };

  const activeAxes = rows
    .map((axis) => ({
      ...axis,
      values: [...new Set(axis.values.map((value) => value.trim()).filter(Boolean))].filter(
        (value) => !(excluded[axis.id] ?? []).includes(value),
      ),
    }))
    .filter((axis) => axis.values.length > 0);

  const combinationKey = (attributes: Record<string, string>) =>
    activeAxes.map((axis) => `${axis.axis_key}=${attributes[axis.axis_key] ?? ""}`).join("||");

  let allCombinations: Record<string, string>[] = [];
  let missing: Record<string, string>[] = [];
  try {
    if (activeAxes.length === rows.length && activeAxes.length > 0) {
      allCombinations = missingCombinations(activeAxes, []);
      missing = missingCombinations(activeAxes, variants);
    }
  } catch {
    allCombinations = [];
    missing = [];
  }

  const missingKeys = new Set(missing.map(combinationKey));
  const existingKeys = new Set(allCombinations.map(combinationKey).filter((key) => !missingKeys.has(key)));

  // New valid combinations start selected automatically. Manual unticks are preserved.
  const combinationSignature = missing.map(combinationKey).join("###");
  useEffect(() => {
    setSelectedCombinationKeys((current) => {
      const valid = new Set(missing.map(combinationKey));
      const next = new Set([...current].filter((key) => valid.has(key)));
      if (current.size === 0) valid.forEach((key) => next.add(key));
      return next;
    });
    // combinationSignature is intentionally the dependency: it changes only when combinations change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combinationSignature]);

  const presets = [
    ["wattage", "Watts Available"],
    ["output_colour", "Output Colour Option/s"],
    ["shape", "Shape"],
    ["body_colour", "Body Colour/s"],
    ["pack_size", "Pack Size"],
    ["oscillation", "Oscillation"],
    ["tank_capacity", "Tank Capacities"],
    ["size", "Size Option/s"],
    ["reflector_colour", "Reflector Colour"],
  ] as const;

  const selectedMissing = missing.filter((attributes) => selectedCombinationKeys.has(combinationKey(attributes)));

  const toggleCombination = (attributes: Record<string, string>) => {
    const key = combinationKey(attributes);
    if (existingKeys.has(key)) return;
    setSelectedCombinationKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const setGroup = (groupValue: string, checked: boolean) => {
    const first = activeAxes[0];
    if (!first) return;
    const groupKeys = missing.filter((attributes) => attributes[first.axis_key] === groupValue).map(combinationKey);
    setSelectedCombinationKeys((current) => {
      const next = new Set(current);
      groupKeys.forEach((key) => (checked ? next.add(key) : next.delete(key)));
      return next;
    });
  };

  const generate = () => {
    if (!rows.length) return toast.error("Add at least one option first.");
    if (rows.some((axis) => !axis.label.trim() || !axis.values.length))
      return toast.error("Give every option a name and at least one value.");
    if (!missing.length) return toast.info("All selected combinations already exist.");
    if (!selectedMissing.length) return toast.error("Select at least one SKU combination to generate.");
    void saveAxes(true, selectedMissing);
  };

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div>
        <h3 className="text-lg font-semibold text-slate-950">Create product variations</h3>
        <p className="mt-1 text-sm text-slate-500">
          One product, all its wattages, colours, sizes and models. Add only what this product needs.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-800">1. Choose options</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant="outline"
              disabled={rows.some((axis) => axis.axis_key === key)}
              onClick={() => addAxis({ key, label })}
            >
              <Plus className="mr-1 h-4 w-4" /> {label}
            </Button>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={() => addAxis()}>
            <Plus className="mr-1 h-4 w-4" /> Other option
          </Button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-800">2. Enter values</p>
          {rows.map((axis) => (
            <div key={axis.id} className="rounded-xl border border-slate-200 p-3 sm:p-4">
              <div className="grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-start">
                <label>
                  <FieldTitle>Option</FieldTitle>
                  <Input
                    className="mt-1"
                    value={axis.label}
                    onChange={(event) =>
                      updateAxis(axis.id, {
                        label: event.target.value,
                        ...(axis.id.startsWith("new-")
                          ? {
                              axis_key:
                                event.target.value
                                  .trim()
                                  .toLowerCase()
                                  .replace(/[^a-z0-9_]+/g, "_") || axis.axis_key,
                            }
                          : {}),
                      })
                    }
                  />
                </label>

                <label>
                  <FieldTitle>Values</FieldTitle>
                  <Textarea
                    className="mt-1 min-h-[72px]"
                    value={valueDrafts[axis.id] ?? axis.values.join(", ")}
                    placeholder={
                      axis.axis_key === "wattage"
                        ? "5W, 7W, 9W, 12W"
                        : axis.axis_key === "output_colour"
                          ? "Warm White, Natural White, Cool White"
                          : "Type or paste values separated by commas"
                    }
                    onChange={(event) => {
                      const raw = event.target.value;
                      setValueDrafts((current) => ({ ...current, [axis.id]: raw }));
                      updateAxis(axis.id, { values: parsePastedValues(raw) });
                    }}
                    onBlur={() =>
                      setValueDrafts((current) => {
                        const next = { ...current };
                        delete next[axis.id];
                        return next;
                      })
                    }
                  />
                  <span className="mt-1 block text-xs text-slate-500">
                    Paste comma-separated values or one value per line.
                  </span>
                </label>

                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="mt-5"
                  onClick={() => removeAxis(axis)}
                  aria-label={`Remove ${axis.label}`}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>

              {axis.values.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {[...new Set(axis.values.map((value) => value.trim()).filter(Boolean))].map((value) => {
                    const disabled = (excluded[axis.id] ?? []).includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setExcluded((current) => ({
                            ...current,
                            [axis.id]: disabled
                              ? (current[axis.id] ?? []).filter((item) => item !== value)
                              : [...(current[axis.id] ?? []), value],
                          }))
                        }
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          disabled
                            ? "border-slate-200 bg-slate-100 text-slate-400 line-through"
                            : "border-sky-200 bg-sky-50 text-sky-800"
                        }`}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {allCombinations.length > 0 && (
        <div className="space-y-3 rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">3. Choose the real SKU combinations</p>
              <p className="mt-1 text-sm text-slate-500">
                Tick only combinations that this product actually has. Existing SKUs are protected.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSelectedCombinationKeys(new Set(missing.map(combinationKey)))}
              >
                Select all new
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setSelectedCombinationKeys(new Set())}>
                Clear new
              </Button>
            </div>
          </div>

          {activeAxes[0] && (
            <div className="space-y-4">
              {activeAxes[0].values.map((groupValue) => {
                const first = activeAxes[0];
                const group = allCombinations.filter((attributes) => attributes[first.axis_key] === groupValue);
                const groupMissing = group.filter((attributes) => missingKeys.has(combinationKey(attributes)));
                const selectedCount = groupMissing.filter((attributes) =>
                  selectedCombinationKeys.has(combinationKey(attributes)),
                ).length;

                return (
                  <section key={groupValue} className="overflow-hidden rounded-xl border border-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3">
                      <div>
                        <span className="text-sm text-slate-500">{first.label}</span>
                        <strong className="ml-2 text-slate-950">{groupValue}</strong>
                        <span className="ml-2 text-xs text-slate-500">
                          {selectedCount}/{groupMissing.length} new selected
                        </span>
                      </div>
                      {groupMissing.length > 0 && (
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="ghost" onClick={() => setGroup(groupValue, true)}>
                            Select all
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setGroup(groupValue, false)}>
                            Clear
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                      {group.map((attributes) => {
                        const key = combinationKey(attributes);
                        const exists = existingKeys.has(key);
                        const checked = exists || selectedCombinationKeys.has(key);
                        return (
                          <label
                            key={key}
                            className={`flex min-w-0 items-start gap-3 rounded-lg border p-3 ${
                              exists
                                ? "border-emerald-200 bg-emerald-50"
                                : checked
                                  ? "border-sky-300 bg-sky-50"
                                  : "border-slate-200 bg-white"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4"
                              checked={checked}
                              disabled={exists}
                              onChange={() => toggleCombination(attributes)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block break-words text-sm font-semibold text-slate-900">
                                {activeAxes
                                  .map((axis) => attributes[axis.axis_key])
                                  .filter(Boolean)
                                  .join(" / ")}
                              </span>
                              <span className="mt-1 block break-words text-xs text-slate-500">
                                {activeAxes.map((axis) => `${axis.label}: ${attributes[axis.axis_key]}`).join(" · ")}
                              </span>
                            </span>
                            {exists && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                Existing
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-sky-950">4. Generate selected variations</p>
            <p className="mt-1 text-sm text-sky-800">
              {allCombinations.length
                ? `${allCombinations.length} possible · ${existingKeys.size} existing · ${selectedMissing.length} new selected`
                : "Enter all option values above to build combinations."}
            </p>
            <p className="mt-1 text-xs text-sky-700">
              Only checked new combinations are generated. They start inactive with zero stock so you can safely edit
              SKU, prices, images and stock before activation.
            </p>
          </div>
          <Button type="button" size="lg" onClick={generate} disabled={saving || !selectedMissing.length}>
            <Plus className="mr-2 h-4 w-4" />
            {saving ? "Generating…" : `Generate ${selectedMissing.length || ""} Variations`}
          </Button>
        </div>
      </div>

      {draftOnly && (
        <p className="text-xs text-slate-500">These changes stay as a draft until you save the variation.</p>
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
        active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
      className="w-[80px] min-w-[80px] text-right"
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
    <div className="min-w-[90px] rounded-md bg-slate-50 px-3 py-2 text-right text-sm text-slate-700">{children}</div>
  );
}

function FieldTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{children}</div>;
}

function Th({ children, className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`whitespace-nowrap px-3 py-3 font-semibold ${className ?? ""}`} {...props}>
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`align-top px-3 py-3 ${className ?? ""}`}>{children}</td>;
}

/** Frozen first two columns (Variation + SKU) for wide admin tables. */
const FREEZE_1 = "sticky left-0 z-20 w-[240px] min-w-[240px] max-w-[240px] bg-white";
const FREEZE_2 = "sticky left-[240px] z-20 w-[220px] min-w-[220px] max-w-[220px] bg-white border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)]";

function EmptyVariants() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
      No variants yet. Click <strong>Add Variant</strong> first.
    </div>
  );
}

const SEGMENT_FIELDS = [
  { key: "available_customer", label: "C", title: "Visible to Customers" },
  { key: "available_retailer", label: "R", title: "Visible to Retailers" },
  { key: "available_distributor", label: "D", title: "Visible to Distributors" },
] as const;

/** Simple per-variation availability switches for each buyer type. */
function SegmentToggles({
  row,
  updateRow,
}: {
  row: Variant;
  updateRow: (id: string, patch: Partial<Variant>) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {SEGMENT_FIELDS.map((segment) => {
        const on = row[segment.key] !== false;
        return (
          <button
            key={segment.key}
            type="button"
            title={segment.title}
            aria-label={segment.title}
            aria-pressed={on}
            onClick={() => updateRow(row.id, { [segment.key]: !on } as Partial<Variant>)}
            className={
              "h-7 w-7 rounded-full border text-xs font-semibold transition " +
              (on ? "border-sky-300 bg-sky-100 text-sky-800" : "border-slate-200 bg-white text-slate-400 line-through")
            }
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Retailer / distributor price table. Independent MRP and selling price per
 * account type. Blank private-channel prices remain unset and never inherit customer pricing.
 * Stock is shared and shown read-only here.
 */
function SegmentPriceTable({
  rows,
  updateRow,
  segment,
  editRow,
  removeRow,
}: {
  rows: Variant[];
  updateRow: (id: string, patch: Partial<Variant>) => void;
  segment: PriceSegment;
  editRow: (row: Variant) => void;
  removeRow: (row: Variant) => void;
}) {
  const { label, mrpKey, priceKey, stockKey } = SEGMENT_PRICE_FIELDS[segment];

  const effectiveMrp = (row: Variant) => Number((row[mrpKey] as number | null) ?? 0);

  const changeMrp = (row: Variant, raw: string) => {
    if (raw === "") {
      updateRow(row.id, { [mrpKey]: null } as Partial<Variant>);
      return;
    }
    const mrp = Number(raw);
    if (!Number.isFinite(mrp) || mrp < 0) return;
    const patch: Record<string, unknown> = { [mrpKey]: mrp };
    const discount = segmentDiscount(row, segment);
    if (discount > 0) patch[priceKey] = roundMoney(mrp - (mrp * discount) / 100);
    updateRow(row.id, patch as Partial<Variant>);
  };

  const changeDiscount = (row: Variant, raw: string) => {
    if (raw === "") {
      if (segment === "customer") updateRow(row.id, { discount_pct: 0 });
      return;
    }
    const entered = Number(raw);
    if (!Number.isFinite(entered)) return;
    const discount = clampPct(entered);
    const mrp = effectiveMrp(row);
    const patch: Record<string, unknown> = {};
    if (segment === "customer") patch.discount_pct = discount;
    if (mrp > 0) patch[priceKey] = roundMoney(mrp - (mrp * discount) / 100);
    if (!Object.keys(patch).length) return;
    updateRow(row.id, patch as Partial<Variant>);
  };

  const changePrice = (row: Variant, raw: string) => {
    if (raw === "") {
      updateRow(row.id, { [priceKey]: null } as Partial<Variant>);
      return;
    }
    const price = Number(raw);
    if (!Number.isFinite(price) || price < 0) return;
    const patch: Record<string, unknown> = { [priceKey]: price };
    const mrp = effectiveMrp(row);
    if (segment === "customer" && mrp > 0) {
      patch.discount_pct = Number(clampPct(((mrp - price) / mrp) * 100).toFixed(2));
    }
    updateRow(row.id, patch as Partial<Variant>);
  };

  const changeStock = (row: Variant, raw: string) => {
    if (raw === "") {
      updateRow(row.id, { [stockKey]: null } as Partial<Variant>);
      return;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) return;
    updateRow(row.id, { [stockKey]: value } as Partial<Variant>);
  };

  const copyDown = (index: number, build: (source: Variant, target: Variant) => Partial<Variant>) => {
    const source = rows[index];
    if (!source) return;
    for (const row of rows.slice(index + 1)) updateRow(row.id, build(source, row));
    toast.success("Copied to all variations below.");
  };

  const CopyButton = ({ title, onClick, visible }: { title: string; onClick: () => void; visible: boolean }) =>
    visible ? (
      <button
        type="button"
        title={title}
        aria-label={title}
        onClick={onClick}
        className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    ) : null;

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{label} Price &amp; Stock</h2>
          <p className="mt-1 text-xs text-slate-500">
            {segment === "customer"
              ? "Prices shown on the public website. Retailer and distributor pricing is never changed from here."
              : `Only approved ${label.toLowerCase()} accounts see these prices. These values are independent from customer pricing; a blank field remains unset. Customer pricing is never changed from here.`}{" "}
            Weight and dimensions are managed in the Weight &amp; Dimensions tab, and commission in the Commission
            section.
          </p>
        </div>

        <BulkPriceByOption rows={rows} updateRow={updateRow} segment={segment} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950">{label} Product Variations</h3>
            <div className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
              {rows.length} Variation{rows.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <div className="scrollbar-visible max-h-[70vh] overflow-auto overscroll-contain" tabIndex={0} role="region" aria-label={`${label} price and stock table`}>
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead className="sticky top-0 z-30 bg-white shadow-sm">
              <tr className="border-b border-slate-200 bg-white text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Th className={FREEZE_1}>Variation</Th>
                <Th className={FREEZE_2}>SKU</Th>
                <Th>MRP</Th>
                <Th>Discount %</Th>
                <Th>Price</Th>
                <Th>Stock</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const hasRowsBelow = index < rows.length - 1;
                const discount = segmentDiscount(row, segment);
                return (
                  <tr key={row.id} className="border-t border-slate-200 align-middle transition-colors hover:bg-slate-50/70">
                    <Td className={FREEZE_1}>
                      <div className="min-w-[210px] max-w-[280px]">
                        <VariantIdentity row={row} />
                      </div>
                    </Td>
                    <Td className={FREEZE_2}>
                      <div className="min-w-[180px] max-w-[250px] break-all font-mono text-xs font-medium text-slate-700">
                        {row.sku}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex min-w-[105px] items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={(row[mrpKey] as number | null) ?? ""}
                          placeholder={`${label} MRP`}
                          onChange={(event) => changeMrp(row, event.target.value)}
                          className="h-9 w-[72px] min-w-[72px] px-2 text-xs"
                        />
                        <CopyButton
                          visible={hasRowsBelow}
                          title="Copy MRP to all rows below"
                          onClick={() =>
                            copyDown(index, (source) => ({ [mrpKey]: source[mrpKey] }) as Partial<Variant>)
                          }
                        />
                      </div>
                    </Td>
                    <Td>
                      <div className="flex min-w-[112px] items-center gap-1">
                        <div className="relative w-[76px] min-w-[76px]">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            inputMode="decimal"
                            value={segment === "customer" ? (row.discount_pct ?? 0) : discount || ""}
                            placeholder="0.00"
                            onChange={(event) => changeDiscount(row, event.target.value)}
                            className="h-9 px-2 pr-6 text-xs"
                          />
                          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                            %
                          </span>
                        </div>
                        <CopyButton
                          visible={hasRowsBelow}
                          title="Copy discount to all rows below"
                          onClick={() =>
                            copyDown(index, (source, target) => {
                              const pct = segmentDiscount(source, segment);
                              const mrp = Number(
                                (target[mrpKey] as number | null) ?? 0,
                              );
                              const patch: Record<string, unknown> = {};
                              if (segment === "customer") patch.discount_pct = pct;
                              if (mrp > 0) patch[priceKey] = roundMoney(mrp - (mrp * pct) / 100);
                              return patch as Partial<Variant>;
                            })
                          }
                        />
                      </div>
                    </Td>
                    <Td>
                      <div className="flex min-w-[125px] items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={(row[priceKey] as number | null) ?? ""}
                          placeholder={`${label} Price`}
                          onChange={(event) => changePrice(row, event.target.value)}
                          className="h-9 w-[88px] min-w-[88px]"
                        />
                        <CopyButton
                          visible={hasRowsBelow}
                          title="Copy price to all rows below"
                          onClick={() =>
                            copyDown(index, (source) => ({ [priceKey]: source[priceKey] }) as Partial<Variant>)
                          }
                        />
                      </div>
                    </Td>
                    <Td>
                      <div className="flex min-w-[92px] items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          value={(row[stockKey] as number | null) ?? ""}
                          placeholder="0"
                          onChange={(event) => changeStock(row, event.target.value)}
                          className="h-9 w-[60px] min-w-[60px] px-2 text-xs"
                        />
                        <CopyButton
                          visible={hasRowsBelow}
                          title="Copy stock to all rows below"
                          onClick={() => copyDown(index, (source) => ({ [stockKey]: source[stockKey] }) as Partial<Variant>)}
                        />
                      </div>
                    </Td>
                    <Td>
                      <div className="flex min-w-[150px] items-center gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => editRow(row)}>
                          <Pencil className="h-4 w-4" /> Edit
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          aria-label={`Delete variation ${row.sku}`}
                          title="Delete variation"
                          onClick={() => removeRow(row)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Stock belongs to the SKU and is shared by customer, retailer and distributor accounts.
          {segment === "customer" ? "" : " Blank private-channel price or MRP remains unset and does not inherit customer pricing."}
        </div>
      </section>
    </div>
  );
}
