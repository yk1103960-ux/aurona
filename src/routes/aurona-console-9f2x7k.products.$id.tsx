import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  FileText,
  Images,
  Users,
  Store,
  Warehouse,
  Search,
  Truck,
  ShieldCheck,
  ShoppingBasket,
} from "lucide-react";
import { VariantEditor } from "@/components/admin/VariantEditor";
import { ProductImageManager } from "@/components/admin/ProductImageManager";
import { adminSaveProductFamily } from "@/lib/catalog-admin.functions";

export const Route = createFileRoute("/aurona-console-9f2x7k/products/$id")({
  component: ProductEditor,
});

type MainTab =
  | "general"
  | "media"
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
};

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
    label: "Customer Price & Stock",
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

function ProductEditor() {
  const { id } = useParams({
    from: "/aurona-console-9f2x7k/products/$id",
  });

  const isNew = id === "new";

  const nav = useNavigate();
  const qc = useQueryClient();

  const [f, setF] = useState<ProductForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<MainTab>("general");

  const dirty = useRef(false);

  const cats = useQuery({
    queryKey: ["admin-categories-list"],

    queryFn: async () => (await supabase.from("categories").select("id, name").order("name")).data ?? [],
  });

  const product = useQuery({
    queryKey: ["admin-product", id],

    enabled: !isNew,

    refetchOnWindowFocus: false,

    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id).single();

      if (error) throw error;

      return data;
    },
  });

  useRealtime(["products"], () => {
    if (!dirty.current) {
      product.refetch();
    }
  });

  useEffect(() => {
    const data = product.data;

    if (!data || dirty.current) return;

    setF({
      name: data.name ?? "",
      slug: data.slug ?? "",
      sku: data.sku ?? "",
      brand: data.brand ?? "Aurona",

      category_id: data.category_id,

      short_description: data.short_description ?? "",

      description: data.description ?? "",

      mrp: Number(data.mrp ?? 0),
      price: Number(data.price ?? 0),
      stock: Number(data.stock ?? 0),

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
    });
  }, [product.data]);

  const upd = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    dirty.current = true;

    setF((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const save = async () => {
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
          productId: isNew ? undefined : id,
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
        "admin-product",
        "category-counts",
        "search-suggest",
      ]) {
        qc.invalidateQueries({
          queryKey: [key],
        });
      }

      toast.success(isNew ? "Product created" : "Product saved");

      if (isNew && result?.product_id) {
        nav({
          to: "/aurona-console-9f2x7k/products/$id",

          params: {
            id: result.product_id,
          },
        });
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
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Could not load this product.
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

        <Button onClick={save} disabled={saving} size="lg">
          <Save className="mr-2 h-4 w-4" />

          {saving ? "Saving…" : "Save Product"}
        </Button>
      </div>

      {/* ADMIN TABS - NO HORIZONTAL SLIDER */}

      <div className="sticky top-0 z-20 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {TABS.map((item) => (
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

            <Field label="Body Type">
              <Input value={f.body_type} onChange={(e) => upd("body_type", e.target.value)} />
            </Field>

            <Field label="Material">
              <Input value={f.material} onChange={(e) => upd("material", e.target.value)} />
            </Field>
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

          <Section title="Basic Specifications">
            <Field label="Wattage">
              <Input value={f.wattage} onChange={(e) => upd("wattage", e.target.value)} />
            </Field>

            <Field label="Size">
              <Input value={f.size} onChange={(e) => upd("size", e.target.value)} />
            </Field>

            <Field label="Colour Temperature">
              <Input value={f.color_temp} onChange={(e) => upd("color_temp", e.target.value)} />
            </Field>

            <Field label="Default Pack Size">
              <NullableNumber value={f.pack_size} onChange={(value) => upd("pack_size", value)} />
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

          <Section title="Affiliate Commission" className="lg:col-span-2">
            <Check
              label="Affiliates can earn on this product"
              checked={f.affiliate_enabled}
              onChange={(value) => upd("affiliate_enabled", value)}
            />

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Commission Type">
                <select
                  className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                  value={f.affiliate_commission_kind}
                  onChange={(e) =>
                    upd("affiliate_commission_kind", e.target.value as ProductForm["affiliate_commission_kind"])
                  }
                >
                  <option value="">Inherit program default</option>

                  <option value="percentage">Percentage</option>

                  <option value="fixed">Fixed ₹ per unit</option>
                </select>
              </Field>

              <Field label={f.affiliate_commission_kind === "fixed" ? "Commission ₹" : "Commission %"}>
                <NullableNumber
                  value={f.affiliate_commission_value}
                  onChange={(value) => upd("affiliate_commission_value", value)}
                />
              </Field>

              <Field label="Max Commission ₹">
                <NullableNumber
                  value={f.affiliate_max_commission}
                  onChange={(value) => upd("affiliate_max_commission", value)}
                />
              </Field>
            </div>
          </Section>
        </div>
      )}

      {/* MEDIA */}

      {tab === "media" && (
        <>
          {!isNew && f.sku ? (
            <ProductImageManager productSku={f.sku} productId={id} />
          ) : (
            <Notice
              title="Save the product first"
              text="Create the product first, then you can upload general and variation-specific photos."
            />
          )}
        </>
      )}

      {/* CUSTOMER */}

      {tab === "customer" && (
        <VariantArea
          isNew={isNew}
          sku={f.sku}
          id={id}
          title="Customer Price & Stock"
          text="Customer MRP, price, discount, pack size, MOQ and stock are managed per SKU."
        />
      )}

      {/* RETAILER */}

      {tab === "retailer" && (
        <VariantArea
          isNew={isNew}
          sku={f.sku}
          id={id}
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

            <div className="text-xs text-slate-500">
              Dedicated SEO title and meta-description fields can be connected later if those database columns are
              added.
            </div>
          </Section>

          <Section title="Preview">
            <div className="rounded-lg border p-4">
              <div className="truncate text-lg text-blue-700">{f.name || "Product Name"}</div>

              <div className="mt-1 break-all text-sm text-emerald-700">
                aurona.co.in/products/
                {f.slug || slugify(f.name) || "product"}
              </div>

              <div className="mt-2 text-sm text-slate-600">
                {f.short_description || "Add a short description to improve the product preview."}
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

            <div className="text-xs text-slate-500">
              Warranty is mirrored to the corresponding product family when saved.
            </div>
          </Section>

          <Section title="Product Material">
            <Field label="Material">
              <Input value={f.material} onChange={(e) => upd("material", e.target.value)} />
            </Field>

            <Field label="Body Type">
              <Input value={f.body_type} onChange={(e) => upd("body_type", e.target.value)} />
            </Field>
          </Section>
        </div>
      )}

      {/* FREQUENTLY BOUGHT */}

      {tab === "frequently" && (
        <Notice
          title="Frequently Bought Together"
          text="This tab is ready. We will connect it to the real product relationship data instead of creating fake database fields."
        />
      )}

      {/* BOTTOM SAVE */}

      <div className="sticky bottom-3 z-20 flex justify-end">
        <div className="rounded-xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur">
          <Button onClick={save} disabled={saving} size="lg">
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
  title,
  text,
}: {
  isNew: boolean;
  sku: string;
  id: string;
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

      <VariantEditor productSku={sku} productId={id} />
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
