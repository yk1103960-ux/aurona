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
} from "lucide-react";
import { adminSaveVariantMatrix } from "@/lib/catalog-admin.functions";
import { missingCombinations } from "@/lib/variant-options";

type Variant = {
  id: string;
  family_id: string;
  sku: string;
  barcode: string;
  attributes: Record<string, string>;

  mrp: number | null;
  price: number | null;
  discount_pct: number | null;

  retailer_price: number | null;
  distributor_price: number | null;

  moq: number | null;
  retailer_moq: number | null;
  distributor_moq: number | null;

  stock: number | null;
  expected_stock?: number;
  pack_size: number | null;

  weight_g: number | null;
  dim_l: number | null;
  dim_w: number | null;
  dim_h: number | null;

  pack_weight_g: number | null;
  pack_l: number | null;
  pack_w: number | null;
  pack_h: number | null;

  is_active: boolean;
  sort_order: number;
  low_stock_threshold: number;
};

type Axis = {
  id: string;
  axis_key: string;
  label: string;
  values: string[];
  sort_order: number;
};

type Tab = "options" | "customer" | "retailer" | "distributor" | "shipping";

const COLS =
  "id, family_id, sku, barcode, attributes, mrp, price, discount_pct, retailer_price, distributor_price, moq, retailer_moq, distributor_moq, stock, pack_size, weight_g, dim_l, dim_w, dim_h, pack_weight_g, pack_l, pack_w, pack_h, is_active, sort_order, low_stock_threshold";
const LEGACY_COLS =
  "id, family_id, sku, attributes, mrp, price, discount_pct, retailer_price, distributor_price, moq, retailer_moq, distributor_moq, stock, pack_size, weight_g, dim_l, dim_w, dim_h, pack_weight_g, pack_l, pack_w, pack_h, is_active, sort_order, low_stock_threshold";

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
  const [tab, setTab] = useState<Tab>(initialTab);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [axesDirty, setAxesDirty] = useState(false);
  const [axesSaving, setAxesSaving] = useState(false);

  const dirty = useRef(false);
  const qc = useQueryClient();
  const busy = saving || axesSaving;
  useBlocker({
    shouldBlockFn: () =>
      (dirty.current || axesDirty || busy) &&
      !window.confirm(
        busy
          ? "A save is in progress. Leave this page anyway?"
          : "Leave without saving your variation changes? Stay on this page to save them first.",
      ),
    enableBeforeUnload: () => dirty.current || axesDirty || busy,
  });

  const q = useQuery({
    queryKey: ["admin-product-variants", familyId ?? null, productId, productSku],
    enabled: !!productSku || !!familyId,
    refetchOnWindowFocus: false,

    queryFn: async () => {
      let fam: { id: string; name: string } | null = null;

      if (familyId) {
        const byId = await supabase
          .from("product_families")
          .select("id, name")
          .eq("id", familyId)
          .maybeSingle();
        if (byId.error) throw byId.error;
        fam = byId.data;
      }

      if (!fam && productSku) {
        const bySku = await supabase
          .from("product_families")
          .select("id, name")
          .eq("main_sku", productSku)
          .maybeSingle();
        if (bySku.error) throw bySku.error;
        fam = bySku.data;
      }

      if (!fam && productId && productId !== "new") {
        const byProduct = await supabase
          .from("product_families")
          .select("id, name")
          .filter("legacy_product_id", "eq", productId)
          .maybeSingle();
        if (byProduct.error && !/legacy_product_id|schema cache/i.test(byProduct.error.message)) {
          throw byProduct.error;
        }
        fam = byProduct.data ?? null;
      }

      if (!fam) {
        const { data: viaVariant, error: variantError } = await supabase
          .from("product_variants")
          .select("family_id, product_families(id, name)")
          .eq("sku", productSku)
          .maybeSingle();

        if (variantError) throw variantError;

        const rel = (
          viaVariant as {
            product_families?: { id: string; name: string };
          } | null
        )?.product_families;

        if (rel) fam = rel;
      }

      if (!fam) {
        return {
          family: null,
          variants: [] as Variant[],
          axes: [] as Axis[],
        };
      }

      const loadVariants = async () => {
        let result = await supabase
          .from("product_variants")
          .select(COLS)
          .eq("family_id", fam.id)
          .order("sort_order")
          .overrideTypes<Partial<Variant>[], { merge: false }>();

        if (result.error && /barcode|schema cache|does not exist/i.test(result.error.message)) {
          result = await supabase
            .from("product_variants")
            .select(LEGACY_COLS)
            .eq("family_id", fam.id)
            .order("sort_order")
            .overrideTypes<Partial<Variant>[], { merge: false }>();
        }

        return result;
      };

      const [{ data, error }, { data: axes, error: axesError }] = await Promise.all([
        loadVariants(),

        supabase
          .from("product_variant_axes")
          .select("id, axis_key, label, values, sort_order")
          .eq("family_id", fam.id)
          .order("sort_order"),
      ]);

      if (error) throw error;
      if (axesError) throw axesError;

      return {
        family: fam,
        variants: (data ?? []).map((row: Partial<Variant>) => ({
          ...row,
          barcode: row.barcode ?? "",
          expected_stock: Number(row.stock ?? 0),
        })) as Variant[],
        axes: (axes ?? []).map((axis) => ({
          ...axis,
          values: Array.isArray(axis.values) ? axis.values : [],
        })) as Axis[],
      };
    },
  });

  useRealtime(["product_variants"], () => {
    if (!dirty.current && !axesDirty && !busy) q.refetch();
  });

  useEffect(() => {
    if (q.data && !dirty.current) {
      setRows(q.data.variants);
    }
  }, [q.data]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const family = q.data?.family;
  const axes = q.data?.axes ?? [];

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
    dirty.current = true;
    setRows((current) => {
      const existing = new Set(current.map((row) => row.sku.trim().toUpperCase()));
      let sequence = current.length + 1;
      let sku = `${productSku}-NEW-${String(sequence).padStart(2, "0")}`;
      while (existing.has(sku.toUpperCase()))
        sku = `${productSku}-NEW-${String(++sequence).padStart(2, "0")}`;
      return [
        ...current,
        {
          id: `new-${crypto.randomUUID()}`,
          family_id: family.id,
          sku,
          barcode: "",
          attributes: {},
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
          sort_order: current.length,
          low_stock_threshold: 10,
        },
      ];
    });
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
    } else {
      updateRow(row.id, { is_active: false });
    }
    toast.success("Variant marked inactive. Save variants to apply.");
  };

  const saveAll = async () => {
    if (busy) return false;
    if (axesDirty) {
      setTab("options");
      toast.info(
        "Save your option changes first. Save Options also saves the current variation details.",
      );
      return false;
    }
    setSaving(true);

    try {
      const result = await adminSaveVariantMatrix({
        data: {
          familyId: family.id,
          axes,
          variants: rows.map((row) => ({
            ...row,
            id: row.id.startsWith("new-") ? undefined : row.id,
            sku: row.sku.trim(),
            discount_pct: discountPercent(row.mrp, row.price),
            low_stock_threshold: row.low_stock_threshold ?? 10,
          })),
        },
      });

      dirty.current = false;

      for (const key of [
        "products",
        "families-page",
        "product",
        "family",
        "family-products",
        "browse-products",
        "admin-products",
        "admin-product-families",
        "admin-product",
        "admin-product-variants",
        "search-suggest",
      ]) {
        qc.invalidateQueries({ queryKey: [key] });
      }

      if (result.compatibility_mode) {
        toast.warning("Prices and variations saved. Apply the parity migration to save barcodes.");
      } else {
        toast.success("Variants saved");
      }
      const refreshed = await q.refetch();
      if (refreshed.error) {
        toast.warning(
          "Saved, but the updated variations could not be loaded. Retry loading before editing or saving again.",
        );
        return false;
      }
      setRows(refreshed.data?.variants ?? []);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save variants");
      return false;
    } finally {
      setSaving(false);
    }
  };

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
              Add Variant
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
            active={tab === "options"}
            onClick={() => setTab("options")}
            icon={<SlidersHorizontal className="h-4 w-4" />}
          >
            All Variation Details
          </TabButton>

          <TabButton
            active={tab === "customer"}
            onClick={() => setTab("customer")}
            icon={<Users className="h-4 w-4" />}
          >
            Customer Price & Stock
          </TabButton>

          <TabButton
            active={tab === "retailer"}
            onClick={() => setTab("retailer")}
            icon={<Store className="h-4 w-4" />}
          >
            Retailer Price & Stock
          </TabButton>

          <TabButton
            active={tab === "distributor"}
            onClick={() => setTab("distributor")}
            icon={<Warehouse className="h-4 w-4" />}
          >
            Distributor Price & Stock
          </TabButton>

          <TabButton
            active={tab === "shipping"}
            onClick={() => setTab("shipping")}
            icon={<Truck className="h-4 w-4" />}
          >
            Weight & Dimensions
          </TabButton>
        </div>
      </div>

      {(dirty.current || axesDirty) && (
        <div
          role="status"
          className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Unsaved changes.{" "}
          {axesDirty
            ? "Save Options to save option definitions and the current SKU details together."
            : "Use Save Variants to apply your changes."}{" "}
          Switching pricing tabs keeps your edits.
        </div>
      )}

      <div className="p-4">
        <div hidden={tab !== "options"}>
          <OptionsTab
            familyId={family.id}
            axes={axes}
            rows={rows}
            updateRow={updateRow}
            removeRow={removeRow}
            refresh={async () => {
              const refreshed = await q.refetch();
              if (refreshed.error) throw refreshed.error;
              const saved = refreshed.data?.variants ?? [];
              dirty.current = false;
              setRows(saved);
              return saved;
            }}
            generateCombinations={generateCombinations}
            editRow={(row) => setEditingId(row.id)}
            manageImages={onManageImages}
            onAxesDirtyChange={setAxesDirty}
            onAxesSavingChange={setAxesSaving}
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

function OptionsTab({
  familyId,
  axes,
  rows,
  updateRow,
  removeRow,
  refresh,
  generateCombinations,
  editRow,
  manageImages,
  onAxesDirtyChange,
  onAxesSavingChange,
}: {
  familyId: string;
  axes: Axis[];
  rows: Variant[];
  updateRow: (id: string, patch: Partial<Variant>) => void;
  removeRow: (row: Variant) => void;
  refresh: () => Promise<Variant[]>;
  generateCombinations: (axes?: Axis[], rows?: Variant[]) => void;
  editRow: (row: Variant) => void;
  manageImages?: (sku: string) => void;
  onAxesDirtyChange: (dirty: boolean) => void;
  onAxesSavingChange: (saving: boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <AxisEditor
        familyId={familyId}
        variants={rows}
        onSaved={refresh}
        generateCombinations={generateCombinations}
        onDirtyChange={onAxesDirtyChange}
        onSavingChange={onAxesSavingChange}
      />

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
  manageImages,
}: {
  row: Variant;
  number: number;
  axes: Axis[];
  updateRow: (id: string, patch: Partial<Variant>) => void;
  removeRow: (row: Variant) => void;
  editRow: (row: Variant) => void;
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
  axes,
  open,
  saving,
  onOpenChange,
  updateRow,
  save,
  manageImages,
}: {
  row: Variant | null;
  axes: Axis[];
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  updateRow: (id: string, patch: Partial<Variant>) => void;
  save: () => Promise<void>;
  manageImages?: (sku: string) => void;
}) {
  if (!row) return null;
  const numberField = (key: keyof Variant, label: string, options?: { min?: number }) => (
    <label>
      <FieldTitle>{label}</FieldTitle>
      <Input
        className="mt-1"
        type="number"
        step="any"
        min={options?.min}
        value={(row[key] as number | null) ?? ""}
        onChange={(event) => updateRow(row.id, { [key]: toNumber(event.target.value) })}
      />
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Variation — {variantName(row)}</DialogTitle>
          <p className="text-sm text-slate-500">
            Edit this SKU’s name/options, prices, quantities, availability and shipping
            measurements.
          </p>
        </DialogHeader>

        <fieldset disabled={saving} className="min-w-0 space-y-4">
          <section className="space-y-3 rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900">Variation identity</h3>
            <label className="block">
              <FieldTitle>Variant label (optional)</FieldTitle>
              <Input
                value={row.attributes.variant_label ?? ""}
                onChange={(event) =>
                  updateRow(row.id, {
                    attributes: { ...row.attributes, variant_label: event.target.value },
                  })
                }
                placeholder="Defaults to the selected option values"
              />
            </label>
            {numberField("sort_order", "Display order", { min: 0 })}
            {axes.length > 0 && (
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
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
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
                  onChange={(event) => updateRow(row.id, { barcode: event.target.value })}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Switch
                checked={row.is_active}
                onCheckedChange={(value) => updateRow(row.id, { is_active: value })}
              />
              Available for sale
            </label>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900">Prices and ordering</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {numberField("mrp", "MRP ₹", { min: 0 })}
              {numberField("price", "Customer Price ₹", { min: 0 })}
              {numberField("retailer_price", "Retailer Price ₹", { min: 0 })}
              {numberField("distributor_price", "Distributor Price ₹", { min: 0 })}
              {numberField("moq", "Customer MOQ", { min: 1 })}
              {numberField("retailer_moq", "Retailer MOQ", { min: 1 })}
              {numberField("distributor_moq", "Distributor MOQ", { min: 1 })}
              {numberField("pack_size", "Pieces / Pack", { min: 1 })}
              {numberField("stock", "Stock", { min: 0 })}
              {numberField("low_stock_threshold", "Low-stock Alert", { min: 0 })}
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900">Unit weight and dimensions</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {numberField("weight_g", "Weight (g)", { min: 0 })}
              {numberField("dim_l", "Length (cm)", { min: 0 })}
              {numberField("dim_w", "Width (cm)", { min: 0 })}
              {numberField("dim_h", "Height (cm)", { min: 0 })}
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900">Package weight and dimensions</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {numberField("pack_weight_g", "Package Weight (g)", { min: 0 })}
              {numberField("pack_l", "Package Length (cm)", { min: 0 })}
              {numberField("pack_w", "Package Width (cm)", { min: 0 })}
              {numberField("pack_h", "Package Height (cm)", { min: 0 })}
            </div>
          </section>

          <VariantSpecifications row={row} axes={axes} updateRow={updateRow} />
        </fieldset>
        <DialogFooter>
          {manageImages && !row.id.startsWith("new-") && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                manageImages(row.sku);
                onOpenChange(false);
              }}
            >
              <ImageIcon className="h-4 w-4" /> Manage Images
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close editor
          </Button>
          <Button type="button" disabled={saving} onClick={save}>
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save All Variant Changes"}
          </Button>
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
  familyId,
  variants,
  onSaved,
  generateCombinations,
  onDirtyChange,
  onSavingChange,
}: {
  familyId: string;
  variants: Variant[];
  onSaved: () => Promise<Variant[]>;
  generateCombinations: (axes?: Axis[], rows?: Variant[]) => void;
  onDirtyChange: (dirty: boolean) => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const [rows, setRows] = useState<Axis[]>([]);
  const [saving, setSaving] = useState(false);
  const [excluded, setExcluded] = useState<Record<string, string[]>>({});

  const dirty = useRef(false);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["admin-variant-axes", familyId],
    refetchOnWindowFocus: false,

    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variant_axes")
        .select("id, axis_key, label, values, sort_order")
        .eq("family_id", familyId)
        .order("sort_order");

      if (error) throw error;

      return (data ?? []).map((axis) => ({
        ...axis,
        values: Array.isArray(axis.values) ? axis.values : [],
      })) as Axis[];
    },
  });

  useEffect(() => {
    if (q.data && !dirty.current) {
      setRows(q.data);
    }
  }, [q.data]);

  const updateAxis = (id: string, patch: Partial<Axis>) => {
    dirty.current = true;
    onDirtyChange(true);

    setRows((current) => current.map((axis) => (axis.id === id ? { ...axis, ...patch } : axis)));
  };

  const addAxis = (preset?: { key: string; label: string; values?: string[] }) => {
    const key = preset?.key ?? `option_${rows.length + 1}`;
    if (rows.some((axis) => axis.axis_key === key)) {
      toast.info(`${preset?.label ?? "This option"} already exists`);
      return;
    }
    dirty.current = true;
    onDirtyChange(true);
    setRows((current) => [
      ...current,
      {
        id: `new-${Date.now()}`,
        axis_key: key,
        label: preset?.label ?? "New Option",
        values: preset?.values ?? [],
        sort_order: current.length,
      },
    ]);
  };

  const removeAxis = (axis: Axis) => {
    if (variants.some((variant) => variant.attributes[axis.axis_key])) {
      toast.error(
        "This option is used by existing SKUs. Clear or remap those values explicitly before removing it.",
      );
      return;
    }
    if (!confirm(`Remove option "${axis.label}" from this family?`)) {
      return;
    }
    dirty.current = true;
    onDirtyChange(true);
    setRows((current) => current.filter((item) => item.id !== axis.id));
  };

  const saveAxes = async (generateAfterSave = false) => {
    const cleaned = rows.map((axis) => ({
      ...axis,
      axis_key: axis.axis_key
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, "_"),
      label: axis.label.trim(),
      values: [...new Set(axis.values.map((value) => value.trim()).filter(Boolean))],
    }));
    if (cleaned.some((axis) => !axis.axis_key || !axis.label || axis.values.length === 0)) {
      toast.error("Every option needs a key, display name and at least one value");
      return;
    }
    if (new Set(cleaned.map((axis) => axis.axis_key)).size !== cleaned.length) {
      toast.error("Each option key must be unique");
      return;
    }
    for (const previous of q.data ?? []) {
      const replacement = cleaned.find((axis) => axis.axis_key === previous.axis_key);
      if (
        variants.some(
          (variant) =>
            variant.attributes[previous.axis_key] &&
            !replacement?.values.includes(variant.attributes[previous.axis_key]),
        )
      ) {
        toast.error(
          `Existing SKUs use ${previous.label} values that would be removed. Remap those SKUs first.`,
        );
        return;
      }
    }
    const generationAxes = cleaned.map((axis) => ({
      ...axis,
      values: axis.values.filter((value) => !(excluded[axis.id] ?? []).includes(value)),
    }));
    if (generateAfterSave) {
      try {
        missingCombinations(generationAxes, variants);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Invalid options");
        return;
      }
    }
    setSaving(true);
    onSavingChange(true);

    try {
      const result = await adminSaveVariantMatrix({
        data: {
          familyId,
          axes: cleaned.map((axis) => ({
            axis_key: axis.axis_key,
            label: axis.label,
            values: axis.values,
            sort_order: axis.sort_order,
          })),
          variants: variants.map((row) => ({
            ...row,
            id: row.id.startsWith("new-") ? undefined : row.id,
            discount_pct: discountPercent(row.mrp, row.price),
            low_stock_threshold: row.low_stock_threshold ?? 10,
          })),
        },
      });

      dirty.current = false;
      onDirtyChange(false);

      for (const key of [
        "product",
        "family",
        "family-products",
        "products",
        "admin-product-variants",
      ]) {
        qc.invalidateQueries({ queryKey: [key] });
      }

      if (result.compatibility_mode) {
        toast.warning("Options and prices saved. Apply the parity migration to save barcodes.");
      } else {
        toast.success("Options saved");
      }
      // Refresh SKU IDs first: a committed new SKU must never be submitted as a draft again.
      const savedVariants = await onSaved();
      const axesResult = await q.refetch();
      if (axesResult.error) throw axesResult.error;
      if (generateAfterSave) generateCombinations(generationAxes, savedVariants);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save options");
    } finally {
      setSaving(false);
      onSavingChange(false);
    }
  };

  if (q.isLoading)
    return (
      <p role="status" className="p-4 text-sm text-slate-500">
        Loading option definitions…
      </p>
    );
  if (q.isError)
    return (
      <div
        role="alert"
        className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
      >
        Option definitions could not be loaded. Your current edits are retained while this page
        stays open.
        <Button
          type="button"
          variant="outline"
          className="ml-3"
          onClick={() => q.refetch()}
          disabled={q.isFetching}
        >
          Retry options
        </Button>
      </div>
    );

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Product Options / Attributes</div>

          <div className="mt-1 text-xs text-slate-500">
            Examples: Watts Available, Output Colour, Shape, Body Colour, Pack Size, Oscillation,
            Tank Capacity or Reflector Colour.
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => addAxis()}>
            <Plus className="mr-1 h-4 w-4" />
            Add Option
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => saveAxes(false)}
            disabled={saving || rows.length === 0}
          >
            <Save className="mr-1 h-4 w-4" />
            {saving ? "Saving…" : "Save Options"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => saveAxes(true)}
            disabled={saving || rows.length === 0}
          >
            <Plus className="h-4 w-4" />
            {saving ? "Saving…" : "Save & Generate Variations"}
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-800">
            Choose the variation types for this product:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { key: "wattage", label: "Wattage" },
              { key: "size", label: "Size" },
              { key: "body_colour", label: "Body / Housing Colour" },
              { key: "pack_size", label: "Pack Size" },
              { key: "output_colour", label: "Output Colour" },
            ].map((preset) => (
              <Button
                key={preset.key}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addAxis(preset)}
              >
                <Plus className="h-4 w-4" /> {preset.label}
              </Button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Select a template or use Add Option for a custom attribute, enter comma-separated
            values, then save options.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((axis) => (
            <div
              key={axis.id}
              className="grid items-end gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-[180px_220px_1fr_auto]"
            >
              <label>
                <FieldTitle>Option Key</FieldTitle>

                <Input
                  className="mt-1 font-mono"
                  value={axis.axis_key}
                  disabled={!axis.id.startsWith("new-")}
                  onChange={(e) =>
                    updateAxis(axis.id, {
                      axis_key: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                <FieldTitle>Display Name</FieldTitle>

                <Input
                  className="mt-1"
                  value={axis.label}
                  onChange={(e) =>
                    updateAxis(axis.id, {
                      label: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                <FieldTitle>Available Values (comma separated)</FieldTitle>

                <Input
                  className="mt-1"
                  value={axis.values.join(", ")}
                  placeholder="3W, 5W, 7W, 9W"
                  onChange={(e) =>
                    updateAxis(axis.id, {
                      values: e.target.value.split(",").map((value) => value.replace(/^\s+/, "")),
                    })
                  }
                />
              </label>

              <Button type="button" size="sm" variant="outline" onClick={() => removeAxis(axis)}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <div className="flex flex-wrap gap-3 md:col-span-4">
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
