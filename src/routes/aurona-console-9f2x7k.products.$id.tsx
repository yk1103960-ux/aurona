import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  AlertTriangle,
  Save,
  RefreshCw,
  FileText,
  Images,
  Users,
  Search,
  Truck,
  ShieldCheck,
  ShoppingBasket,
  RotateCcw,
  Layers3,
  BadgePercent,
} from "lucide-react";
import { VariantEditor } from "@/components/admin/VariantEditor";
import { ProductImageManager } from "@/components/admin/ProductImageManager";
import {
  adminGetProductForEdit,
  adminLoadVariantMatrix,
  adminSaveProductFamily,
  adminSaveRelatedProductFamilies,
} from "@/lib/catalog-admin.functions";

export const Route = createFileRoute("/aurona-console-9f2x7k/products/$id")({
  component: ExistingProductEditor,
});

function ExistingProductEditor() {
  const { id } = Route.useParams();
  return <ProductEditor productId={id} />;
}

type MainTab = "general" | "media" | "customer" | "commission" | "seo" | "shipping" | "warranty" | "frequently";

type ProductForm = {
  name: string;
  slug: string;
  sku: string;
  brand: string;

  category_id: string | null;
  short_description: string;
  description: string;

  mrp: number;
  price: number;
  stock: number;
  unit: string;

  wattage: string;
  size: string;
  color_temp: string;
  material: string;
  warranty: string;
  model: string;
  body_type: string;
  pack_size: number | null;

  features: string;
  specifications: string;
  image_seed: string;

  is_published: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  is_new: boolean;
  is_sale: boolean;

  affiliate_enabled: boolean;

  affiliate_commission_kind: "" | "percentage" | "fixed";

  affiliate_commission_value: number | null;
  affiliate_max_commission: number | null;

  weight_g: number | null;
  dim_l: number | null;
  dim_w: number | null;
  dim_h: number | null;
  meta_title: string;
  meta_description: string;
  meta_image_url: string;
  video_provider: "" | "youtube" | "vimeo" | "dailymotion" | "other";
  video_url: string;
  specification_pdf_url: string;
  shipping_type: "calculated" | "free" | "flat";
  shipping_cost: number;
  shipping_cost_per_quantity: boolean;
  estimated_shipping_days: number | null;
  refundable: boolean;
  refund_note: string;
  visible_customer: boolean;
  visible_retailer: boolean;
  visible_distributor: boolean;
};

const EMPTY: ProductForm = {
  name: "",
  slug: "",
  sku: "",
  brand: "Aurona",

  category_id: null,
  short_description: "",
  description: "",

  mrp: 0,
  price: 0,
  stock: 25,
  unit: "Pc",

  wattage: "",
  size: "",
  color_temp: "",
  material: "",
  warranty: "1 Year",
  model: "",
  body_type: "",
  pack_size: null,

  features: "",
  specifications: "",
  image_seed: "",

  is_published: true,
  is_featured: false,
  is_bestseller: false,
  is_new: false,
  is_sale: false,

  affiliate_enabled: true,

  affiliate_commission_kind: "",
  affiliate_commission_value: null,
  affiliate_max_commission: null,

  weight_g: null,
  dim_l: null,
  dim_w: null,
  dim_h: null,
  meta_title: "",
  meta_description: "",
  meta_image_url: "",
  video_provider: "",
  video_url: "",
  specification_pdf_url: "",
  shipping_type: "calculated",
  shipping_cost: 0,
  shipping_cost_per_quantity: false,
  estimated_shipping_days: null,
  refundable: true,
  refund_note: "",
  visible_customer: true,
  visible_retailer: true,
  visible_distributor: true,
};

const NEW_PRODUCT_DRAFT_KEY = "aurona-admin-new-product-draft-v1";

type NewProductDraft = {
  version: 1;
  form: Partial<ProductForm>;
  tab?: MainTab;
  savedAt: string;
};

function readNewProductDraft(): NewProductDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(NEW_PRODUCT_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NewProductDraft>;
    if (parsed.version !== 1 || !parsed.form || typeof parsed.form !== "object") return null;
    return {
      version: 1,
      form: parsed.form,
      tab: TABS.some((item) => item.key === parsed.tab) ? parsed.tab : "general",
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

const TABS: {
  key: MainTab;
  label: string;
  icon: ReactNode;
}[] = [
  {
    key: "general",
    label: "General",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    key: "media",
    label: "Files & Media",
    icon: <Images className="h-4 w-4" />,
  },
  {
    key: "customer",
    label: "Price & Stock for Customers",
    icon: <Users className="h-4 w-4" />,
  },
  {
    key: "commission",
    label: "Commission",
    icon: <BadgePercent className="h-4 w-4" />,
  },
  {
    key: "seo",
    label: "SEO",
    icon: <Search className="h-4 w-4" />,
  },
  {
    key: "shipping",
    label: "Shipping",
    icon: <Truck className="h-4 w-4" />,
  },
  {
    key: "warranty",
    label: "Warranty",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  {
    key: "frequently",
    label: "Frequently Bought",
    icon: <ShoppingBasket className="h-4 w-4" />,
  },
];

export function ProductEditor({ productId: id }: { productId: string }) {
  const isNew = id === "new";

  const nav = useNavigate();
  const qc = useQueryClient();

  const [f, setF] = useState<ProductForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<MainTab>("general");
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const dirty = useRef(false);
  const draftCleared = useRef(false);
  const loadProduct = useServerFn(adminGetProductForEdit);

  const cats = useQuery({
    queryKey: ["admin-categories-list"],

    queryFn: async () => (await supabase.from("categories").select("id, name").order("name")).data ?? [],
  });

  const product = useQuery({
    queryKey: ["admin-product", id],

    enabled: !isNew,

    refetchOnWindowFocus: false,

    retry: false,

    queryFn: () => loadProduct({ data: { id } }),
  });

  useRealtime(["product_families", "products"], () => {
    if (!dirty.current) {
      product.refetch();
    }
  });

  useEffect(() => {
    if (!isNew) return;
    const draft = readNewProductDraft();
    if (draft) {
      draftCleared.current = false;
      setF({ ...EMPTY, ...draft.form });
      setTab(draft.tab ?? "general");
      setDraftSavedAt(draft.savedAt);
      dirty.current = true;
      toast.info("Your unsaved product draft was restored");
    }
    setDraftReady(true);
  }, [isNew]);

  useEffect(() => {
    if (!isNew || !draftReady || !dirty.current) return;

    const persist = (showTimestamp: boolean) => {
      if (draftCleared.current || !dirty.current) return;
      const savedAt = new Date().toISOString();
      const draft: NewProductDraft = { version: 1, form: f, tab, savedAt };
      try {
        window.localStorage.setItem(NEW_PRODUCT_DRAFT_KEY, JSON.stringify(draft));
        if (showTimestamp) setDraftSavedAt(savedAt);
      } catch {
        // Product saving still works if browser storage is unavailable.
      }
    };

    const timer = window.setTimeout(() => persist(true), 400);
    // Flush before the browser suspends this tab; do not rely on a background
    // debounce timer to protect the last keystrokes.
    const flush = () => persist(true);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("blur", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("blur", flush);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      persist(false);
    };
  }, [draftReady, f, isNew, tab]);

  useEffect(() => {
    const data = product.data;

    if (!data || dirty.current) return;

    setF({
      name: data.name ?? "",
      slug: data.slug ?? "",
      sku: data.main_sku ?? "",
      brand: data.brand ?? "Aurona",

      category_id: data.category_id,

      short_description: data.short_description ?? "",

      description: data.description ?? "",

      mrp: Number(data.min_mrp ?? 0),
      price: Number(data.min_price ?? 0),
      stock: Number(data.total_stock ?? 0),

      unit: data.unit ?? "Pc",

      wattage: data.wattage ?? "",
      size: data.size ?? "",
      color_temp: data.color_temp ?? "",
      material: data.material ?? "",
      warranty: data.warranty ?? "",

      model: (data as any).model ?? "",

      body_type: (data as any).body_type ?? "",

      pack_size: (data as any).pack_size != null ? Number((data as any).pack_size) : null,

      features: featuresToText((data as any).features),

      specifications: specsToText((data as any).specifications),

      image_seed: data.image_seed ?? "",

      is_published: data.is_published ?? true,

      visible_customer: (data as any).visible_customer ?? true,
      visible_retailer: (data as any).visible_retailer ?? true,
      visible_distributor: (data as any).visible_distributor ?? true,

      is_featured: !!data.is_featured,

      is_bestseller: !!data.is_bestseller,

      is_new: !!data.is_new,

      is_sale: !!data.is_sale,

      affiliate_enabled: data.affiliate_enabled ?? true,

      affiliate_commission_kind: (data.affiliate_commission_kind as ProductForm["affiliate_commission_kind"]) ?? "",

      affiliate_commission_value:
        data.affiliate_commission_value != null ? Number(data.affiliate_commission_value) : null,

      affiliate_max_commission: data.affiliate_max_commission != null ? Number(data.affiliate_max_commission) : null,

      weight_g: data.weight_g != null ? Number(data.weight_g) : null,

      dim_l: data.dim_l != null ? Number(data.dim_l) : null,

      dim_w: data.dim_w != null ? Number(data.dim_w) : null,

      dim_h: data.dim_h != null ? Number(data.dim_h) : null,
      meta_title: data.meta_title ?? "",
      meta_description: data.meta_description ?? "",
      meta_image_url: data.meta_image_url ?? "",
      video_provider: data.video_provider ?? "",
      video_url: data.video_url ?? "",
      specification_pdf_url: data.specification_pdf_url ?? "",
      shipping_type: data.shipping_type ?? "calculated",
      shipping_cost: Number(data.shipping_cost ?? 0),
      shipping_cost_per_quantity: !!data.shipping_cost_per_quantity,
      estimated_shipping_days: data.estimated_shipping_days != null ? Number(data.estimated_shipping_days) : null,
      refundable: data.refundable ?? true,
      refund_note: data.refund_note ?? "",
    });
  }, [product.data]);

  const upd = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    draftCleared.current = false;
    dirty.current = true;

    setF((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const save = async (afterSave: "edit" | "variations" = "edit") => {
    if (!f.name.trim() || !f.sku.trim()) {
      toast.error("Name and SKU are required");
      return;
    }

    setSaving(true);

    try {
      const features = textToFeatures(f.features);

      const specifications = textToSpecs(f.specifications);

      const { features: _features, specifications: _specifications, ...rest } = f;

      const payload = {
        ...rest,

        name: f.name.trim(),
        sku: f.sku.trim(),

        slug: f.slug.trim() || slugify(f.name),

        features,
        specifications,

        affiliate_commission_kind: f.affiliate_commission_kind || "inherit",
      };

      const result = await adminSaveProductFamily({
        data: {
          ...payload,
          productId: isNew ? undefined : (product.data?.legacy_product_id ?? undefined),
          slug: payload.slug,
          affiliate_commission_kind: payload.affiliate_commission_kind as "inherit" | "percentage" | "fixed",
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
        "category-counts",
        "search-suggest",
      ]) {
        qc.invalidateQueries({
          queryKey: [key],
        });
      }

      if (result?.compatibility_mode) {
        toast.warning(
          "Core product saved. Apply the product-admin parity migration before saving SEO, shipping or refund fields.",
        );
      } else {
        toast.success(isNew ? "Product created" : "Product saved");
      }

      if (isNew && result?.product_id) {
        draftCleared.current = true;
        try {
          window.localStorage.removeItem(NEW_PRODUCT_DRAFT_KEY);
        } catch {
          // The product is already saved; unavailable browser storage is harmless.
        }
        setDraftSavedAt(null);
        const savedId = result.family_id ?? result.product_id;
        nav(
          afterSave === "variations"
            ? {
                to: "/aurona-console-9f2x7k/products/$id/variations",
                params: { id: savedId },
              }
            : {
                to: "/aurona-console-9f2x7k/products/$id",
                params: { id: result.product_id },
              },
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save product");
    } finally {
      setSaving(false);
    }
  };

  if (!isNew && product.isLoading) {
    return <div className="py-12 text-center text-sm text-slate-500">Loading product…</div>;
  }

  if (!isNew && product.isError) {
    const message = product.error instanceof Error ? product.error.message : "";
    const permissionError = /permission|forbidden/i.test(message);
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">
              {permissionError ? "Product access is not permitted" : "Could not load this product"}
            </div>
            <p className="mt-1 text-red-700">
              {permissionError
                ? "This admin account needs the catalog.manage permission."
                : message === "Product not found"
                  ? "The product or product family no longer exists. Return to the product list and choose another record."
                  : "The product identifier could not be resolved. Retry the request or return to the product list."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => product.refetch()} disabled={product.isFetching}>
                <RefreshCw className={`h-4 w-4 ${product.isFetching ? "animate-spin" : ""}`} />
                Retry
              </Button>
              <Button variant="outline" asChild>
                <Link to="/aurona-console-9f2x7k/products">Back to products</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-12">
      {/* HEADER */}

      <Link
        to="/aurona-console-9f2x7k/products"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to products
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{isNew ? "Add New Product" : "Edit Product"}</h1>

          {!isNew && f.name && (
            <div className="mt-1 text-sm text-slate-500">
              {f.name}
              {f.sku ? ` • ${f.sku}` : ""}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {isNew && draftSavedAt && (
            <div className="mr-1 text-right text-xs text-slate-500">
              Draft saved locally
              <div>
                {new Date(draftSavedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          )}
          {isNew && draftSavedAt && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!window.confirm("Clear this unsaved product draft?")) return;
                draftCleared.current = true;
                dirty.current = false;
                window.localStorage.removeItem(NEW_PRODUCT_DRAFT_KEY);
                setF(EMPTY);
                setTab("general");
                setDraftSavedAt(null);
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Clear draft
            </Button>
          )}
          {!isNew && f.sku && (
            <Button type="button" variant="outline" asChild>
              <Link to="/aurona-console-9f2x7k/products/$id/variations" params={{ id }}>
                <Layers3 className="h-4 w-4" />
                Manage Variations
              </Link>
            </Button>
          )}
          {isNew && (
            <Button type="button" variant="secondary" disabled={saving} size="lg" onClick={() => save("variations")}>
              <Layers3 className="h-4 w-4" />
              {saving ? "Saving…" : "Save & Add Variations"}
            </Button>
          )}
          <Button onClick={() => save()} disabled={saving} size="lg">
            <Save className="mr-2 h-4 w-4" />

            {saving ? "Saving…" : "Save Product"}
          </Button>
        </div>
      </div>

      {/* OLD ADMIN STYLE PRODUCT EDITOR LAYOUT */}
      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-4">
          <nav className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition ${
                  tab === item.key ? "bg-sky-50 text-sky-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="leading-tight">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 space-y-4">
          {/* GENERAL */}
          {tab === "general" && (
            <div className="space-y-4">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.8fr)]">
                <Section title="Product Information">
                  <div className="space-y-4">
                    <Field label="Product Name *">
                      <Input value={f.name} placeholder="Product Name" onChange={(e) => upd("name", e.target.value)} />
                    </Field>

                    <Field label="Main SKU *">
                      <Input value={f.sku} placeholder="Main SKU" onChange={(e) => upd("sku", e.target.value)} />
                    </Field>

                    <Field label="Brand">
                      <select
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                        value={f.brand}
                        onChange={(e) => upd("brand", e.target.value)}
                      >
                        <option value="Aurona">AURONA</option>
                        {f.brand && f.brand.toLowerCase() !== "aurona" && <option value={f.brand}>{f.brand}</option>}
                      </select>
                      <div className="mt-1 text-xs text-slate-500">
                        You can choose a brand if you'd like to display your product by brand.
                      </div>
                    </Field>

                    <Field label="Unit *">
                      <Input value={f.unit} placeholder="Pc" onChange={(e) => upd("unit", e.target.value)} />
                    </Field>

                    <Field label="Model">
                      <Input
                        value={f.model}
                        placeholder="Lens / Glass / COB"
                        onChange={(e) => upd("model", e.target.value)}
                      />
                    </Field>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                      Barcode is managed per generated SKU/variation so each sellable variant can have its own barcode.
                    </div>
                  </div>
                </Section>

                <Section title="Product category *">
                  <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
                    <span>Select Main</span>
                    <span>{f.category_id ? "1 selected" : "None selected"}</span>
                  </div>
                  <div className="max-h-[460px] space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                    {(cats.data ?? []).map((category) => {
                      const selected = f.category_id === category.id;
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => upd("category_id", selected ? null : category.id)}
                          className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition ${
                            selected ? "bg-sky-50 font-medium text-sky-700" : "hover:bg-slate-50"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded border ${
                                selected ? "border-sky-500 bg-sky-500 text-white" : "border-slate-300 bg-white"
                              }`}
                            >
                              {selected ? "✓" : ""}
                            </span>
                            {category.name}
                          </span>
                          <span
                            className={`h-4 w-4 rounded-full border ${
                              selected ? "border-[5px] border-sky-500" : "border-slate-400"
                            }`}
                          />
                        </button>
                      );
                    })}
                    {cats.isLoading && (
                      <div className="p-4 text-center text-sm text-slate-500">Loading categories…</div>
                    )}
                  </div>
                </Section>
              </div>

              {/* PRODUCT CONTENT — Manu requirement: exactly 3 simple copy/paste boxes */}
              <Section title="Product Content">
                <div className="space-y-5">
                  <Field label="Short Description">
                    <Textarea
                      rows={4}
                      value={f.short_description}
                      placeholder="Enter or paste the short description..."
                      onChange={(e) => upd("short_description", e.target.value)}
                      className="min-h-[110px] w-full resize-y"
                    />
                    <div className="text-xs text-slate-500">
                      Shown below the Product Name on the customer product page.
                    </div>
                  </Field>

                  <Field label="Description">
                    <Textarea
                      rows={10}
                      value={f.description}
                      placeholder="Copy and paste the complete product description here..."
                      onChange={(e) => upd("description", e.target.value)}
                      className="min-h-[220px] w-full resize-y"
                    />
                    <div className="text-xs text-slate-500">
                      Shown in the Description section of the customer product page.
                    </div>
                  </Field>

                  <Field label="Key Features">
                    <Textarea
                      rows={8}
                      value={f.features}
                      placeholder={
                        "Paste one key feature per line...\nExample:\nWattage: 12W\nBody Colour: White\nMaterial: Aluminium"
                      }
                      onChange={(e) => upd("features", e.target.value)}
                      className="min-h-[180px] w-full resize-y"
                    />
                    <div className="text-xs text-slate-500">
                      Enter or paste one feature per line. Use “Name: Value” when you want the customer page to show it
                      in the same two-column lined style as Specifications.
                    </div>
                  </Field>

                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-medium text-slate-600">Specification</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Add, edit or delete specifications. Each specification has its own name and value.
                      </div>
                    </div>

                    <EditableSpecificationRows
                      value={f.specifications}
                      onChange={(value) => upd("specifications", value)}
                    />
                  </div>
                </div>
              </Section>

              <div className="grid gap-4 lg:grid-cols-2">
                <Section title="Refund">
                  <Check label="Refundable?" checked={f.refundable} onChange={(value) => upd("refundable", value)} />
                  <Field label="Note">
                    <Textarea
                      rows={4}
                      value={f.refund_note}
                      placeholder="Refund / return conditions"
                      onChange={(e) => upd("refund_note", e.target.value)}
                    />
                  </Field>
                </Section>

                <Section title="Status">
                  <Check label="Published" checked={f.is_published} onChange={(value) => upd("is_published", value)} />
                  <Check label="Featured" checked={f.is_featured} onChange={(value) => upd("is_featured", value)} />
                  <Check
                    label="Today's Deal"
                    checked={f.is_bestseller}
                    onChange={(value) => upd("is_bestseller", value)}
                  />
                  <Check label="New Arrival" checked={f.is_new} onChange={(value) => upd("is_new", value)} />
                  <Check label="On Sale" checked={f.is_sale} onChange={(value) => upd("is_sale", value)} />
                </Section>
              </div>
            </div>
          )}

          {/* MEDIA */}

          {tab === "media" && (
            <div className="space-y-4">
              {!isNew && f.sku ? (
                <ProductImageManager productSku={f.sku} productId={id} />
              ) : (
                <Notice
                  title="Save the product first"
                  text="Create the product first, then you can upload general and variation-specific photos."
                />
              )}
              <Section title="Video & Specification File">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Video Provider">
                    <select
                      className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                      value={f.video_provider}
                      onChange={(e) => upd("video_provider", e.target.value as ProductForm["video_provider"])}
                    >
                      <option value="">None</option>
                      <option value="youtube">YouTube</option>
                      <option value="vimeo">Vimeo</option>
                      <option value="dailymotion">Dailymotion</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                  <Field label="Video URL">
                    <Input
                      type="url"
                      value={f.video_url}
                      placeholder="https://…"
                      onChange={(e) => upd("video_url", e.target.value)}
                    />
                  </Field>
                  <Field label="Specification PDF URL">
                    <Input
                      type="url"
                      value={f.specification_pdf_url}
                      placeholder="https://…/specification.pdf"
                      onChange={(e) => upd("specification_pdf_url", e.target.value)}
                    />
                  </Field>
                </div>
              </Section>
            </div>
          )}

          {/* CUSTOMER */}

          {tab === "customer" && (
            <VariantArea
              isNew={isNew}
              sku={f.sku}
              id={id}
              variantTab="customer"
              title="Price & Stock for Customers"
              text="MRP, customer price, stock and pack size are managed per generated SKU."
            />
          )}

          {/* COMMISSION */}

          {tab === "commission" &&
            (isNew ? (
              <Notice
                title="Save the product first"
                text="Create the product and its variations first, then configure commission for each SKU and partner program."
              />
            ) : (
              <VariantProgramCommissions productId={id} productSku={f.sku} />
            ))}

          {/* SEO */}

          {tab === "seo" && (
            <Section title="SEO Meta Tags">
              <div className="space-y-4">
                <Field label="Meta Title">
                  <Input
                    value={f.meta_title}
                    maxLength={240}
                    placeholder="Meta Title"
                    onChange={(e) => upd("meta_title", e.target.value)}
                  />
                </Field>
                <Field label="Description">
                  <Textarea
                    rows={7}
                    value={f.meta_description}
                    maxLength={600}
                    onChange={(e) => upd("meta_description", e.target.value)}
                  />
                </Field>
                <Field label="Meta Image">
                  <Input
                    type="url"
                    value={f.meta_image_url}
                    placeholder="Meta image URL"
                    onChange={(e) => upd("meta_image_url", e.target.value)}
                  />
                  <div className="mt-1 text-xs text-slate-500">
                    Existing Aurona schema stores the meta image as a URL. Product image uploads remain under Files &
                    Media.
                  </div>
                </Field>
              </div>
            </Section>
          )}

          {/* SHIPPING */}

          {tab === "shipping" && (
            <div className="space-y-4">
              <Section title="Shipping Configuration">
                <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">
                  Cash On Delivery availability is controlled by the existing checkout/payment configuration. This
                  product page does not override the global COD setting.
                </div>

                <div className="space-y-3">
                  <Check
                    label="Free Shipping"
                    checked={f.shipping_type === "free"}
                    onChange={(value) => upd("shipping_type", value ? "free" : "calculated")}
                  />
                  <Check
                    label="Flat Rate"
                    checked={f.shipping_type === "flat"}
                    onChange={(value) => upd("shipping_type", value ? "flat" : "calculated")}
                  />
                  <Check
                    label="Is Product Quantity Multiply"
                    checked={f.shipping_cost_per_quantity}
                    onChange={(value) => upd("shipping_cost_per_quantity", value)}
                  />

                  {f.shipping_type === "flat" && (
                    <Field label="Flat Shipping Cost ₹">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={f.shipping_cost}
                        onChange={(e) => upd("shipping_cost", Number(e.target.value || 0))}
                      />
                    </Field>
                  )}
                </div>
              </Section>

              <Section title="Estimate Shipping Time">
                <Field label="Shipping Days">
                  <div className="flex">
                    <NullableNumber
                      value={f.estimated_shipping_days}
                      onChange={(value) => upd("estimated_shipping_days", value)}
                    />
                    <div className="flex items-center rounded-r-md border border-l-0 border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                      Days
                    </div>
                  </div>
                </Field>
              </Section>

              {!isNew && f.sku ? (
                <VariantEditor productSku={f.sku} productId={id} initialTab="shipping" />
              ) : (
                <Notice
                  title="Weight & Dimensions become available after save"
                  text="Save this product first to configure single-unit and package dimensions for every generated SKU."
                />
              )}
            </div>
          )}

          {/* WARRANTY */}

          {tab === "warranty" && (
            <Section title="Warranty">
              <Check
                label="Warranty"
                checked={Boolean(f.warranty.trim())}
                onChange={(enabled) => upd("warranty", enabled ? f.warranty.trim() || "1 Year" : "")}
              />
              {Boolean(f.warranty.trim()) && (
                <Field label="Warranty Details">
                  <Input
                    value={f.warranty}
                    placeholder="Example: 1 Year / 2 Years (T&C Apply)"
                    onChange={(e) => upd("warranty", e.target.value)}
                  />
                </Field>
              )}
            </Section>
          )}

          {/* FREQUENTLY BOUGHT */}

          {tab === "frequently" &&
            (isNew || !product.data?.id ? (
              <Notice
                title="Save the product first"
                text="Related products can be selected after this family exists."
              />
            ) : (
              <RelatedProducts familyId={product.data.id} />
            ))}
        </main>
      </div>

      {/* BOTTOM SAVE */}

      <div className="sticky bottom-3 z-20 flex justify-end">
        <div className="rounded-xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur">
          <Button onClick={() => save()} disabled={saving} size="lg">
            <Save className="mr-2 h-4 w-4" />

            {saving ? "Saving…" : "Save Product"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function VariantArea({
  isNew,
  sku,
  id,
  variantTab,
  title,
  text,
}: {
  isNew: boolean;
  sku: string;
  id: string;
  variantTab: "options" | "customer";
  title: string;
  text: string;
}) {
  if (isNew || !sku) {
    return (
      <Notice
        title="Save the product first"
        text="Variants can be configured after the base product has been created."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Notice title={title} text={text} />

      <VariantEditor productSku={sku} productId={id} initialTab={variantTab} />
    </div>
  );
}

type CommissionKind = "percentage" | "fixed";

type CommissionVariant = {
  id: string;
  sku: string;
  variation: string;
  attributes: Record<string, string>;
};

type CommissionProgram = {
  id: string;
  name: string;
  is_active: boolean;
};

type CommissionRule = {
  id?: string;
  variant_id: string;
  program_id: string;
  commission_kind: CommissionKind;
  commission_value: number;
  max_commission: number | null;
  is_active: boolean;
};

function VariantProgramCommissions({ productId, productSku }: { productId: string; productSku: string }) {
  const qc = useQueryClient();
  const [rules, setRules] = useState<Record<string, CommissionRule>>({});
  const [savingCommissions, setSavingCommissions] = useState(false);
  const initialized = useRef(false);

  const q = useQuery({
    queryKey: ["variant-program-commissions", productId, productSku],
    enabled: Boolean(productId && productSku),
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // IMPORTANT:
      // Use the exact same family/product/SKU resolver as Manage Variations.
      // Do not guess product_variants.product_id/family_id columns here.
      const matrix = await adminLoadVariantMatrix({
        data: {
          familyId: null,
          productId,
          productSku,
        },
      });

      const variants: CommissionVariant[] = (matrix.variants ?? [])
        .filter((row: any) => Boolean(row?.id))
        .map((row: any) => {
          const attrs = row.attributes && typeof row.attributes === "object" ? row.attributes : {};
          const attributeValues = Object.entries(attrs)
            .filter(
              ([key, value]) =>
                key !== "variant_label" && value !== null && value !== undefined && String(value).trim(),
            )
            .map(([, value]) => String(value).trim());

          const variation =
            String(attrs.variant_label ?? "").trim() ||
            attributeValues.join(" • ") ||
            String(row.sku ?? "").trim() ||
            "Variation";

          const attributeMap: Record<string, string> = {};
          for (const [key, value] of Object.entries(attrs)) {
            if (key === "variant_label" || key.startsWith("__")) continue;
            const text = value === null || value === undefined ? "" : String(value).trim();
            if (text) attributeMap[key] = text;
          }

          return {
            id: String(row.id),
            sku: String(row.sku ?? ""),
            variation,
            attributes: attributeMap,
          };
        });

      const programsResult = await (supabase as any)
        .from("referral_programs")
        .select("id,name,is_active,is_published,sort_order")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (programsResult.error) {
        throw new Error(`Partner programs: ${programsResult.error.message}`);
      }

      const programs: CommissionProgram[] = (programsResult.data ?? []).map((program: any) => ({
        id: String(program.id),
        name: String(program.name ?? "Partner Program"),
        is_active: program.is_active ?? true,
      }));

      let existing: any[] = [];
      const variantIds = variants.map((variant) => variant.id);

      if (variantIds.length > 0) {
        const existingResult = await (supabase as any)
          .from("variant_program_commissions")
          .select("id,variant_id,program_id,commission_kind,commission_value,max_commission,is_active")
          .in("variant_id", variantIds);

        if (existingResult.error) {
          throw new Error(`Commission overrides: ${existingResult.error.message}`);
        }

        existing = existingResult.data ?? [];
      }

      return {
        family: matrix.family,
        variants,
        programs,
        existing,
      };
    },
  });

  useEffect(() => {
    if (!q.data || initialized.current) return;

    const next: Record<string, CommissionRule> = {};

    for (const variant of q.data.variants) {
      for (const program of q.data.programs) {
        const existing = q.data.existing.find(
          (row: any) => row.variant_id === variant.id && row.program_id === program.id,
        );

        const key = `${variant.id}:${program.id}`;

        next[key] = {
          id: existing?.id,
          variant_id: variant.id,
          program_id: program.id,
          commission_kind: existing?.commission_kind === "fixed" ? "fixed" : "percentage",
          commission_value: Number(existing?.commission_value ?? 0),
          max_commission:
            existing?.max_commission === null || existing?.max_commission === undefined
              ? null
              : Number(existing.max_commission),
          is_active: existing?.is_active ?? true,
        };
      }
    }

    setRules(next);
    initialized.current = true;
  }, [q.data]);

  const updateRule = (variantId: string, programId: string, patch: Partial<CommissionRule>) => {
    const key = `${variantId}:${programId}`;

    setRules((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? {
          variant_id: variantId,
          program_id: programId,
          commission_kind: "percentage" as CommissionKind,
          commission_value: 0,
          max_commission: null,
          is_active: true,
        }),
        ...patch,
      },
    }));
  };

  const saveAll = async () => {
    const rows = Object.values(rules);

    if (!rows.length) {
      toast.error("No commission rows to save");
      return;
    }

    for (const row of rows) {
      if (!Number.isFinite(row.commission_value) || row.commission_value < 0) {
        toast.error("Commission value must be 0 or greater");
        return;
      }

      if (row.commission_kind === "percentage" && row.commission_value > 100) {
        toast.error("Percentage commission cannot exceed 100%");
        return;
      }

      if (row.max_commission != null && (!Number.isFinite(row.max_commission) || row.max_commission < 0)) {
        toast.error("Maximum commission must be 0 or greater");
        return;
      }
    }

    setSavingCommissions(true);

    try {
      const payload = rows.map(({ id: _id, ...row }) => ({
        variant_id: row.variant_id,
        program_id: row.program_id,
        commission_kind: row.commission_kind,
        commission_value: row.commission_value,
        max_commission: row.max_commission,
        is_active: row.is_active,
      }));

      const { error } = await (supabase as any)
        .from("variant_program_commissions")
        .upsert(payload, { onConflict: "variant_id,program_id" });

      if (error) throw error;

      toast.success("Variation commissions saved");
      initialized.current = false;

      await qc.invalidateQueries({
        queryKey: ["variant-program-commissions", productId, productSku],
      });

      await q.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save commissions");
    } finally {
      setSavingCommissions(false);
    }
  };

  if (!productSku) {
    return <Notice title="Commission" text="This product needs a main SKU before commission settings can be loaded." />;
  }

  if (q.isLoading) {
    return <Notice title="Commission" text="Loading variations and partner programs…" />;
  }

  if (q.isError) {
    return (
      <Section title="Commission">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="font-semibold">Could not load commission settings.</div>
          <div className="mt-1 break-words text-xs">
            {q.error instanceof Error ? q.error.message : "Unknown commission loading error"}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            initialized.current = false;
            q.refetch();
          }}
          disabled={q.isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
          Retry
        </Button>
      </Section>
    );
  }

  const variants = q.data?.variants ?? [];
  const programs = q.data?.programs ?? [];

  return (
    <Section title="Commission">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-slate-900">Variation × Partner Program Commission</div>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Every generated SKU can have a different commission for every partner program. Choose Percentage (%) or
              Fixed (₹), set the value, optional cap and active status.
            </p>
          </div>

          <Button type="button" onClick={saveAll} disabled={savingCommissions || !variants.length || !programs.length}>
            <Save className="mr-2 h-4 w-4" />
            {savingCommissions ? "Saving…" : "Save Commissions"}
          </Button>
        </div>

        {!variants.length ? (
          <Notice
            title="No generated variations"
            text="Open Manage Variations and generate at least one SKU before setting commissions."
          />
        ) : !programs.length ? (
          <Notice
            title="No partner programs"
            text="Create at least one Referral/Partner Program in Editorial before setting SKU commissions."
          />
        ) : (
          <>
          <GroupCommissionPanel
            programs={programs}
            variants={variants}
            onApply={(programId, variantIds, patch) => {
              const allowed = new Set(variantIds);
              let count = 0;
              for (const variant of variants) {
                if (!allowed.has(variant.id)) continue;
                for (const program of programs) {
                  if (programId !== "__all" && program.id !== programId) continue;
                  updateRule(variant.id, program.id, patch);
                  count += 1;
                }
              }
              toast.success(`Applied to ${count} row${count === 1 ? "" : "s"}. Now press Save Commissions.`);
            }}
          />
          <div className="overflow-x-auto rounded-xl border border-slate-200">

            <table className="w-full min-w-[1180px] text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="min-w-[190px] p-3 text-left font-semibold text-slate-700">Variation</th>
                  <th className="min-w-[180px] p-3 text-left font-semibold text-slate-700">SKU</th>
                  <th className="min-w-[230px] p-3 text-left font-semibold text-slate-700">Partner Program</th>
                  <th className="min-w-[150px] p-3 text-left font-semibold text-slate-700">Type</th>
                  <th className="min-w-[130px] p-3 text-left font-semibold text-slate-700">Value</th>
                  <th className="min-w-[160px] p-3 text-left font-semibold text-slate-700">Max Commission</th>
                  <th className="min-w-[100px] p-3 text-center font-semibold text-slate-700">Active</th>
                </tr>
              </thead>

              <tbody>
                {variants.flatMap((variant) =>
                  programs.map((program, programIndex) => {
                    const key = `${variant.id}:${program.id}`;

                    const rule =
                      rules[key] ??
                      ({
                        variant_id: variant.id,
                        program_id: program.id,
                        commission_kind: "percentage",
                        commission_value: 0,
                        max_commission: null,
                        is_active: true,
                      } satisfies CommissionRule);

                    return (
                      <tr
                        key={key}
                        className="border-b border-slate-100 align-top last:border-b-0 hover:bg-slate-50/60"
                      >
                        <td className="p-3">
                          {programIndex === 0 ? (
                            <div className="max-w-[260px] break-words font-medium text-slate-900">
                              {variant.variation}
                            </div>
                          ) : (
                            <span className="text-slate-300">↳</span>
                          )}
                        </td>

                        <td className="p-3">
                          {programIndex === 0 ? (
                            <span className="break-all font-mono text-xs text-slate-700">{variant.sku}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        <td className="p-3">
                          <div className="font-medium text-slate-800">{program.name}</div>
                          {!program.is_active && (
                            <div className="mt-1 text-xs text-amber-600">Program currently paused</div>
                          )}
                        </td>

                        <td className="p-3">
                          <select
                            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                            value={rule.commission_kind}
                            onChange={(event) =>
                              updateRule(variant.id, program.id, {
                                commission_kind: event.target.value as CommissionKind,
                              })
                            }
                          >
                            <option value="percentage">Percentage (%)</option>
                            <option value="fixed">Fixed (₹)</option>
                          </select>
                        </td>

                        <td className="p-3">
                          <div className="relative">
                            <Input
                              type="number"
                              min="0"
                              max={rule.commission_kind === "percentage" ? 100 : undefined}
                              step="0.01"
                              value={rule.commission_value}
                              onChange={(event) =>
                                updateRule(variant.id, program.id, {
                                  commission_value: Number(event.target.value || 0),
                                })
                              }
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                              {rule.commission_kind === "percentage" ? "%" : "₹"}
                            </span>
                          </div>
                        </td>

                        <td className="p-3">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="No cap"
                            value={rule.max_commission ?? ""}
                            onChange={(event) =>
                              updateRule(variant.id, program.id, {
                                max_commission: event.target.value === "" ? null : Number(event.target.value),
                              })
                            }
                          />
                        </td>

                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            className="mt-3 h-4 w-4"
                            checked={rule.is_active}
                            onChange={(event) =>
                              updateRule(variant.id, program.id, {
                                is_active: event.target.checked,
                              })
                            }
                          />
                        </td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </Section>
  );
}

/** Shortcut: set one commission for a chosen variation (or all) and program at once. */
function GroupCommissionPanel({
  programs,
  variants,
  onApply,
}: {
  programs: CommissionProgram[];
  variants: CommissionVariant[];
  onApply: (programId: string, variantIds: string[], patch: Partial<CommissionRule>) => void;
}) {
  const axes = useMemo(() => {
    const keys: string[] = [];
    for (const variant of variants) {
      for (const key of Object.keys(variant.attributes)) {
        if (!keys.includes(key)) keys.push(key);
      }
    }
    return keys;
  }, [variants]);

  const [programId, setProgramId] = useState("__all");
  const [axis, setAxis] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { kind: CommissionKind; value: string; cap: string }>>({});

  useEffect(() => {
    if (!axis && axes.length > 0) setAxis(axes[0]);
  }, [axes, axis]);

  const groups = useMemo(() => {
    if (!axis) return [] as { value: string; variantIds: string[] }[];
    const map = new Map<string, string[]>();
    for (const variant of variants) {
      const value = variant.attributes[axis];
      if (!value) continue;
      const list = map.get(value) ?? [];
      list.push(variant.id);
      map.set(value, list);
    }
    return Array.from(map.entries()).map(([value, variantIds]) => ({ value, variantIds }));
  }, [axis, variants]);

  const draftFor = (key: string) => drafts[key] ?? { kind: "percentage" as CommissionKind, value: "", cap: "" };

  const setDraft = (key: string, patch: Partial<{ kind: CommissionKind; value: string; cap: string }>) =>
    setDrafts((prev) => ({ ...prev, [key]: { ...draftFor(key), ...patch } }));

  const applyGroup = (key: string, variantIds: string[]) => {
    const draft = draftFor(key);
    const amount = Number(draft.value);
    if (draft.value === "" || !Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a commission value of 0 or more");
      return;
    }
    if (draft.kind === "percentage" && amount > 100) {
      toast.error("Percentage commission cannot exceed 100%");
      return;
    }
    const capValue = draft.cap === "" ? null : Number(draft.cap);
    if (capValue != null && (!Number.isFinite(capValue) || capValue < 0)) {
      toast.error("Maximum commission must be 0 or greater");
      return;
    }
    onApply(programId, variantIds, {
      commission_kind: draft.kind,
      commission_value: amount,
      max_commission: capValue,
      is_active: true,
    });
  };

  if (axes.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-base font-semibold text-slate-900">Set commission by {axis || "option"}</div>
          <p className="mt-1 max-w-3xl text-xs text-slate-500">
            Apply one commission to every SKU sharing the same {axis || "option"} value. If this product has no
            Wattage, choose Size, Model, Colour, Pack Size or any other product option instead.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Partner program
            <select
              className="h-10 min-w-[180px] rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={programId}
              onChange={(event) => setProgramId(event.target.value)}
            >
              <option value="__all">All programs</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Group commission by
            <select
              className="h-10 min-w-[200px] rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={axis}
              onChange={(event) => setAxis(event.target.value)}
            >
              {axes.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="p-3 font-semibold">{axis}</th>
              <th className="p-3 font-semibold">Type</th>
              <th className="p-3 font-semibold">Value</th>
              <th className="p-3 font-semibold">Max commission</th>
              <th className="p-3 text-right font-semibold">Apply</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const key = `${axis}:${group.value}`;
              const draft = draftFor(key);
              return (
                <tr key={key} className="border-b border-slate-100 last:border-b-0">
                  <td className="p-3">
                    <div className="font-semibold text-slate-900">{group.value}</div>
                    <div className="text-xs text-slate-500">
                      {group.variantIds.length} SKU{group.variantIds.length === 1 ? "" : "s"}
                    </div>
                  </td>
                  <td className="p-3">
                    <select
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                      value={draft.kind}
                      onChange={(event) => setDraft(key, { kind: event.target.value as CommissionKind })}
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed (₹)</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={draft.kind === "percentage" ? "Commission %" : "Commission ₹"}
                      value={draft.value}
                      onChange={(event) => setDraft(key, { value: event.target.value })}
                    />
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="No cap"
                      value={draft.cap}
                      onChange={(event) => setDraft(key, { cap: event.target.value })}
                    />
                  </td>
                  <td className="p-3 text-right">
                    <Button type="button" onClick={() => applyGroup(key, group.variantIds)}>
                      Apply to {group.value}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}



function RelatedProducts({ familyId }: { familyId: string }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const loaded = useRef(false);
  const q = useQuery({
    queryKey: ["admin-related-products", familyId, search],
    queryFn: async () => {
      let productsQuery = (supabase as any)
        .from("product_families")
        .select("id,name,main_sku")
        .neq("id", familyId)
        .is("archived_at", null)
        .order("name")
        .limit(100);
      if (search.trim())
        productsQuery = productsQuery.or(`name.ilike.%${search.trim()}%,main_sku.ilike.%${search.trim()}%`);
      const [products, related] = await Promise.all([
        productsQuery,
        (supabase as any)
          .from("product_related_families")
          .select("related_family_id")
          .eq("family_id", familyId)
          .order("sort_order"),
      ]);
      if (products.error) throw products.error;
      if (related.error) throw related.error;
      return {
        products: products.data ?? [],
        relatedIds: (related.data ?? []).map((row: any) => row.related_family_id as string),
      };
    },
  });
  useEffect(() => {
    if (q.data && !loaded.current) {
      setSelected(q.data.relatedIds);
      loaded.current = true;
    }
  }, [q.data]);
  const save = async () => {
    setSaving(true);
    try {
      await adminSaveRelatedProductFamilies({ data: { familyId, relatedIds: selected } });
      toast.success("Frequently bought products saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save related products");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Section title="Frequently Bought">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-md"
          value={search}
          placeholder="Search product name or SKU…"
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save Selection"}
        </Button>
        <span className="text-xs text-slate-500">{selected.length} selected · maximum 24</span>
      </div>
      <div className="max-h-[480px] divide-y overflow-y-auto rounded-lg border">
        {(q.data?.products ?? []).map((item: any) => (
          <label key={item.id} className="flex cursor-pointer items-center gap-3 p-3 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={(e) =>
                setSelected((current) =>
                  e.target.checked ? [...current, item.id].slice(0, 24) : current.filter((id) => id !== item.id),
                )
              }
            />
            <span className="flex-1">
              <span className="font-medium">{item.name}</span>
              <span className="ml-2 font-mono text-xs text-slate-500">{item.main_sku}</span>
            </span>
          </label>
        ))}
        {q.isLoading && <div className="p-6 text-center text-sm text-slate-500">Loading products…</div>}
      </div>
    </Section>
  );
}

function EditableSpecificationRows({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const parseRows = (source: string) => {
    if (!source.trim()) return [{ label: "", value: "" }];

    return source.split("\n").map((line) => {
      const separator = line.indexOf(":");

      if (separator === -1) {
        return { label: line.trim(), value: "" };
      }

      return {
        label: line.slice(0, separator).trim(),
        value: line.slice(separator + 1).trim(),
      };
    });
  };

  const rows = parseRows(value);

  const commit = (next: { label: string; value: string }[]) => {
    onChange(
      next
        .map((row) => {
          const label = row.label.replace(/:/g, "").trim();
          const specificationValue = row.value.trim();

          if (!label && !specificationValue) return "";
          if (!label) return specificationValue;

          return `${label}: ${specificationValue}`;
        })
        .join("\n"),
    );
  };

  const STANDARD_LABELS = [
    "Brand",
    "Category",
    "MOQ",
    "Pack size",
    "Weight",
    "Dimensions",
    "Body type",
    "Material",
    "Warranty",
    "Country of origin",
    "IP Rating",
    "Beam Angle",
    "Input Voltage",
    "Colour Temperature",
    "Lumens",
    "Life span",
  ];

  const addStandardRows = () => {
    const existing = new Set(rows.map((row) => row.label.trim().toLowerCase()).filter(Boolean));
    const filled = rows.filter((row) => row.label.trim() || row.value.trim());
    const additions = STANDARD_LABELS.filter((label) => !existing.has(label.toLowerCase())).map((label) => ({
      label,
      value: "",
    }));
    commit([...filled, ...additions]);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="grid grid-cols-[minmax(160px,0.9fr)_minmax(180px,1.1fr)_90px] gap-2 border-b bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <div>Specification</div>
          <div>Value</div>
          <div className="text-center">Action</div>
        </div>

        <div className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <div key={index} className="grid grid-cols-[minmax(160px,0.9fr)_minmax(180px,1.1fr)_90px] gap-2 p-3">
              <Input
                value={row.label}
                placeholder="Specification name"
                onChange={(event) => {
                  const next = rows.map((item) => ({ ...item }));
                  next[index].label = event.target.value;
                  commit(next);
                }}
              />

              <Input
                value={row.value}
                placeholder="Value"
                onChange={(event) => {
                  const next = rows.map((item) => ({ ...item }));
                  next[index].value = event.target.value;
                  commit(next);
                }}
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={rows.length === 1 && !row.label && !row.value}
                onClick={() => {
                  const next = rows.filter((_, rowIndex) => rowIndex !== index);
                  commit(next.length ? next : [{ label: "", value: "" }]);
                }}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => commit([...rows, { label: "", value: "" }])}>
          + Add Specification
        </Button>
        <Button type="button" variant="outline" onClick={addStandardRows}>
          Add standard rows
        </Button>
      </div>

      <div className="space-y-1">
        <div className="text-xs font-medium text-slate-600">Edit everything as text (paste friendly)</div>
        <Textarea
          rows={8}
          value={value}
          placeholder={"Brand: Aurona\nWarranty: 2 Years\nCountry of origin: India"}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-[160px] w-full resize-y font-mono text-xs"
        />
        <div className="text-xs text-slate-500">
          One specification per line as “Name: Value”. Anything you type here — including Brand, MOQ, Warranty, Material
          or Country of origin — replaces that row on the live product page.
        </div>
      </div>
    </div>
  );
}


function Section({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`space-y-3 rounded-xl border border-slate-200 bg-white p-4 ${className}`}>
      <div className="text-sm font-semibold uppercase tracking-wider text-slate-500">{title}</div>

      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <div className="text-xs font-medium text-slate-600">{label}</div>

      {children}
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />

      {label}
    </label>
  );
}

function NullableNumber({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  return (
    <Input
      type="number"
      step="any"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    />
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="font-semibold text-slate-900">{title}</div>

      <div className="mt-1 text-sm leading-6 text-slate-500">{text}</div>
    </div>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function featuresToText(value: unknown): string {
  if (Array.isArray(value)) {
    return (value as string[]).join("\n");
  }

  return "";
}

function textToFeatures(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function specsToText(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  return Object.entries(value as Record<string, string>)
    .map(([key, val]) => `${key}: ${val}`)
    .join("\n");
}

function textToSpecs(text: string): Record<string, string> {
  const output: Record<string, string> = {};
  const invalidLines: string[] = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const separator = trimmed.match(/\s(?:-|=)\s|[:=]/);
    const index = separator?.index ?? -1;

    if (index <= 0) {
      invalidLines.push(trimmed);
      continue;
    }

    const key = trimmed.slice(0, index).trim();

    const value = trimmed.slice(index + (separator?.[0].length ?? 1)).trim();

    if (key && value) {
      output[key] = value;
    } else {
      invalidLines.push(trimmed);
    }
  }

  if (invalidLines.length > 0) {
    throw new Error(
      `Fix specification ${invalidLines.length === 1 ? "line" : "lines"}: use Label: Value (for example, IP Rating: IP55).`,
    );
  }

  return output;
}
