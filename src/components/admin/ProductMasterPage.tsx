import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { createProductMasterExport, productMasterExportRows } from "@/lib/product-master-export";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Columns3,
  Copy,
  Download,
  ExternalLink,
  ImageIcon,
  Minus,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRealtime } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import {
  adminAdjustInventory,
  adminExportProductMasterRows,
  adminBulkProductFamilyAction,
  adminDeleteProductFamilyPermanent,
  adminDeleteProductVariantPermanent,
  adminDuplicateProductFamily,
  adminListProductMaster,
  adminSaveProductMasterRows,
  adminSetProductVariantState,
} from "@/lib/catalog-admin.functions";

type Variant = {
  id: string;
  family_id: string;
  sku: string;
  barcode: string;
  attributes: Record<string, string>;
  mrp: number | null;
  price: number | null;
  discount_pct: number | null;
  retailer_mrp: number | null;
  retailer_price: number | null;
  retailer_discount_pct: number | null;
  retailer_stock: number | null;
  retailer_pack_size: number | null;
  distributor_mrp: number | null;
  distributor_price: number | null;
  distributor_discount_pct: number | null;
  distributor_stock: number | null;
  distributor_pack_size: number | null;
  moq: number | null;
  retailer_moq: number | null;
  distributor_moq: number | null;
  stock: number;
  reserved_stock: number;
  pack_size: number | null;
  weight_g: number | null;
  dim_l: number | null;
  dim_w: number | null;
  dim_h: number | null;
  pack_weight_g: number | null;
  pack_l: number | null;
  pack_w: number | null;
  pack_h: number | null;
  retailer_pack_weight_g: number | null;
  retailer_pack_l: number | null;
  retailer_pack_w: number | null;
  retailer_pack_h: number | null;
  distributor_pack_weight_g: number | null;
  distributor_pack_l: number | null;
  distributor_pack_w: number | null;
  distributor_pack_h: number | null;
  is_active: boolean;
  available_customer: boolean;
  available_retailer: boolean;
  available_distributor: boolean;
  archived_at: string | null;
  low_stock_threshold: number;
  sort_order: number;
  updated_at: string;
};

type Axis = {
  id: string;
  family_id: string;
  axis_key: string;
  label: string;
  values: string[];
  sort_order: number;
};

type Image = {
  id: string;
  family_id: string;
  variant_sku: string | null;
  image_url: string;
  alt_text: string | null;
  is_primary: boolean;
  sort_order: number;
};

type Family = {
  id: string;
  legacy_product_id: string | null;
  name: string;
  main_sku: string;
  slug: string;
  brand: string;
  category_id: string | null;
  model: string | null;
  wattage: string | null;
  color_temp: string | null;
  size: string | null;
  body_type: string | null;
  is_published: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  archived_at: string | null;
  updated_at: string;
  total_stock: number;
  min_price: number | null;
  max_price: number | null;
  min_mrp: number | null;
  max_mrp: number | null;
  categories: { id: string; name: string } | { id: string; name: string }[] | null;
  variants: Variant[];
  axes: Axis[];
  images: Image[];
};

type EditableKey =
  | "sku"
  | "barcode"
  | "mrp"
  | "price"
  | "retailer_price"
  | "distributor_price"
  | "pack_size"
  | "moq"
  | "retailer_moq"
  | "distributor_moq"
  | "weight_g"
  | "dim_l"
  | "dim_w"
  | "dim_h"
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
  | "distributor_pack_h"
  | "low_stock_threshold"
  | "is_active"
  | "available_customer"
  | "available_retailer"
  | "available_distributor"
  | "attributes";

type Drafts = Record<string, Partial<Pick<Variant, EditableKey>>>;
type Preset = "essential" | "pricing" | "inventory" | "variations" | "shipping" | "all";
type Column = { key: string; label: string; width: number };

const DRAFT_KEY = "aurona-product-master-draft-v1";
const COLUMN_KEY = "aurona-product-master-columns-v1";
const PAGE_SIZE = 20;

const BASE_COLUMNS: Column[] = [
  { key: "image", label: "Image", width: 68 },
  { key: "family", label: "Family / Product", width: 230 },
  { key: "sku", label: "Variant SKU", width: 180 },
  { key: "barcode", label: "Barcode / GTIN", width: 150 },
  { key: "mrp", label: "MRP", width: 110 },
  { key: "price", label: "Customer", width: 110 },
  { key: "discount", label: "Customer %", width: 100 },
  { key: "retailer_price", label: "Retailer", width: 110 },
  { key: "retailer_margin", label: "Retailer %", width: 100 },
  { key: "distributor_price", label: "Distributor", width: 120 },
  { key: "distributor_margin", label: "Distributor %", width: 110 },
  { key: "pack_size", label: "Units / Pack", width: 105 },
  { key: "moq", label: "Customer MOQ", width: 110 },
  { key: "retailer_moq", label: "Retailer MOQ", width: 110 },
  { key: "distributor_moq", label: "Distributor MOQ", width: 125 },
  { key: "stock", label: "Available Stock", width: 120 },
  { key: "low_stock_threshold", label: "Low Stock", width: 100 },
  { key: "weight_g", label: "Unit Weight g", width: 115 },
  { key: "dim_l", label: "Unit L cm", width: 100 },
  { key: "dim_w", label: "Unit W cm", width: 100 },
  { key: "dim_h", label: "Unit H cm", width: 100 },
  { key: "pack_weight_g", label: "Pack Weight g", width: 120 },
  { key: "pack_l", label: "Pack L cm", width: 100 },
  { key: "pack_w", label: "Pack W cm", width: 100 },
  { key: "pack_h", label: "Pack H cm", width: 100 },
  { key: "retailer_pack_weight_g", label: "Retailer Pack Weight g", width: 145 },
  { key: "retailer_pack_l", label: "Retailer Pack L cm", width: 130 },
  { key: "retailer_pack_w", label: "Retailer Pack W cm", width: 130 },
  { key: "retailer_pack_h", label: "Retailer Pack H cm", width: 130 },
  { key: "distributor_pack_weight_g", label: "Distributor Pack Weight g", width: 165 },
  { key: "distributor_pack_l", label: "Distributor Pack L cm", width: 150 },
  { key: "distributor_pack_w", label: "Distributor Pack W cm", width: 150 },
  { key: "distributor_pack_h", label: "Distributor Pack H cm", width: 150 },
  { key: "status", label: "Status", width: 105 },
  { key: "available_for", label: "Available For", width: 150 },
  { key: "actions", label: "Actions", width: 220 },
];

const PRESETS: Record<Preset, string[]> = {
  essential: [
    "image",
    "family",
    "sku",
    "mrp",
    "price",
    "retailer_price",
    "distributor_price",
    "pack_size",
    "stock",
    "status",
    "available_for",
    "actions",
  ],
  pricing: [
    "family",
    "sku",
    "mrp",
    "price",
    "discount",
    "retailer_price",
    "retailer_margin",
    "distributor_price",
    "distributor_margin",
    "pack_size",
    "moq",
    "retailer_moq",
    "distributor_moq",
    "actions",
  ],
  inventory: [
    "family",
    "sku",
    "pack_size",
    "stock",
    "low_stock_threshold",
    "status",
    "available_for",
    "actions",
  ],
  variations: [
    "image",
    "family",
    "sku",
    "barcode",
    "attributes",
    "mrp",
    "price",
    "discount",
    "pack_size",
    "stock",
    "status",
    "available_for",
    "actions",
  ],
  shipping: [
    "family",
    "sku",
    "weight_g",
    "dim_l",
    "dim_w",
    "dim_h",
    "pack_weight_g",
    "pack_l",
    "pack_w",
    "pack_h",
    "retailer_pack_weight_g",
    "retailer_pack_l",
    "retailer_pack_w",
    "retailer_pack_h",
    "distributor_pack_weight_g",
    "distributor_pack_l",
    "distributor_pack_w",
    "distributor_pack_h",
    "actions",
  ],
  all: [...BASE_COLUMNS.map((column) => column.key), "attributes"],
};

const numberKeys = new Set<EditableKey>([
  "mrp",
  "price",
  "retailer_price",
  "distributor_price",
  "pack_size",
  "moq",
  "retailer_moq",
  "distributor_moq",
  "weight_g",
  "dim_l",
  "dim_w",
  "dim_h",
  "pack_weight_g",
  "pack_l",
  "pack_w",
  "pack_h",
  "retailer_pack_weight_g",
  "retailer_pack_l",
  "retailer_pack_w",
  "retailer_pack_h",
  "distributor_pack_weight_g",
  "distributor_pack_l",
  "distributor_pack_w",
  "distributor_pack_h",
  "low_stock_threshold",
]);

const categoryOf = (family: Family) =>
  Array.isArray(family.categories) ? family.categories[0]?.name : family.categories?.name;

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

const discount = (mrp: number | null, price: number | null) => {
  const base = Number(mrp ?? 0);
  const current = Number(price ?? 0);
  return base > 0 && current < base ? ((base - current) / base) * 100 : 0;
};

const moneyRange = (minimum: number | null, maximum: number | null) => {
  if (minimum == null && maximum == null) return "—";
  if (minimum == null || maximum == null || Number(minimum) === Number(maximum)) return money(minimum ?? maximum);
  return `${money(minimum)} – ${money(maximum)}`;
};

export function ProductMaster() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [publication, setPublication] = useState<"all" | "published" | "hidden" | "archived">(
    "all",
  );
  const [stock, setStock] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");
  const [sort, setSort] = useState<"updated" | "name" | "sku" | "stock_low" | "stock_high">(
    "updated",
  );
  const [missingDimensions, setMissingDimensions] = useState(false);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Drafts>({});
  const [saving, setSaving] = useState(false);
  const [preset, setPreset] = useState<Preset>("essential");
  const [templateMode, setTemplateMode] = useState(true);
  const [visible, setVisible] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set(PRESETS.essential);
    try {
      const stored = JSON.parse(localStorage.getItem(COLUMN_KEY) ?? "null");
      if (Array.isArray(stored)) {
        const next = new Set<string>(stored);
        if (next.has("status")) next.add("available_for");
        return next;
      }
      return new Set(PRESETS.essential);
    } catch {
      return new Set(PRESETS.essential);
    }
  });
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [bulkField, setBulkField] = useState<
    "price" | "retailer_price" | "distributor_price" | "mrp" | "pack_size" | "weight_g"
  >("price");
  const [bulkOperation, setBulkOperation] = useState<
    "set" | "increase_percent" | "increase_fixed" | "decrease_percent" | "decrease_fixed"
  >(
    "set",
  );
  const [bulkValue, setBulkValue] = useState("");
  const [adjusting, setAdjusting] = useState<Variant | null>(null);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const draftLoaded = useRef(false);
  const draftCleared = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const categories = useQuery({
    queryKey: ["admin-categories-list"],
    queryFn: async () =>
      (await supabase.from("categories").select("id,name").order("name")).data ?? [],
  });

  const q = useQuery({
    queryKey: ["admin-product-master", debouncedSearch, categoryId, publication, stock, sort, page],
    queryFn: () =>
      adminListProductMaster({
        data: {
          search: debouncedSearch,
          categoryId: categoryId || null,
          publication,
          stock,
          sort,
          page,
          pageSize: PAGE_SIZE,
        },
      }) as Promise<{ families: Family[]; count: number; commissions: Record<string, unknown>[]; programs: Record<string, unknown>[] }>,
  });

  const families = useMemo(() => q.data?.families ?? [], [q.data]);
  const allVariants = useMemo(() => families.flatMap((family) => family.variants), [families]);
  const shownFamilies = useMemo(
    () =>
      missingDimensions
        ? families
            .map((family) => ({
              ...family,
              variants: family.variants.filter(
                (variant) =>
                  variant.weight_g == null ||
                  variant.dim_l == null ||
                  variant.dim_w == null ||
                  variant.dim_h == null ||
                  variant.pack_weight_g == null ||
                  variant.pack_l == null ||
                  variant.pack_w == null ||
                  variant.pack_h == null,
              ),
            }))
            .filter((family) => family.variants.length)
        : families,
    [families, missingDimensions],
  );

  const templateGrid = useMemo(() => productMasterExportRows({
    families: shownFamilies,
    commissions: q.data?.commissions ?? [],
    programs: q.data?.programs ?? [],
  }), [shownFamilies, q.data?.commissions, q.data?.programs]);

  const attributeColumns = useMemo<Column[]>(() => {
    const labels = new Map<string, string>();
    for (const family of families) {
      for (const axis of family.axes) labels.set(axis.axis_key, axis.label);
    }
    return [...labels].map(([key, label]) => ({ key: `attr:${key}`, label, width: 130 }));
  }, [families]);
  const columns = useMemo(() => {
    const base = BASE_COLUMNS.flatMap((column) =>
      column.key === "barcode" ? [column, ...attributeColumns] : [column],
    );
    return base.filter(
      (column) =>
        visible.has(column.key) || (visible.has("attributes") && column.key.startsWith("attr:")),
    );
  }, [attributeColumns, visible]);

  useRealtime(
    ["product_families", "product_variants", "product_images", "inventory_ledger"],
    () => {
      if (!Object.keys(drafts).length) void q.refetch();
    },
  );

  useEffect(() => {
    if (!q.data || draftLoaded.current) return;
    draftLoaded.current = true;
    try {
      const stored = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as {
        edits?: Drafts;
        versions?: Record<string, string>;
      } | null;
      if (!stored?.edits) return;
      const safe: Drafts = {};
      let stale = 0;
      for (const [id, patch] of Object.entries(stored.edits)) {
        const server = allVariants.find((variant) => variant.id === id);
        if (!server) continue;
        if (stored.versions?.[id] && stored.versions[id] !== server.updated_at) stale += 1;
        else safe[id] = patch;
      }
      if (Object.keys(safe).length) {
        setDrafts(safe);
        toast.info(`${Object.keys(safe).length} unsaved Product Master row(s) restored`);
      }
      if (stale)
        toast.warning(`${stale} stale draft row(s) were not restored because server data changed`);
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [allVariants, q.data]);

  useEffect(() => {
    if (draftCleared.current) return;
    const ids = Object.keys(drafts);
    if (!ids.length) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    const timer = window.setTimeout(() => {
      const versions = Object.fromEntries(
        ids.map((id) => [id, allVariants.find((variant) => variant.id === id)?.updated_at ?? ""]),
      );
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ edits: drafts, versions, savedAt: new Date().toISOString() }),
      );
    }, 350);
    return () => window.clearTimeout(timer);
  }, [allVariants, drafts]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!Object.keys(drafts).length) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [drafts]);

  useEffect(() => {
    localStorage.setItem(COLUMN_KEY, JSON.stringify([...visible]));
  }, [visible]);

  const effective = (variant: Variant): Variant => ({ ...variant, ...(drafts[variant.id] ?? {}) });
  const change = (variant: Variant, key: EditableKey, value: unknown) => {
    draftCleared.current = false;
    setDrafts((current) => ({
      ...current,
      [variant.id]: { ...(current[variant.id] ?? {}), [key]: value },
    }));
  };
  const revertCell = (variantId: string, key: EditableKey) => {
    setDrafts((current) => {
      const patch = { ...(current[variantId] ?? {}) };
      delete patch[key];
      const next = { ...current };
      if (Object.keys(patch).length) next[variantId] = patch;
      else delete next[variantId];
      return next;
    });
  };

  const variantPayload = (variant: Variant) => ({
    id: variant.id,
    sku: variant.sku.trim(),
    barcode: variant.barcode?.trim() ?? "",
    attributes: variant.attributes ?? {},
    mrp: variant.mrp,
    price: variant.price,
    discount_pct: discount(variant.mrp, variant.price),
    retailer_mrp: variant.retailer_mrp,
    retailer_price: variant.retailer_price,
    retailer_discount_pct: variant.retailer_discount_pct,
    retailer_stock: variant.retailer_stock,
    retailer_pack_size: variant.retailer_pack_size,
    distributor_mrp: variant.distributor_mrp,
    distributor_price: variant.distributor_price,
    distributor_discount_pct: variant.distributor_discount_pct,
    distributor_stock: variant.distributor_stock,
    distributor_pack_size: variant.distributor_pack_size,
    moq: variant.moq,
    retailer_moq: variant.retailer_moq,
    distributor_moq: variant.distributor_moq,
    stock: variant.stock,
    pack_size: variant.pack_size,
    weight_g: variant.weight_g,
    dim_l: variant.dim_l,
    dim_w: variant.dim_w,
    dim_h: variant.dim_h,
    pack_weight_g: variant.pack_weight_g,
    pack_l: variant.pack_l,
    pack_w: variant.pack_w,
    pack_h: variant.pack_h,
    retailer_pack_weight_g: variant.retailer_pack_weight_g,
    retailer_pack_l: variant.retailer_pack_l,
    retailer_pack_w: variant.retailer_pack_w,
    retailer_pack_h: variant.retailer_pack_h,
    distributor_pack_weight_g: variant.distributor_pack_weight_g,
    distributor_pack_l: variant.distributor_pack_l,
    distributor_pack_w: variant.distributor_pack_w,
    distributor_pack_h: variant.distributor_pack_h,
    is_active: variant.is_active,
    sort_order: variant.sort_order,
    low_stock_threshold: variant.low_stock_threshold ?? 10,
    available_customer: variant.available_customer !== false,
    available_retailer: variant.available_retailer !== false,
    available_distributor: variant.available_distributor !== false,
  });

  const saveIds = async (ids: string[]) => {
    const dirtyIds = ids.filter((id) => drafts[id]);
    if (!dirtyIds.length) return toast.info("No unsaved changes selected");
    const familyIds = [
      ...new Set(
        dirtyIds.map((id) => allVariants.find((row) => row.id === id)?.family_id).filter(Boolean),
      ),
    ] as string[];
    setSaving(true);
    try {
      const result = await adminSaveProductMasterRows({
        data: {
          families: familyIds.map((familyId) => {
            const family = families.find((item) => item.id === familyId)!;
            return {
              familyId,
              variants: family.variants
                .filter((variant) => !variant.archived_at)
                .map((variant) => variantPayload(effective(variant))),
              axes: family.axes.map((axis) => ({
                axis_key: axis.axis_key,
                label: axis.label,
                values: Array.isArray(axis.values) ? axis.values : [],
                sort_order: axis.sort_order,
              })),
            };
          }),
        },
      });
      const savedVariantIds = families
        .filter((family) => familyIds.includes(family.id))
        .flatMap((family) => family.variants.filter((variant) => !variant.archived_at).map((variant) => variant.id));
      setDrafts((current) => {
        const next = { ...current };
        for (const id of savedVariantIds) delete next[id];
        return next;
      });
      setSelected(new Set());
      toast.success(
        result.compatibility_mode
          ? "Prices, dimensions and variations saved; barcode needs the parity migration"
          : "Product Master changes saved",
      );
      await q.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save Product Master changes");
    } finally {
      setSaving(false);
    }
  };

  const discardAll = () => {
    if (!Object.keys(drafts).length || !confirm("Discard all unsaved Product Master changes?"))
      return;
    draftCleared.current = true;
    localStorage.removeItem(DRAFT_KEY);
    setDrafts({});
    toast.success("Unsaved changes discarded");
  };

  const applyPreset = (next: Preset) => {
    setPreset(next);
    setTemplateMode(false);
    setVisible(new Set(PRESETS[next]));
  };

  const applyBulk = () => {
    const amount = Number(bulkValue);
    if (!selected.size || !Number.isFinite(amount) || amount < 0)
      return toast.error("Select SKUs and enter a valid value");
    const compute = (before: number) => {
      const next =
        bulkOperation === "set"
          ? amount
          : bulkOperation === "increase_percent"
            ? before * (1 + amount / 100)
            : bulkOperation === "decrease_percent"
              ? before * (1 - amount / 100)
              : bulkOperation === "decrease_fixed"
                ? before - amount
                : before + amount;
      return Math.max(0, Number(next.toFixed(2)));
    };
    const preview = [...selected].slice(0, 3).map((id) => {
      const row = allVariants.find((variant) => variant.id === id)!;
      const before = Number(effective(row)[bulkField] ?? 0);
      return `${row.sku}: ${before} → ${compute(before)}`;
    });
    if (
      !confirm(
        `Apply to ${selected.size} SKU(s)?\n\n${preview.join("\n")}${selected.size > 3 ? "\n…" : ""}`,
      )
    )
      return;
    for (const id of selected) {
      const row = allVariants.find((variant) => variant.id === id);
      if (!row) continue;
      const before = Number(effective(row)[bulkField] ?? 0);
      change(row, bulkField, compute(before));
    }
    toast.success("Bulk changes staged. Review, then Save Selected.");
  };


  const adjustStock = async () => {
    if (
      !adjusting ||
      !Number.isInteger(Number(delta)) ||
      Number(delta) === 0 ||
      reason.trim().length < 3
    ) {
      return toast.error("Enter a non-zero whole-number adjustment and a reason");
    }
    setSaving(true);
    try {
      await adminAdjustInventory({
        data: { variantId: adjusting.id, delta: Number(delta), reason: reason.trim() },
      });
      toast.success(`Stock adjusted for ${adjusting.sku}`);
      setAdjusting(null);
      setDelta("");
      setReason("");
      await q.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not adjust inventory");
    } finally {
      setSaving(false);
    }
  };

  const setFamilyState = async (
    family: Family,
    action: "publish" | "unpublish" | "archive" | "restore",
  ) => {
    if (
      action === "archive" &&
      !confirm(`Archive ${family.name}? Existing SKUs and orders are preserved.`)
    )
      return;
    try {
      await adminBulkProductFamilyAction({ data: { familyIds: [family.id], action } });
      toast.success(`${family.name} updated`);
      await q.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update family status");
    }
  };

  const deleteFamilyPermanently = async (family: Family) => {
    if (!family.archived_at) {
      toast.error("Archive this product before deleting it permanently.");
      return;
    }
    const confirmed = window.confirm(
      `Permanently delete "${family.name}" and its ${family.variants.length} SKU/variant record(s)?\n\nThis cannot be undone. Existing order history will be preserved as a snapshot.`,
    );
    if (!confirmed) return;
    try {
      await adminDeleteProductFamilyPermanent({ data: { familyId: family.id } });
      toast.success(`${family.name} permanently deleted`);
      setSelected((current) => {
        const next = new Set(current);
        for (const variant of family.variants) next.delete(variant.id);
        return next;
      });
      setExpanded((current) => {
        const next = new Set(current);
        next.delete(family.id);
        return next;
      });
      await q.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not permanently delete product");
    }
  };

  const duplicateFamily = async (family: Family) => {
    if (!window.confirm(`Duplicate "${family.name}" with its current product data and SKU structure?`)) return;
    try {
      const result = await adminDuplicateProductFamily({ data: { familyId: family.id } });
      toast.success(`${family.name} duplicated`);
      await q.refetch();
      if (result?.product_id) {
        window.location.assign(`/aurona-console-9f2x7k/products/${result.product_id}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not duplicate product");
    }
  };

  const setVariantState = async (variant: Variant, action: "archive" | "restore") => {
    if (
      action === "archive" &&
      !window.confirm(`Archive SKU ${variant.sku}? Its data will be kept and it can be restored.`)
    ) return;
    try {
      await adminSetProductVariantState({ data: { variantId: variant.id, action } });
      toast.success(`${variant.sku} ${action === "archive" ? "archived" : "restored"}`);
      await q.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not ${action} variant`);
    }
  };

  const deleteVariantPermanently = async (variant: Variant) => {
    if (!variant.archived_at) {
      toast.error("Archive this SKU before deleting it permanently.");
      return;
    }
    if (!window.confirm(
      `Permanently delete SKU ${variant.sku}?\n\nThis cannot be undone. The product and sibling SKUs will remain unchanged.`,
    )) return;
    try {
      await adminDeleteProductVariantPermanent({ data: { variantId: variant.id } });
      toast.success(`${variant.sku} permanently deleted`);
      setSelected((current) => {
        const next = new Set(current);
        next.delete(variant.id);
        return next;
      });
      await q.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not permanently delete variant");
    }
  };

  const exportView = async () => {
    if (!categoryId) {
      toast.error("Please select a category to export.");
      return;
    }
    try {
      const result = await adminExportProductMasterRows({
        data: { categoryId },
      });
      if (!result.families.some((family) => family.variants.length)) {
        toast.error("No product variants found in this category to export.");
        return;
      }
      const bytes = await createProductMasterExport(result);
      const blob = new Blob([bytes as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `aurona-product-master-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export Product Master");
    }
  };
  return (
    <div className="min-w-0 space-y-4 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
            <PackageSearch className="h-4 w-4" /> Catalog control centre
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Product Master</h1>
          <p className="mt-1 text-sm text-slate-500">
            Families, SKUs, private channel pricing, packs, dimensions and status in one editable
            grid.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportView}>
            <Download className="h-4 w-4" /> Export view
          </Button>
          <Button
            variant={publication === "archived" ? "default" : "outline"}
            onClick={() => {
              const showArchived = publication !== "archived";
              setPublication(showArchived ? "archived" : "all");
              if (showArchived) {
                setCategoryId("");
                setSearch("");
                setDebouncedSearch("");
                setStock("all");
                setMissingDimensions(false);
              }
              setPage(0);
              setSelected(new Set());
            }}
          >
            <Archive className="h-4 w-4" /> {publication === "archived" ? "Back to products" : "Archive"}
          </Button>
          <Button variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" onClick={discardAll} disabled={!Object.keys(drafts).length}>
            <Undo2 className="h-4 w-4" /> Discard
          </Button>
          <Button
            onClick={() => saveIds(Object.keys(drafts))}
            disabled={saving || !Object.keys(drafts).length}
          >
            <Save className="h-4 w-4" />{" "}
            {saving ? "Saving…" : `Save all (${Object.keys(drafts).length})`}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(260px,2fr)_repeat(5,minmax(145px,1fr))]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Product, family SKU, variant SKU, brand, model…"
            />
          </div>
          <select
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setPage(0);
            }}
            aria-label="Category"
          >
            <option value="">All categories</option>
            {(categories.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
            value={publication}
            onChange={(event) => {
              setPublication(event.target.value as typeof publication);
              setPage(0);
            }}
            aria-label="Publication"
          >
            <option value="all">Active + hidden</option>
            <option value="published">Published</option>
            <option value="hidden">Hidden</option>
            <option value="archived">Archived</option>
          </select>
          <select
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
            value={stock}
            onChange={(event) => {
              setStock(event.target.value as typeof stock);
              setPage(0);
            }}
            aria-label="Stock"
          >
            <option value="all">All stock</option>
            <option value="in_stock">In stock</option>
            <option value="low_stock">Low stock</option>
            <option value="out_of_stock">Out of stock</option>
          </select>
          <select
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
            aria-label="Sort"
          >
            <option value="updated">Recently updated</option>
            <option value="name">Family name</option>
            <option value="sku">Family SKU</option>
            <option value="stock_low">Stock low–high</option>
            <option value="stock_high">Stock high–low</option>
          </select>
          <Button
            variant={missingDimensions ? "default" : "outline"}
            onClick={() => setMissingDimensions((value) => !value)}
          >
            <SlidersHorizontal className="h-4 w-4" /> Missing dimensions
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">View</span>
          <Button size="sm" variant={templateMode ? "default" : "outline"} onClick={() => setTemplateMode(true)}>
            Excel columns (1–{templateGrid.columns.length})
          </Button>
          <Button size="sm" variant={!templateMode ? "default" : "outline"} onClick={() => setTemplateMode(false)}>
            Edit grid
          </Button>
          {(["essential", "pricing", "inventory", "variations", "shipping", "all"] as Preset[]).map(
            (item) => (
              <Button
                key={item}
                size="sm"
                variant={preset === item ? "default" : "outline"}
                onClick={() => applyPreset(item)}
                className="capitalize"
              >
                {item}
              </Button>
            ),
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(new Set(shownFamilies.map((family) => family.id)))}
          >
            Expand all
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setExpanded(new Set())}>
            Collapse all
          </Button>
          <details className="relative ml-auto">
            <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold hover:bg-slate-50">
              <Columns3 className="h-4 w-4" /> Columns
            </summary>
            <div className="absolute right-0 z-40 mt-2 max-h-80 w-64 overflow-auto rounded-xl border bg-white p-3 shadow-xl">
              {[...BASE_COLUMNS, ...attributeColumns]
                .filter((column) => column.key !== "actions")
                .map((column) => (
                  <label
                    key={column.key}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={
                        visible.has(column.key) ||
                        (column.key.startsWith("attr:") && visible.has("attributes"))
                      }
                      onChange={(event) =>
                        setVisible((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(column.key);
                          else {
                            next.delete(column.key);
                            if (column.key.startsWith("attr:")) next.delete("attributes");
                          }
                          next.add("actions");
                          return next;
                        })
                      }
                    />{" "}
                    {column.label}
                  </label>
                ))}
            </div>
          </details>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-950 p-3 text-white shadow-lg">
          <strong className="mr-2 text-sm">{selected.size} SKU(s)</strong>
          <select
            className="h-9 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm"
            value={bulkField}
            onChange={(event) => setBulkField(event.target.value as typeof bulkField)}
          >
            <option value="price">Customer price</option>
            <option value="retailer_price">Retailer price</option>
            <option value="distributor_price">Distributor price</option>
            <option value="mrp">MRP</option>
            <option value="pack_size">Pack size</option>
            <option value="weight_g">Unit weight</option>
          </select>
          <select
            className="h-9 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm"
            value={bulkOperation}
            onChange={(event) => setBulkOperation(event.target.value as typeof bulkOperation)}
          >
            <option value="set">Set to</option>
            <option value="increase_percent">Increase %</option>
            <option value="increase_fixed">Increase fixed</option>
            <option value="decrease_percent">Decrease %</option>
            <option value="decrease_fixed">Decrease fixed</option>
          </select>
          <Input
            className="h-9 w-32 border-slate-700 bg-slate-900 text-white"
            type="number"
            min="0"
            step="0.01"
            value={bulkValue}
            onChange={(event) => setBulkValue(event.target.value)}
            placeholder="Value"
          />
          <Button size="sm" variant="secondary" onClick={applyBulk}>
            Preview & stage
          </Button>
          <Button size="sm" onClick={() => saveIds([...selected])} disabled={saving}>
            Save selected
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-slate-800 hover:text-white"
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </Button>
        </div>
      )}

      {q.isError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {q.error instanceof Error ? q.error.message : "Product Master could not be loaded"}
        </div>
      )}

      {templateMode && (
        <div className="scrollbar-visible relative isolate max-h-[calc(100vh-270px)] overflow-auto overscroll-contain rounded-xl border border-slate-200 bg-white shadow-sm" role="region" aria-label="Product Master Excel columns">
          <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-40 bg-slate-100 text-slate-700">
              <tr>{templateGrid.columns.map((column) => (
                <th key={column.key} className="min-w-[130px] max-w-[260px] border-b border-r bg-slate-100 px-3 py-2 text-left align-top font-semibold" title={column.productManagerField}>
                  <span className="block text-[10px] text-sky-700">{column.serial}</span>
                  <span className="whitespace-pre-line">{column.detailHeader || column.topHeader}</span>
                </th>
              ))}</tr>
            </thead>
            <tbody>{templateGrid.rows.map((values, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-sky-50/40">{values.map((value, columnIndex) => (
                <td key={templateGrid.columns[columnIndex].key} className="max-w-[260px] border-b border-r px-3 py-2 align-top" title={String(value ?? "")}>
                  <span className="block max-w-[250px] truncate">{typeof value === "boolean" ? String(value) : value === "" ? "—" : String(value)}</span>
                </td>
              ))}</tr>
            ))}
            {!q.isLoading && !templateGrid.rows.length && <tr><td colSpan={templateGrid.columns.length} className="p-12 text-center text-slate-500">No matching product variants.</td></tr>}
            {q.isLoading && <tr><td colSpan={templateGrid.columns.length} className="p-12 text-center text-slate-500">Loading Product Master…</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {!templateMode && (() => {
        const imageColumn = columns.find((column) => column.key === "image");
        const stickyImageLeft = imageColumn ? 44 : undefined;
        const stickyFamilyLeft =
          44 + (imageColumn ? (widths[imageColumn.key] ?? imageColumn.width) : 0);

        return (
      <div
        className="scrollbar-visible relative isolate max-h-[calc(100vh-270px)] overflow-auto overscroll-contain rounded-xl border border-slate-200 bg-white shadow-sm"
        tabIndex={0}
        role="region"
        aria-label="Product Master table. Scroll horizontally and vertically to view all columns and rows."
      >
        <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
          <colgroup>
            <col style={{ width: 44, minWidth: 44, maxWidth: 44 }} />
            {columns.map((column) => (
              <col key={column.key} style={{ width: widths[column.key] ?? column.width }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-[70] bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
            <tr className="bg-slate-100">
              <th className="sticky left-0 z-[90] w-[44px] min-w-[44px] max-w-[44px] border-b border-r bg-slate-100 p-0 text-center shadow-[0_1px_0_0_rgb(226_232_240)]">
                <input
                  type="checkbox"
                  aria-label="Select visible SKUs"
                  checked={
                    allVariants.length > 0 && allVariants.every((row) => selected.has(row.id))
                  }
                  onChange={(event) =>
                    setSelected(
                      event.target.checked ? new Set(allVariants.map((row) => row.id)) : new Set(),
                    )
                  }
                />
              </th>
              {columns.map((column) => (
                <MasterHead
                  key={column.key}
                  column={column}
                  width={widths[column.key] ?? column.width}
                  stickyLeft={
                    column.key === "image"
                      ? stickyImageLeft
                      : column.key === "family"
                        ? stickyFamilyLeft
                        : undefined
                  }
                  setWidth={(width) =>
                    setWidths((current) => ({ ...current, [column.key]: width }))
                  }
                />
              ))}
            </tr>
          </thead>
          <tbody className="relative z-0">
            {shownFamilies.map((family) => {
              const open = expanded.has(family.id);
              return (
                <FamilyRows
                  key={family.id}
                  family={family}
                  open={open}
                  columns={columns}
                  stickyImageLeft={stickyImageLeft}
                  stickyFamilyLeft={stickyFamilyLeft}
                  selected={selected}
                  drafts={drafts}
                  effective={effective}
                  change={change}
                  revertCell={revertCell}
                  onToggle={() =>
                    setExpanded((current) => {
                      const next = new Set(current);
                      if (next.has(family.id)) next.delete(family.id);
                      else next.add(family.id);
                      return next;
                    })
                  }
                  onSelect={(id) =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                  onSelectFamily={() =>
                    setSelected((current) => {
                      const next = new Set(current);
                      const allSelected = family.variants.every((row) => next.has(row.id));
                      for (const row of family.variants) {
                        if (allSelected) next.delete(row.id);
                        else next.add(row.id);
                      }
                      return next;
                    })
                  }
                  onSave={(id) => saveIds([id])}
                  onAdjust={(row) => {
                    setAdjusting(row);
                    setDelta("");
                    setReason("");
                  }}
                  onState={(action) => setFamilyState(family, action)}
                  onDeletePermanent={() => deleteFamilyPermanently(family)}
                  onDuplicate={() => duplicateFamily(family)}
                  onVariantState={setVariantState}
                  onVariantDeletePermanent={deleteVariantPermanently}
                />
              );
            })}
            {q.isLoading && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="p-12 text-center text-sm text-slate-500"
                >
                  Loading Product Master…
                </td>
              </tr>
            )}
            {!q.isLoading && !q.isError && !shownFamilies.length && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="p-12 text-center text-sm text-slate-500"
                >
                  No matching product families or SKUs.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
        );
      })()}

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          {q.data?.count ?? 0} families · page {page + 1} of{" "}
          {Math.max(1, Math.ceil((q.data?.count ?? 0) / PAGE_SIZE))}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={(page + 1) * PAGE_SIZE >= (q.data?.count ?? 0)}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      {adjusting && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Adjust stock"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-semibold">Adjust stock</h2>
            <p className="mt-1 font-mono text-xs text-slate-500">{adjusting.sku}</p>
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
              Current: <strong>{adjusting.stock}</strong> · Available:{" "}
              <strong>{adjusting.stock - Number(adjusting.reserved_stock ?? 0)}</strong>
            </div>
            <label className="mt-4 block text-sm font-medium">
              Adjustment (+/−)
              <Input
                className="mt-1"
                type="number"
                step="1"
                value={delta}
                onChange={(event) => setDelta(event.target.value)}
                placeholder="Example: 20 or -5"
              />
            </label>
            <label className="mt-3 block text-sm font-medium">
              Reason
              <Input
                className="mt-1"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="New stock received"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAdjusting(null)}>
                Cancel
              </Button>
              <Button onClick={adjustStock} disabled={saving}>
                {saving ? "Saving…" : "Apply adjustment"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MasterHead({
  column,
  width,
  stickyLeft,
  setWidth,
}: {
  column: Column;
  width: number;
  stickyLeft?: number;
  setWidth: (width: number) => void;
}) {
  return (
    <th
      className={`${stickyLeft != null ? "sticky z-[90]" : "relative z-[75]"} border-b border-r bg-slate-100 px-2 py-3 text-left font-semibold shadow-[0_1px_0_0_rgb(226_232_240)]`}
      style={{ width, left: stickyLeft }}
    >
      {column.label}
      <span
        className="absolute inset-y-0 right-0 w-1 cursor-col-resize hover:bg-sky-400"
        onMouseDown={(event) => {
          event.preventDefault();
          const startX = event.clientX;
          const startWidth = width;
          const move = (moveEvent: MouseEvent) =>
            setWidth(Math.max(70, startWidth + moveEvent.clientX - startX));
          const up = () => {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
          };
          window.addEventListener("mousemove", move);
          window.addEventListener("mouseup", up);
        }}
      />
    </th>
  );
}

function FamilyRows({
  family,
  open,
  columns,
  stickyImageLeft,
  stickyFamilyLeft,
  selected,
  drafts,
  effective,
  change,
  revertCell,
  onToggle,
  onSelect,
  onSelectFamily,
  onSave,
  onAdjust,
  onState,
  onDeletePermanent,
  onDuplicate,
  onVariantState,
  onVariantDeletePermanent,
}: {
  family: Family;
  open: boolean;
  columns: Column[];
  stickyImageLeft?: number;
  stickyFamilyLeft: number;
  selected: Set<string>;
  drafts: Drafts;
  effective: (variant: Variant) => Variant;
  change: (variant: Variant, key: EditableKey, value: unknown) => void;
  revertCell: (id: string, key: EditableKey) => void;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onSelectFamily: () => void;
  onSave: (id: string) => void;
  onAdjust: (row: Variant) => void;
  onState: (action: "publish" | "unpublish" | "archive" | "restore") => void;
  onDeletePermanent: () => void;
  onDuplicate: () => void;
  onVariantState: (variant: Variant, action: "archive" | "restore") => void;
  onVariantDeletePermanent: (variant: Variant) => void;
}) {
  const availableVariants = family.variants.filter((variant) => !variant.archived_at);

  return (
    <>
      <tr className="border-b border-slate-200 bg-slate-50/90">
        <td className="sticky left-0 z-20 w-[44px] min-w-[44px] max-w-[44px] border-r bg-slate-50 p-0 text-center">
          <input
            type="checkbox"
            aria-label={`Select ${family.name}`}
            checked={
              family.variants.length > 0 && family.variants.every((row) => selected.has(row.id))
            }
            onChange={onSelectFamily}
          />
        </td>
        {columns.map((column, index) => (
          <td
            key={column.key}
            className={`${column.key === "image" || column.key === "family" ? "sticky z-20 bg-slate-50" : ""} border-r p-2 align-middle`}
            style={{
              left:
                column.key === "image"
                  ? stickyImageLeft
                  : column.key === "family"
                    ? stickyFamilyLeft
                    : undefined,
            }}
          >
            {index === 0 && column.key !== "family" ? null : column.key === "family" ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 text-left"
                onClick={onToggle}
                aria-expanded={open}
              >
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="min-w-0">
                  <strong className="block truncate text-sm text-slate-950">{family.name}</strong>
                  <span className="block truncate font-mono text-[11px] text-slate-500">
                    {family.main_sku} · {family.brand} · {categoryOf(family) ?? "Uncategorised"}
                  </span>
                </span>
              </button>
            ) : column.key === "status" ? (
              <StatusBadge
                active={family.is_published && !family.archived_at}
                label={
                  family.archived_at ? "Archived" : family.is_published ? "Published" : "Hidden"
                }
              />
            ) : column.key === "available_for" ? (
              <div className="flex items-center gap-1">
                {([
                  ["available_customer", "C", "Available to Customers"],
                  ["available_retailer", "R", "Available to Retailers"],
                  ["available_distributor", "D", "Available to Distributors"],
                ] as const).map(([key, label, title]) => {
                  const enabled =
                    availableVariants.length > 0 &&
                    availableVariants.every((variant) => effective(variant)[key] !== false);
                  return (
                    <button
                      key={key}
                      type="button"
                      title={title}
                      aria-label={title}
                      aria-pressed={enabled}
                      disabled={Boolean(family.archived_at) || availableVariants.length === 0}
                      onClick={() => {
                        for (const variant of availableVariants) {
                          change(variant, key, !enabled);
                        }
                      }}
                      className={`h-8 w-8 rounded-md border text-xs font-semibold ${enabled ? "border-sky-300 bg-sky-100 text-sky-800" : "border-slate-200 bg-white text-slate-400 line-through"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : column.key === "stock" ? (
              <strong>{family.total_stock}</strong>
            ) : column.key === "sku" ? (
              <span className="font-mono text-xs">{family.main_sku}</span>
            ) : column.key === "mrp" ? (
              <span className="text-xs font-semibold">{moneyRange(family.min_mrp, family.max_mrp)}</span>
            ) : column.key === "price" ? (
              <span className="text-xs font-semibold">{moneyRange(family.min_price, family.max_price)}</span>
            ) : ["discount", "retailer_price", "retailer_margin", "distributor_price", "distributor_margin", "pack_size", "moq", "retailer_moq", "distributor_moq"].includes(column.key) ? (
              <button type="button" className="text-[11px] font-medium text-sky-700 hover:underline" onClick={onToggle}>
                {open ? "Variant rows below" : "Expand variants"}
              </button>
            ) : column.key === "actions" ? (
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" asChild aria-label="View storefront" title="View storefront">
                  <Link to="/products/$slug" params={{ slug: family.slug }} target="_blank">
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="icon" variant="ghost" asChild aria-label="Edit Product" title="Edit Product">
                  <Link
                    to="/aurona-console-9f2x7k/products/$id"
                    params={{ id: family.legacy_product_id ?? family.id }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="icon" variant="ghost" aria-label="Duplicate product" title="Duplicate product" onClick={onDuplicate}>
                  <Copy className="h-4 w-4" />
                </Button>
                {family.archived_at ? (
                  <>
                    <Button
                      size="icon"
                      variant="success"
                      aria-label="Restore archived product"
                      title="Restore archived product"
                      onClick={() => onState("restore")}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      aria-label="Delete product permanently"
                      title="Delete permanently — cannot be undone"
                      onClick={onDeletePermanent}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={family.is_published ? "Hide family" : "Publish family"}
                      onClick={() => onState(family.is_published ? "unpublish" : "publish")}
                    >
                      {family.is_published ? (
                        <Minus className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Archive product"
                      title="Archive product (can be restored)"
                      onClick={() => onState("archive")}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1 px-2"
                      aria-label="Delete product permanently (archive first)"
                      title="Archive this product first, then delete permanently"
                      onClick={onDeletePermanent}
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  </>
                )}
              </div>
            ) : null}
          </td>
        ))}
      </tr>
      {open &&
        family.variants.map((source) => {
          const row = effective(source);
          const image =
            family.images.find((item) => item.variant_sku === row.sku && item.is_primary) ??
            family.images.find((item) => item.variant_sku === row.sku) ??
            family.images.find((item) => !item.variant_sku && item.is_primary) ??
            family.images[0];
          return (
            <tr
              key={row.id}
              className={`${drafts[row.id] ? "bg-amber-50/70" : "bg-white hover:bg-sky-50/40"} border-b`}
            >
              <td className="sticky left-0 z-10 w-[44px] min-w-[44px] max-w-[44px] border-r bg-inherit p-0 text-center">
                <input
                  type="checkbox"
                  aria-label={`Select ${row.sku}`}
                  checked={selected.has(row.id)}
                  onChange={() => onSelect(row.id)}
                />
              </td>
              {columns.map((column) => (
                <MasterCell
                  key={column.key}
                  column={column}
                  stickyLeft={
                    column.key === "image"
                      ? stickyImageLeft
                      : column.key === "family"
                        ? stickyFamilyLeft
                        : undefined
                  }
                  family={family}
                  source={source}
                  row={row}
                  image={image}
                  dirty={drafts[row.id] ?? {}}
                  change={change}
                  revertCell={revertCell}
                  onSave={() => onSave(row.id)}
                  onAdjust={() => onAdjust(row)}
                  onVariantState={(action) => onVariantState(source, action)}
                  onVariantDeletePermanent={() => onVariantDeletePermanent(source)}
                />
              ))}
            </tr>
          );
        })}
    </>
  );
}

function MasterCell({
  column,
  stickyLeft,
  family,
  source,
  row,
  image,
  dirty,
  change,
  revertCell,
  onSave,
  onAdjust,
  onVariantState,
  onVariantDeletePermanent,
}: {
  column: Column;
  stickyLeft?: number;
  family: Family;
  source: Variant;
  row: Variant;
  image?: Image;
  dirty: Partial<Variant>;
  change: (variant: Variant, key: EditableKey, value: unknown) => void;
  revertCell: (id: string, key: EditableKey) => void;
  onSave: () => void;
  onAdjust: () => void;
  onVariantState: (action: "archive" | "restore") => void;
  onVariantDeletePermanent: () => void;
}) {
  const common = `${stickyLeft != null ? "sticky z-10 bg-white" : ""} border-r p-1.5 align-middle`;
  const stickyStyle = stickyLeft != null ? { left: stickyLeft } : undefined;
  if (column.key === "image")
    return (
      <td className={common} style={stickyStyle}>
        {image ? (
          <img
            src={image.image_url}
            alt={image.alt_text ?? row.sku}
            className="h-10 w-10 rounded-lg border object-cover"
            loading="lazy"
          />
        ) : (
          <span className="grid h-10 w-10 place-items-center rounded-lg border bg-slate-50 text-slate-400">
            <ImageIcon className="h-4 w-4" />
          </span>
        )}
      </td>
    );
  if (column.key === "family")
    return (
      <td className={common} style={stickyStyle}>
        <div className="truncate font-medium text-slate-800">{family.name}</div>
        <div className="truncate text-[10px] text-slate-500">
          {categoryOf(family) ?? "Uncategorised"}
        </div>
      </td>
    );
  if (column.key === "discount")
    return <td className={common} style={stickyStyle}>{discount(row.mrp, row.price).toFixed(2)}%</td>;
  if (column.key === "retailer_margin")
    return <td className={common} style={stickyStyle}>{discount(row.mrp, row.retailer_price).toFixed(2)}%</td>;
  if (column.key === "distributor_margin")
    return <td className={common} style={stickyStyle}>{discount(row.mrp, row.distributor_price).toFixed(2)}%</td>;
  if (column.key === "stock")
    return (
      <td className={common} style={stickyStyle}>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-left hover:bg-sky-100"
          onClick={onAdjust}
        >
          <strong>{row.stock - Number(row.reserved_stock ?? 0)}</strong>
          <span className="block text-[10px] text-slate-500">
            {row.stock} total · {row.reserved_stock ?? 0} reserved
          </span>
        </button>
      </td>
    );
  if (column.key === "status")
    return (
      <td className={common} style={stickyStyle}>
        <button type="button" onClick={() => change(source, "is_active", !row.is_active)} disabled={Boolean(row.archived_at)}>
          <StatusBadge
            active={row.is_active && !row.archived_at}
            label={row.archived_at ? "Archived" : row.is_active ? "Active" : "Inactive"}
          />
        </button>
      </td>
    );
  if (column.key === "available_for")
    return (
      <td className={common} style={stickyStyle}>
        <div className="flex items-center gap-1">
          {([
            ["available_customer", "C", "Available to Customers"],
            ["available_retailer", "R", "Available to Retailers"],
            ["available_distributor", "D", "Available to Distributors"],
          ] as const).map(([key, label, title]) => {
            const enabled = row[key] !== false;
            return (
              <button
                key={key}
                type="button"
                title={title}
                aria-label={title}
                aria-pressed={enabled}
                disabled={Boolean(row.archived_at)}
                onClick={() => change(source, key, !enabled)}
                className={`h-8 w-8 rounded-md border text-xs font-semibold ${enabled ? "border-sky-300 bg-sky-100 text-sky-800" : "border-slate-200 bg-white text-slate-400 line-through"}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </td>
    );
  if (column.key === "actions")
    return (
      <td className={common} style={stickyStyle}>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Save row"
            disabled={!Object.keys(dirty).length}
            onClick={onSave}
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" asChild aria-label="Edit Product" title="Edit Product">
            <Link
              to="/aurona-console-9f2x7k/products/$id"
              params={{ id: family.legacy_product_id ?? family.id }}
            >
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="icon" variant="ghost" asChild aria-label="View storefront">
            <Link to="/products/$slug" params={{ slug: family.slug }} target="_blank">
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
          {row.archived_at ? (
            <>
              <Button size="icon" variant="success" aria-label="Restore SKU" title="Restore SKU" onClick={() => onVariantState("restore")}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="destructive" aria-label="Delete SKU permanently" title="Delete SKU permanently" onClick={onVariantDeletePermanent}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button size="icon" variant="ghost" aria-label="Delete SKU (archive)" title="Delete SKU (archive; can be restored)" onClick={() => onVariantState("archive")}>
              <Archive className="h-4 w-4" />
            </Button>
          )}
        </div>
      </td>
    );
  if (column.key.startsWith("attr:")) {
    const key = column.key.slice(5);
    const axis = family.axes.find((item) => item.axis_key === key);
    const changed = Boolean(
      (dirty.attributes as Record<string, string> | undefined)?.[key] !== undefined,
    );
    return (
      <td className={`${common} ${changed ? "bg-amber-100" : ""}`}>
        <select
          className="h-8 w-full min-w-[100px] rounded border border-slate-200 bg-white px-2"
          value={row.attributes?.[key] ?? ""}
          onChange={(event) =>
            change(source, "attributes", { ...row.attributes, [key]: event.target.value })
          }
        >
          <option value="">—</option>
          {(axis?.values ?? []).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </td>
    );
  }
  if (
    column.key === "sku" ||
    column.key === "barcode" ||
    numberKeys.has(column.key as EditableKey)
  ) {
    const key = column.key as EditableKey;
    const changed = Object.prototype.hasOwnProperty.call(dirty, key);
    const value = row[key] as string | number | null;
    return (
      <td className={`${common} ${changed ? "bg-amber-100" : ""}`}>
        <Input
          className={`h-8 min-w-[80px] px-2 text-xs ${key === "sku" || key === "barcode" ? "font-mono" : "text-right"}`}
          type={key === "sku" || key === "barcode" ? "text" : "number"}
          min={key === "sku" || key === "barcode" ? undefined : 0}
          step={key === "sku" || key === "barcode" ? undefined : "0.01"}
          value={value ?? ""}
          onChange={(event) =>
            change(
              source,
              key,
              key === "sku" || key === "barcode"
                ? event.target.value
                : event.target.value === ""
                  ? null
                  : Number(event.target.value),
            )
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              revertCell(row.id, key);
              event.currentTarget.blur();
            }
          }}
          aria-label={`${column.label} for ${row.sku}`}
        />
      </td>
    );
  }
  return <td className={common} style={stickyStyle}>{column.key === "mrp" ? money(row.mrp) : "—"}</td>;
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}
    >
      {label}
    </span>
  );
}
