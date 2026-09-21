import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Star, Trash2, Upload } from "lucide-react";
import { adminSetPrimaryProductImage } from "@/lib/catalog-admin.functions";

const MAX_PHOTOS_PER_SCOPE = 6;

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
export function ProductImageManager({
  productSku,
  productId,
  initialVariantSku = "",
  sectionId,
  variantOnly = false,
}: {
  productSku: string;
  productId: string;
  initialVariantSku?: string;
  sectionId?: string;
  variantOnly?: boolean;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [targetSkus, setTargetSkus] = useState<string[]>([initialVariantSku]);

  useEffect(() => {
    setTargetSkus([initialVariantSku]);
  }, [initialVariantSku]);

  const q = useQuery({
    queryKey: ["admin-product-images", productSku, productId],
    queryFn: async () => {
      const { data: fam, error: familyError } = await supabase
        .from("product_families")
        .select("id")
        .eq("main_sku", productSku)
        .maybeSingle();
      if (familyError) throw familyError;

      const { data: variants, error: variantsError } = fam
        ? await supabase
            .from("product_variants")
            .select("sku")
            .eq("family_id", fam.id)
            .order("sort_order")
        : { data: [] as { sku: string }[], error: null };
      if (variantsError) throw variantsError;

      let images: Row[] = [];
      if (fam) {
        const { data, error } = await supabase
          .from("product_images")
          .select("id, image_url, alt_text, variant_sku, sort_order, is_primary")
          .eq("family_id", fam.id)
          .order("sort_order");
        if (error) throw error;
        images = (data ?? []) as Row[];
      } else {
        const { data, error } = await supabase
          .from("product_images")
          .select("id, image_url, alt_text, variant_sku, sort_order, is_primary")
          .eq("product_id", productId)
          .order("sort_order");
        if (error) throw error;
        images = (data ?? []) as Row[];
      }

      return { familyId: fam?.id ?? null, skus: (variants ?? []).map((v) => v.sku), images };
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-product-images"] });
    // Storefront views that render product photos.
    for (const key of [
      "product-images",
      "product",
      "family",
      "family-products",
      "products",
      "families-page",
      "browse-products",
    ]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  };

  // Live sync across admin tabs and after uploads from anywhere.
  useRealtime(["product_images"], () => q.refetch());

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const uploadTargets = Array.from(new Set(targetSkus)).filter(
      (sku) => sku === "" || (q.data?.skus ?? []).includes(sku),
    );
    if (!uploadTargets.length) return toast.error("Select at least one variation");
    if (!q.data || q.error || uploadTargets.length !== targetSkus.length)
      return toast.error("Save and reload this SKU before attaching photos");
    for (const sku of uploadTargets) {
      const scopeImages = q.data.images.filter((image) => (image.variant_sku ?? "") === sku);
      const remaining = MAX_PHOTOS_PER_SCOPE - scopeImages.length;
      if (remaining <= 0) {
        return toast.error(`Maximum 6 photos are already saved for ${sku || "family gallery"}`);
      }
      if (files.length > remaining) {
        return toast.error(`You can add only ${remaining} more photo(s) to ${sku || "family gallery"}. Maximum is 6.`);
      }
    }
    setBusy(true);
    try {
      const baseBySku = new Map<string, number>();
      const hasPrimaryBySku = new Map<string, boolean>();
      for (const sku of uploadTargets) {
        const scopeImages = q.data.images.filter((image) => (image.variant_sku ?? "") === sku);
        baseBySku.set(
          sku,
          scopeImages.length ? Math.max(...scopeImages.map((image) => image.sort_order)) + 1 : 0,
        );
        hasPrimaryBySku.set(sku, scopeImages.some((image) => image.is_primary));
      }
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

        const rows = uploadTargets.map((sku) => ({
          family_id: q.data?.familyId ?? null,
          product_id: q.data?.familyId ? null : productId,
          variant_sku: sku || null,
          image_url: `/api/public/product-image/${path}`,
          alt_text: null,
          sort_order: (baseBySku.get(sku) ?? 0) + i,
          is_primary: !hasPrimaryBySku.get(sku) && i === 0,
        }));
        const ins = await supabase.from("product_images").insert(rows);
        if (ins.error) throw new Error(ins.error.message);
      }
      toast.success(
        uploadTargets.length === 1
          ? "Photos uploaded"
          : `Photos uploaded to ${uploadTargets.length} selections`,
      );
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
    try {
      await adminSetPrimaryProductImage({ data: { imageId: row.id } });
      toast.success(
        row.variant_sku ? `Primary photo set for ${row.variant_sku}` : "Primary family photo set",
      );
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not set primary photo");
    }
  };

  const changeScope = async (row: Row, nextSku: string) => {
    const previousSku = row.variant_sku ?? "";
    if (previousSku === nextSku) return;
    const destinationImages = (q.data?.images ?? []).filter((image) => (image.variant_sku ?? "") === nextSku);
    if (destinationImages.length >= MAX_PHOTOS_PER_SCOPE) {
      return toast.error("Maximum 6 photos are already saved for that selection");
    }
    const nextSortOrder = destinationImages.length
      ? Math.max(...destinationImages.map((image) => image.sort_order)) + 1
      : 0;
    const { error } = await supabase
      .from("product_images")
      .update({ variant_sku: nextSku || null, is_primary: false, sort_order: nextSortOrder })
      .eq("id", row.id);
    if (error) return toast.error(error.message);

    const previousScopeRest = (q.data?.images ?? []).filter(
      (image) => image.id !== row.id && (image.variant_sku ?? "") === previousSku,
    );
    if (row.is_primary && previousScopeRest.length) {
      await adminSetPrimaryProductImage({ data: { imageId: previousScopeRest[0].id } });
    }
    refresh();
  };

  const rowsForScope = (variantSku: string | null) =>
    (q.data?.images ?? [])
      .filter((image) => (image.variant_sku ?? "") === (variantSku ?? ""))
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);

  const changePosition = async (row: Row, position: number) => {
    const scopeRows = rowsForScope(row.variant_sku);
    const withoutRow = scopeRows.filter((image) => image.id !== row.id);
    const nextIndex = Math.max(0, Math.min(position - 1, withoutRow.length));
    const reordered = [...withoutRow.slice(0, nextIndex), row, ...withoutRow.slice(nextIndex)];
    const updates = reordered.map((image, index) =>
      image.sort_order === index
        ? Promise.resolve({ error: null })
        : supabase.from("product_images").update({ sort_order: index }).eq("id", image.id),
    );
    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);
    if (failed?.error) return toast.error(failed.error.message);
    toast.success("Photo order updated");
    refresh();
  };

  const remove = async (row: Row) => {
    if (
      !confirm(
        `Remove this photo from ${row.variant_sku ?? "the family gallery"}? The stored file will be retained for safety.`,
      )
    )
      return;
    const { error } = await supabase.from("product_images").delete().eq("id", row.id);
    if (error) return toast.error(error.message);

    // A file may be shared by duplicated products. Removing an association must
    // not delete media still referenced elsewhere. Storage cleanup is separate.

    // Never leave the gallery without a primary photo.
    const rest = (q.data?.images ?? []).filter(
      (r) => r.id !== row.id && (r.variant_sku ?? null) === (row.variant_sku ?? null),
    );
    if (row.is_primary && rest.length) {
      await adminSetPrimaryProductImage({ data: { imageId: rest[0].id } });
    }
    toast.success("Photo removed");
    refresh();
  };

  const skus = q.data?.skus ?? [];
  const uploadTargets = targetSkus.filter((sku) => sku === "" || skus.includes(sku));
  const images = (q.data?.images ?? [])
    .filter((row) => !variantOnly || row.variant_sku === (uploadTargets[0] || ""))
    .slice()
    .sort((a, b) => (a.variant_sku ?? "").localeCompare(b.variant_sku ?? "") || a.sort_order - b.sort_order);
  const selectedScope = uploadTargets[0] ?? "";
  const selectedCount = (q.data?.images ?? []).filter((image) => (image.variant_sku ?? "") === selectedScope).length;
  const remainingCount = Math.max(0, MAX_PHOTOS_PER_SCOPE - selectedCount);

  const toggleTarget = (sku: string, checked: boolean) => {
    if (variantOnly) return;
    setTargetSkus((current) => {
      const next = checked ? [...current, sku] : current.filter((item) => item !== sku);
      return Array.from(new Set(next));
    });
  };

  return (
    <div
      id={sectionId}
      className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 md:col-span-2 scroll-mt-6"
    >
      <div className="font-semibold text-sm uppercase tracking-wider text-slate-500">
        {variantOnly ? "Saved images for this SKU" : "Photos"}
      </div>
      {variantOnly && (
        <p className="text-sm text-slate-500">
          Changes to these saved images apply immediately to this SKU.
        </p>
      )}
      {!variantOnly && (
        <p className="text-sm text-slate-500">
          Upload up to 6 photos for the selected variation or family gallery. Mark any photo as main and set its position.
        </p>
      )}
      {q.isError && (
        <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          Could not load photos.{" "}
          <Button variant="outline" type="button" onClick={() => q.refetch()}>
            Retry
          </Button>
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-medium text-slate-600">Attach to variations</div>
            <p className="text-xs text-slate-500">Select one or many SKUs, then upload once.</p>
          </div>
          {!variantOnly && skus.length > 0 && (
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setTargetSkus(skus)}>
                Select all variations
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setTargetSkus([""])}>
                Family only
              </Button>
            </div>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm">
            <Checkbox
              checked={uploadTargets.includes("")}
              disabled={variantOnly}
              onCheckedChange={(checked) => toggleTarget("", checked === true)}
            />
            <span>All variations / family photo</span>
          </label>
          {skus.map((s) => (
            <label key={s} className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm">
              <Checkbox
                checked={uploadTargets.includes(s)}
                disabled={variantOnly}
                onCheckedChange={(checked) => toggleTarget(s, checked === true)}
              />
              <span className="break-all">{s}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onUpload(e.target.files)}
        />
        <Button
          type="button"
          disabled={busy || q.isPending || q.isError || uploadTargets.length === 0}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" /> {busy ? "Uploading…" : "Upload photos"}
        </Button>
        <div className="text-xs text-slate-500">
          {uploadTargets.length} selected · first selected has {selectedCount}/{MAX_PHOTOS_PER_SCOPE} photos · {remainingCount} left
        </div>
      </div>

      {images.length === 0 ? (
        <div className="text-xs text-slate-500">
          No photos yet. Upload square images for best results.
        </div>
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
                disabled={variantOnly}
                onChange={(e) => changeScope(row, e.target.value)}
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
                <select
                  aria-label="Photo position"
                  className="h-9 w-24 rounded-md border bg-white px-2 text-xs"
                  value={Math.max(1, rowsForScope(row.variant_sku).findIndex((image) => image.id === row.id) + 1)}
                  onChange={(e) => changePosition(row, Number(e.target.value))}
                >
                  {rowsForScope(row.variant_sku).map((image, index) => (
                    <option key={image.id} value={index + 1}>
                      {index + 1}{index === 0 ? "st" : index === 1 ? "nd" : index === 2 ? "rd" : "th"}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant={row.is_primary ? "default" : "outline"}
                  onClick={() => makePrimary(row)}
                >
                  <Star className="mr-1 h-3.5 w-3.5" /> {row.is_primary ? "Main" : "Make main"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label="Remove photo"
                  onClick={() => remove(row)}
                >
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
