import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
  Store,
  Warehouse,
  Search,
  Truck,
  ShieldCheck,
  ShoppingBasket,
  RotateCcw,
  Layers3,
} from "lucide-react";
import { VariantEditor } from "@/components/admin/VariantEditor";
import { ProductImageManager } from "@/components/admin/ProductImageManager";
import {
  adminGetProductForEdit,
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

type MainTab =
  | "general"
  | "media"
  | "variations"
  | "customer"
  | "retailer"
  | "distributor"
  | "seo"
  | "shipping"
  | "warranty"
  | "frequently";

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
    key: "variations",
    label: "Variations",
    icon: <Layers3 className="h-4 w-4" />,
  },
  {
    key: "customer",
    label: "Product Price & Stock",
    icon: <Users className="h-4 w-4" />,
  },
  {
    key: "retailer",
    label: "Retailer Price & Stock",
    icon: <Store className="h-4 w-4" />,
  },
  {
    key: "distributor",
    label: "Distributor Price & Stock",
    icon: <Warehouse className="h-4 w-4" />,
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

/** The everyday workflow: details, photos, then prices and variations. */
const SIMPLE_TABS: MainTab[] = ["general", "media", "variations", "customer"];

export function ProductEditor({ productId: id }: { productId: string }) {
  const isNew = id === "new";

  const nav = useNavigate();
  const qc = useQueryClient();

  const [f, setF] = useState<ProductForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<MainTab>("general");
  const [showAdvanced, setShowAdvanced] = useState(false);
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

      {/* ADMIN TABS - NO HORIZONTAL SLIDER */}

      <div className="sticky top-0 z-20 space-y-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {(showAdvanced ? TABS : TABS.filter((item) => SIMPLE_TABS.includes(item.key))).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-center text-sm font-medium transition ${
                tab === item.key
                  ? "bg-slate-900 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span className="shrink-0">{item.icon}</span>

              <span className="leading-tight">{item.label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 px-1 text-xs text-slate-500">
          <span>
            {showAdvanced
              ? "All sections shown, including SEO, shipping, warranty and partner pricing."
              : "Simple mode: product details, photos, then prices and variations."}
          </span>
          <button
            type="button"
            className="rounded-md border border-slate-200 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
            onClick={() => {
              const next = !showAdvanced;
              setShowAdvanced(next);
              if (!next && !SIMPLE_TABS.includes(tab)) setTab("general");
            }}
          >
            {showAdvanced ? "Hide extra options" : "More options"}
          </button>
        </div>
      </div>

      {/* GENERAL */}

      {tab === "general" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Product Information">
            <Field label="Product Name *">
              <Input value={f.name} onChange={(e) => upd("name", e.target.value)} />
            </Field>

            <Field label="Main SKU *">
              <Input value={f.sku} onChange={(e) => upd("sku", e.target.value)} />
            </Field>

            <Field label="Brand">
              <Input value={f.brand} onChange={(e) => upd("brand", e.target.value)} />
            </Field>

            <Field label="Category">
              <select
                className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                value={f.category_id ?? ""}
                onChange={(e) => upd("category_id", e.target.value || null)}
              >
                <option value="">— None —</option>

                {(cats.data ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Unit">
                <Input value={f.unit} onChange={(e) => upd("unit", e.target.value)} />
              </Field>

              <Field label="Model">
                <Input
                  value={f.model}
                  placeholder="Lens / Glass / COB"
                  onChange={(e) => upd("model", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section title="Status">
            <Check label="Published" checked={f.is_published} onChange={(value) => upd("is_published", value)} />

            <Check label="Featured" checked={f.is_featured} onChange={(value) => upd("is_featured", value)} />

            <Check
              label="Today's Deal / Bestseller"
              checked={f.is_bestseller}
              onChange={(value) => upd("is_bestseller", value)}
            />

            <Check label="New Arrival" checked={f.is_new} onChange={(value) => upd("is_new", value)} />

            <Check label="On Sale" checked={f.is_sale} onChange={(value) => upd("is_sale", value)} />

            <div className="border-t pt-3">
              <Field label="Image Seed">
                <Input
                  value={f.image_seed}
                  placeholder="led-bulb"
                  onChange={(e) => upd("image_seed", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section title="Description" className="lg:col-span-2">
            <Field label="Short Description">
              <Textarea
                rows={3}
                value={f.short_description}
                onChange={(e) => upd("short_description", e.target.value)}
              />
            </Field>

            <Field label="Full Description">
              <Textarea rows={8} value={f.description} onChange={(e) => upd("description", e.target.value)} />
            </Field>
          </Section>

          <Section title="Features & Specification Table">
            <Field label="Key Features — one per line">
              <Textarea
                rows={6}
                value={f.features}
                placeholder={"High lumen output\nFlicker free driver"}
                onChange={(e) => upd("features", e.target.value)}
              />
            </Field>

            <Field label="Specifications — Label: Value">
              <Textarea
                rows={8}
                value={f.specifications}
                placeholder={"Cutout: 75mm\nIP Rating: IP55\nMounting Type: Ceiling Mounted"}
                onChange={(e) => upd("specifications", e.target.value)}
              />
            </Field>

            <div className="text-xs text-slate-500">Add different specifications for different product categories.</div>
          </Section>
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

      {tab === "variations" && (
        <VariantArea
          isNew={isNew}
          sku={f.sku}
          id={id}
          variantTab="options"
          title="Variations"
          text="Add the options this product needs, paste their values, press GENERATE VARIATIONS, then fill the table."
        />
      )}

      {tab === "customer" && (
        <VariantArea
          isNew={isNew}
          sku={f.sku}
          id={id}
          variantTab="customer"
          title="Product Price & Stock"
          text="MRP, customer price, retailer price, distributor price, stock and pack size are managed per generated SKU."
        />
      )}

      {/* RETAILER */}

      {tab === "retailer" && (
        <VariantArea
          isNew={isNew}
          sku={f.sku}
          id={id}
          variantTab="retailer"
          title="Retailer Price & Stock"
          text="Retailer pricing and retailer MOQ are managed per variation."
        />
      )}

      {/* DISTRIBUTOR */}

      {tab === "distributor" && (
        <VariantArea
          isNew={isNew}
          sku={f.sku}
          id={id}
          variantTab="distributor"
          title="Distributor Price & Stock"
          text="Distributor pricing and distributor MOQ are managed per variation."
        />
      )}

      {/* SEO */}

      {tab === "seo" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Search Engine Information">
            <Field label="URL Slug">
              <Input
                value={f.slug}
                placeholder="Auto-generated from product name"
                onChange={(e) => upd("slug", e.target.value)}
              />
            </Field>

            <Field label="Search / Short Description">
              <Textarea
                rows={5}
                value={f.short_description}
                onChange={(e) => upd("short_description", e.target.value)}
              />
            </Field>
            <Field label="Meta Title">
              <Input value={f.meta_title} maxLength={240} onChange={(e) => upd("meta_title", e.target.value)} />
            </Field>
            <Field label="Meta Description">
              <Textarea
                rows={4}
                value={f.meta_description}
                maxLength={600}
                onChange={(e) => upd("meta_description", e.target.value)}
              />
            </Field>
            <Field label="Meta Image URL">
              <Input
                type="url"
                value={f.meta_image_url}
                placeholder="https://…"
                onChange={(e) => upd("meta_image_url", e.target.value)}
              />
            </Field>
          </Section>

          <Section title="Preview">
            <div className="rounded-lg border p-4">
              <div className="truncate text-lg text-blue-700">{f.meta_title || f.name || "Product Name"}</div>

              <div className="mt-1 break-all text-sm text-emerald-700">
                aurona.co.in/products/
                {f.slug || slugify(f.name) || "product"}
              </div>

              <div className="mt-2 text-sm text-slate-600">
                {f.meta_description || f.short_description || "Add a meta description to improve the product preview."}
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* SHIPPING */}

      {tab === "shipping" && (
        <div className="space-y-4">
          <Section title="Product Default Shipping Dimensions">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Weight (g)">
                <NullableNumber value={f.weight_g} onChange={(value) => upd("weight_g", value)} />
              </Field>

              <Field label="Length (cm)">
                <NullableNumber value={f.dim_l} onChange={(value) => upd("dim_l", value)} />
              </Field>

              <Field label="Width (cm)">
                <NullableNumber value={f.dim_w} onChange={(value) => upd("dim_w", value)} />
              </Field>

              <Field label="Height (cm)">
                <NullableNumber value={f.dim_h} onChange={(value) => upd("dim_h", value)} />
              </Field>
            </div>

            <div className="text-xs text-slate-500">These are product-level default shipping dimensions.</div>
          </Section>

          <Section title="Shipping Charge & Promise">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Shipping Type">
                <select
                  className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                  value={f.shipping_type}
                  onChange={(e) => upd("shipping_type", e.target.value as ProductForm["shipping_type"])}
                >
                  <option value="calculated">Calculated by shipping rules</option>
                  <option value="free">Free shipping</option>
                  <option value="flat">Flat charge</option>
                </select>
              </Field>
              <Field label="Flat Shipping Cost ₹">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={f.shipping_type !== "flat"}
                  value={f.shipping_cost}
                  onChange={(e) => upd("shipping_cost", Number(e.target.value || 0))}
                />
              </Field>
              <Field label="Estimated Delivery (days)">
                <NullableNumber
                  value={f.estimated_shipping_days}
                  onChange={(value) => upd("estimated_shipping_days", value)}
                />
              </Field>
            </div>
            <Check
              label="Multiply flat shipping cost by order quantity"
              checked={f.shipping_cost_per_quantity}
              onChange={(value) => upd("shipping_cost_per_quantity", value)}
            />
          </Section>

          {!isNew && f.sku ? (
            <VariantEditor productSku={f.sku} productId={id} />
          ) : (
            <Notice
              title="Variant shipping becomes available after save"
              text="Save this product first to configure single-unit and package dimensions for each SKU."
            />
          )}
        </div>
      )}

      {/* WARRANTY */}

      {tab === "warranty" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Warranty">
            <Field label="Warranty">
              <Input
                value={f.warranty}
                placeholder="Example: 2 Years (T&C Apply)"
                onChange={(e) => upd("warranty", e.target.value)}
              />
            </Field>

            <Check label="Refundable product" checked={f.refundable} onChange={(value) => upd("refundable", value)} />
            <Field label="Refund / Return Note">
              <Textarea
                rows={4}
                value={f.refund_note}
                placeholder="Eligibility, exclusions and customer-facing instructions"
                onChange={(e) => upd("refund_note", e.target.value)}
              />
            </Field>

            <div className="text-xs text-slate-500">
              Warranty is mirrored to the corresponding product family when saved.
            </div>
          </Section>
        </div>
      )}

      {/* FREQUENTLY BOUGHT */}

      {tab === "frequently" &&
        (isNew || !product.data?.id ? (
          <Notice title="Save the product first" text="Related products can be selected after this family exists." />
        ) : (
          <RelatedProducts familyId={product.data.id} />
        ))}

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
  variantTab: "options" | "customer" | "retailer" | "distributor";
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
    <Section title="Frequently Bought Together">
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

  for (const line of text.split("\n")) {
    const index = line.indexOf(":");

    if (index <= 0) {
      continue;
    }

    const key = line.slice(0, index).trim();

    const value = line.slice(index + 1).trim();

    if (key && value) {
      output[key] = value;
    }
  }

  return output;
}
