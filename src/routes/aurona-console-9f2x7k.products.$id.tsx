import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/aurona-console-9f2x7k/products/$id")({
  component: ProductEditor,
});

type ProductForm = {
  name: string; slug: string; sku: string; brand: string;
  category_id: string | null; short_description: string; description: string;
  mrp: number; price: number; stock: number; unit: string;
  wattage: string; size: string; color_temp: string; material: string; warranty: string;
  image_seed: string;
  is_published: boolean; is_featured: boolean; is_bestseller: boolean; is_new: boolean; is_sale: boolean;
  affiliate_enabled: boolean;
  affiliate_commission_kind: "" | "percentage" | "fixed";
  affiliate_commission_value: number | null;
  affiliate_max_commission: number | null;
  weight_g: number | null;
  dim_l: number | null; dim_w: number | null; dim_h: number | null;
};

const EMPTY: ProductForm = {
  name: "", slug: "", sku: "", brand: "Aurona",
  category_id: null, short_description: "", description: "",
  mrp: 0, price: 0, stock: 25, unit: "Pc",
  wattage: "", size: "", color_temp: "", material: "", warranty: "1 Year",
  image_seed: "",
  is_published: true, is_featured: false, is_bestseller: false, is_new: false, is_sale: false,
  affiliate_enabled: true,
  affiliate_commission_kind: "",
  affiliate_commission_value: null,
  affiliate_max_commission: null,
  weight_g: null,
  dim_l: null, dim_w: null, dim_h: null,
};


function ProductEditor() {
  const { id } = useParams({ from: "/aurona-console-9f2x7k/products/$id" });
  const isNew = id === "new";
  const nav = useNavigate();
  const [f, setF] = useState<ProductForm>(EMPTY);
  const [saving, setSaving] = useState(false);

  const cats = useQuery({
    queryKey: ["admin-categories-list"],
    queryFn: async () => (await supabase.from("categories").select("id, name").order("name")).data ?? [],
  });

  useQuery({
    queryKey: ["admin-product", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
      if (error) throw error;
      setF({
        name: data.name ?? "", slug: data.slug ?? "", sku: data.sku ?? "", brand: data.brand ?? "Aurona",
        category_id: data.category_id, short_description: data.short_description ?? "", description: data.description ?? "",
        mrp: Number(data.mrp ?? 0), price: Number(data.price ?? 0), stock: Number(data.stock ?? 0), unit: data.unit ?? "Pc",
        wattage: data.wattage ?? "", size: data.size ?? "", color_temp: data.color_temp ?? "", material: data.material ?? "", warranty: data.warranty ?? "",
        image_seed: data.image_seed ?? "",
        is_published: data.is_published ?? true, is_featured: !!data.is_featured, is_bestseller: !!data.is_bestseller, is_new: !!data.is_new, is_sale: !!data.is_sale,
        affiliate_enabled: data.affiliate_enabled ?? true,
        affiliate_commission_kind:
          (data.affiliate_commission_kind as ProductForm["affiliate_commission_kind"]) ?? "",
        affiliate_commission_value:
          data.affiliate_commission_value != null ? Number(data.affiliate_commission_value) : null,
        affiliate_max_commission:
          data.affiliate_max_commission != null ? Number(data.affiliate_max_commission) : null,
        weight_g: data.weight_g != null ? Number(data.weight_g) : null,
        dim_l: data.dim_l != null ? Number(data.dim_l) : null,
        dim_w: data.dim_w != null ? Number(data.dim_w) : null,
        dim_h: data.dim_h != null ? Number(data.dim_h) : null,
      });

      return data;
    },
  });

  const upd = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.name || !f.sku) return toast.error("Name and SKU are required");
    setSaving(true);
    const payload = {
      ...f,
      slug: f.slug || slugify(f.name),
      // Empty kind means "inherit the program/affiliate default".
      affiliate_commission_kind: f.affiliate_commission_kind || "inherit",
    };

    const { data, error } = isNew
      ? await supabase.from("products").insert(payload).select("id").single()
      : await supabase.from("products").update(payload).eq("id", id).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isNew ? "Product created" : "Saved");
    if (isNew && data) nav({ to: "/aurona-console-9f2x7k/products/$id", params: { id: data.id } });
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <Link to="/aurona-console-9f2x7k/products" className="text-sm text-slate-500 inline-flex items-center gap-1 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4" /> Back to products
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{isNew ? "New Product" : "Edit Product"}</h1>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Basics">
          <Field label="Name"><Input value={f.name} onChange={(e) => upd("name", e.target.value)} /></Field>
          <Field label="Slug (URL)"><Input value={f.slug} onChange={(e) => upd("slug", e.target.value)} placeholder="auto" /></Field>
          <Field label="SKU"><Input value={f.sku} onChange={(e) => upd("sku", e.target.value)} /></Field>
          <Field label="Brand"><Input value={f.brand} onChange={(e) => upd("brand", e.target.value)} /></Field>
          <Field label="Category">
            <select className="w-full h-10 border rounded-md px-3 text-sm bg-white" value={f.category_id ?? ""} onChange={(e) => upd("category_id", e.target.value || null)}>
              <option value="">— None —</option>
              {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Unit"><Input value={f.unit} onChange={(e) => upd("unit", e.target.value)} /></Field>
        </Section>

        <Section title="Pricing & Stock">
          <Field label="Price (₹)"><Input type="number" value={f.price} onChange={(e) => upd("price", Number(e.target.value))} /></Field>
          <Field label="MRP (₹)"><Input type="number" value={f.mrp} onChange={(e) => upd("mrp", Number(e.target.value))} /></Field>
          <Field label="Stock"><Input type="number" value={f.stock} onChange={(e) => upd("stock", Number(e.target.value))} /></Field>
        </Section>

        <Section title="Description" className="md:col-span-2">
          <Field label="Short description"><Textarea rows={2} value={f.short_description} onChange={(e) => upd("short_description", e.target.value)} /></Field>
          <Field label="Description"><Textarea rows={5} value={f.description} onChange={(e) => upd("description", e.target.value)} /></Field>
        </Section>

        <Section title="Specifications">
          <Field label="Wattage"><Input value={f.wattage} onChange={(e) => upd("wattage", e.target.value)} /></Field>
          <Field label="Size"><Input value={f.size} onChange={(e) => upd("size", e.target.value)} /></Field>
          <Field label="Color temperature"><Input value={f.color_temp} onChange={(e) => upd("color_temp", e.target.value)} /></Field>
          <Field label="Material"><Input value={f.material} onChange={(e) => upd("material", e.target.value)} /></Field>
          <Field label="Warranty"><Input value={f.warranty} onChange={(e) => upd("warranty", e.target.value)} /></Field>
        </Section>

        <Section title="Affiliate Commission">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.affiliate_enabled}
              onChange={(e) => upd("affiliate_enabled", e.target.checked)}
            />{" "}
            Affiliates can earn on this product
          </label>
          <Field label="Commission type">
            <select
              className="w-full h-10 border rounded-md px-3 text-sm bg-white"
              value={f.affiliate_commission_kind}
              onChange={(e) =>
                upd("affiliate_commission_kind", e.target.value as ProductForm["affiliate_commission_kind"])
              }
            >
              <option value="">Inherit program default</option>
              <option value="percentage">Percentage of item value</option>
              <option value="fixed">Fixed ₹ per unit</option>
            </select>
          </Field>
          <Field label={f.affiliate_commission_kind === "fixed" ? "Commission (₹ per unit)" : "Commission (%)"}>
            <Input
              type="number"
              value={f.affiliate_commission_value ?? ""}
              placeholder="Leave blank to inherit"
              onChange={(e) =>
                upd("affiliate_commission_value", e.target.value === "" ? null : Number(e.target.value))
              }
            />
          </Field>
          <Field label="Max commission per order line (₹, optional)">
            <Input
              type="number"
              value={f.affiliate_max_commission ?? ""}
              placeholder="No cap"
              onChange={(e) =>
                upd("affiliate_max_commission", e.target.value === "" ? null : Number(e.target.value))
              }
            />
          </Field>
          <div className="text-xs text-slate-500">
            Payouts to affiliates are approved and paid from the Affiliates console.
          </div>
        </Section>

        <Section title="Shipping Dimensions">
          <Field label="Weight (grams)">
            <Input
              type="number"
              value={f.weight_g ?? ""}
              placeholder="Uses default weight when blank"
              onChange={(e) => upd("weight_g", e.target.value === "" ? null : Number(e.target.value))}
            />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Length (cm)">
              <Input type="number" value={f.dim_l ?? ""} onChange={(e) => upd("dim_l", e.target.value === "" ? null : Number(e.target.value))} />
            </Field>
            <Field label="Width (cm)">
              <Input type="number" value={f.dim_w ?? ""} onChange={(e) => upd("dim_w", e.target.value === "" ? null : Number(e.target.value))} />
            </Field>
            <Field label="Height (cm)">
              <Input type="number" value={f.dim_h ?? ""} onChange={(e) => upd("dim_h", e.target.value === "" ? null : Number(e.target.value))} />
            </Field>
          </div>
          <div className="text-xs text-slate-500">
            Used to calculate live delivery charges at checkout.
          </div>
        </Section>


        <Section title="Visibility & Flags">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_published} onChange={(e) => upd("is_published", e.target.checked)} /> Published</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_featured} onChange={(e) => upd("is_featured", e.target.checked)} /> Featured</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_bestseller} onChange={(e) => upd("is_bestseller", e.target.checked)} /> Best seller</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_new} onChange={(e) => upd("is_new", e.target.checked)} /> New arrival</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_sale} onChange={(e) => upd("is_sale", e.target.checked)} /> On sale</label>
          <Field label="Image seed (slug)"><Input value={f.image_seed} onChange={(e) => upd("image_seed", e.target.value)} placeholder="e.g. led-bulb" /></Field>
        </Section>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg">{saving ? "Saving…" : "Save Product"}</Button>
      </div>
    </div>
  );
}

function Section({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-4 space-y-3 ${className}`}>
      <div className="font-semibold text-sm uppercase tracking-wider text-slate-500">{title}</div>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <div className="text-xs font-medium text-slate-600">{label}</div>
      {children}
    </label>
  );
}
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
