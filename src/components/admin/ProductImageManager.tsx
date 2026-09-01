import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Star, Trash2, Upload } from "lucide-react";


type Row = {
  id: string;
  image_url: string;
  alt_text: string | null;
  variant_sku: string | null;
  sort_order: number;
  is_primary: boolean;
};

/**
 * Admin photo manager for a product family.
 *
 * Photos can be tagged with a variant SKU — the product page then shows only
 * that variant's photo when the shopper switches variation, falling back to the
 * untagged family photos.
 */
export function ProductImageManager({ productSku, productId }: { productSku: string; productId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [targetSku, setTargetSku] = useState("");

  const q = useQuery({
    queryKey: ["admin-product-images", productSku, productId],
    queryFn: async () => {
      const { data: fam } = await supabase
        .from("product_families")
        .select("id")
        .eq("main_sku", productSku)
        .maybeSingle();

      const { data: variants } = fam
        ? await supabase
            .from("product_variants")
            .select("sku")
            .eq("family_id", fam.id)
            .order("sort_order")
        : { data: [] as { sku: string }[] };

      let images: Row[] = [];
      if (fam) {
        const { data } = await supabase
          .from("product_images")
          .select("id, image_url, alt_text, variant_sku, sort_order, is_primary")
          .eq("family_id", fam.id)
          .order("sort_order");
        images = (data ?? []) as Row[];
      } else {
        const { data } = await supabase
          .from("product_images")
          .select("id, image_url, alt_text, variant_sku, sort_order, is_primary")
          .eq("product_id", productId)
          .order("sort_order");
        images = (data ?? []) as Row[];
      }

      return { familyId: fam?.id ?? null, skus: (variants ?? []).map((v) => v.sku), images };
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-product-images"] });
    // Storefront views that render product photos.
    for (const key of ["product-images", "product", "family", "family-products", "products", "families-page", "browse-products"]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  };

  // Live sync across admin tabs and after uploads from anywhere.
  useRealtime(["product_images"], () => q.refetch());

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const base = q.data?.images.length ?? 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image`);
        if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name} is larger than 8 MB`);
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `products/${productSku.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${Date.now()}-${i}.${ext}`;
        const up = await supabase.storage.from("media").upload(path, file, {
          cacheControl: "31536000",
          upsert: false,
        });
        if (up.error) throw new Error(up.error.message);

        const ins = await supabase.from("product_images").insert({
          family_id: q.data?.familyId ?? null,
          product_id: q.data?.familyId ? null : productId,
          variant_sku: targetSku || null,
          image_url: `/api/public/product-image/${path}`,
          alt_text: null,
          sort_order: base + i,
          is_primary: base + i === 0,
        });
        if (ins.error) throw new Error(ins.error.message);
      }
      toast.success("Photos uploaded");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const patch = async (id: string, values: Partial<Row>) => {
    const { error } = await supabase.from("product_images").update(values).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const makePrimary = async (row: Row) => {
    const others = (q.data?.images ?? []).filter((r) => r.id !== row.id && r.is_primary);
    for (const o of others) await supabase.from("product_images").update({ is_primary: false }).eq("id", o.id);
    await patch(row.id, { is_primary: true });
  };

  const remove = async (row: Row) => {
    const { error } = await supabase.from("product_images").delete().eq("id", row.id);
    if (error) return toast.error(error.message);

    // Drop the underlying file too so the bucket does not fill with orphans.
    const storagePath = row.image_url.startsWith("/api/public/product-image/")
      ? row.image_url.replace("/api/public/product-image/", "")
      : null;
    if (storagePath) await supabase.storage.from("media").remove([storagePath]);

    // Never leave the gallery without a primary photo.
    const rest = (q.data?.images ?? []).filter((r) => r.id !== row.id);
    if (row.is_primary && rest.length) {
      await supabase.from("product_images").update({ is_primary: true }).eq("id", rest[0].id);
    }
    toast.success("Photo removed");
    refresh();
  };


  const skus = q.data?.skus ?? [];
  const images = q.data?.images ?? [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 md:col-span-2">
      <div className="font-semibold text-sm uppercase tracking-wider text-slate-500">Photos</div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block space-y-1">
          <div className="text-xs font-medium text-slate-600">Attach to variation</div>
          <select
            className="h-10 min-w-[220px] rounded-md border px-3 text-sm bg-white"
            value={targetSku}
            onChange={(e) => setTargetSku(e.target.value)}
          >
            <option value="">All variations (family photo)</option>
            {skus.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onUpload(e.target.files)}
        />
        <Button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" /> {busy ? "Uploading…" : "Upload photos"}
        </Button>
      </div>

      {images.length === 0 ? (
        <div className="text-xs text-slate-500">No photos yet. Upload square images for best results.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((row) => (
            <div key={row.id} className="rounded-lg border border-slate-200 p-2 space-y-2">
              <img
                src={row.image_url}
                alt={row.alt_text ?? ""}
                className="aspect-square w-full rounded bg-white object-contain"
              />
              <select
                className="h-9 w-full rounded-md border px-2 text-xs bg-white"
                value={row.variant_sku ?? ""}
                onChange={(e) => patch(row.id, { variant_sku: e.target.value || null })}
              >
                <option value="">All variations</option>
                {skus.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <Input
                key={`${row.id}-alt`}
                className="h-9 text-xs"
                placeholder="Image name / alt text"
                defaultValue={row.alt_text ?? ""}
                onBlur={(e) => {
                  const next = e.target.value.trim() || null;
                  if (next !== (row.alt_text ?? null)) patch(row.id, { alt_text: next });
                }}
              />
              <div className="flex items-center gap-2">
                <Input
                  className="h-9 w-16 text-xs"
                  type="number"
                  value={row.sort_order}
                  onChange={(e) => patch(row.id, { sort_order: Number(e.target.value) })}
                />
                <Button
                  type="button"
                  size="sm"
                  variant={row.is_primary ? "default" : "outline"}
                  onClick={() => makePrimary(row)}
                >
                  <Star className="mr-1 h-3.5 w-3.5" /> {row.is_primary ? "Primary" : "Set primary"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => remove(row)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
