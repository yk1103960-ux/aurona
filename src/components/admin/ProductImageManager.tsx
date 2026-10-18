import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Star, Trash2, Upload } from "lucide-react";
import { adminSetPrimaryProductImage, adminDeleteOpenedProductPhotos } from "@/lib/catalog-admin.functions";

const MAX_PHOTOS_PER_SCOPE = 6;

type Row = {
  id: string;
  image_url: string;
  alt_text: string | null;
  variant_sku: string | null;
  sort_order: number;
  is_primary: boolean;
};

type VariantTarget = {
  sku: string;
  attributes: Record<string, string>;
};

type VariantAxis = {
  axis_key: string;
  label: string;
  values: string[];
  sort_order: number;
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
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [confirmPhotos, setConfirmPhotos] = useState<string[]>([]);
  const [deletingPhotos, setDeletingPhotos] = useState(false);
  const [groupOptionKey, setGroupOptionKey] = useState(initialVariantSku ? "__sku" : "__family");
  const [groupValue, setGroupValue] = useState(initialVariantSku || "__all");

  useEffect(() => {
    setGroupOptionKey(initialVariantSku ? "__sku" : "__family");
    setGroupValue(initialVariantSku || "__all");
  }, [initialVariantSku]);

  useEffect(() => {
    setSelectedPhotos(new Set());
    setConfirmPhotos([]);
  }, [productId, productSku, initialVariantSku]);

  const q = useQuery({
    queryKey: ["admin-product-images", productSku, productId],
    queryFn: async () => {
      const { data: fam, error: familyError } = await supabase
        .from("product_families")
        .select("id,category_id")
        .eq("main_sku", productSku)
        .maybeSingle();
      if (familyError) throw familyError;
      const legacyProduct = !fam ? await supabase.from("products").select("category_id").eq("id", productId).single() : null;
      if (legacyProduct?.error) throw legacyProduct.error;

      const { data: variants, error: variantsError } = fam
        ? await supabase
            .from("product_variants")
            .select("sku, attributes")
            .eq("family_id", fam.id)
            .order("sort_order")
        : { data: [] as { sku: string; attributes: Record<string, string> | null }[], error: null };
      if (variantsError) throw variantsError;

      const { data: axes, error: axesError } = fam
        ? await supabase
            .from("product_variant_axes")
            .select("axis_key, label, values, sort_order")
            .eq("family_id", fam.id)
            .order("sort_order")
        : { data: [] as VariantAxis[], error: null };
      if (axesError) throw axesError;

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

      return {
        familyId: fam?.id ?? null,
        categoryId: fam ? fam.category_id : legacyProduct?.data?.category_id ?? null,
        variants: (variants ?? []).map((variant) => ({
          sku: variant.sku,
          attributes: (variant.attributes ?? {}) as Record<string, string>,
        })) as VariantTarget[],
        axes: (axes ?? []) as VariantAxis[],
        images,
      };
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

  const skus = (q.data?.variants ?? []).map((variant) => variant.sku);
  const axisOptions = (q.data?.axes ?? []).filter((axis) =>
    (q.data?.variants ?? []).some((variant) => Boolean(variant.attributes[axis.axis_key])),
  );
  const activeAxis = axisOptions.find((axis) => axis.axis_key === groupOptionKey) ?? axisOptions[0];
  const activeAxisValues = activeAxis
    ? Array.from(
        new Set(
          (q.data?.variants ?? [])
            .map((variant) => variant.attributes[activeAxis.axis_key])
            .filter(Boolean),
        ),
      )
    : [];
  const uploadTargets = variantOnly
    ? [initialVariantSku].filter(Boolean)
    : groupOptionKey === "__family"
      ? [""]
      : groupOptionKey === "__sku"
        ? groupValue === "__all"
          ? skus
          : skus.filter((sku) => sku === groupValue)
        : (q.data?.variants ?? [])
            .filter((variant) => {
              const value = variant.attributes[groupOptionKey];
              return groupValue === "__all" ? Boolean(value) : value === groupValue;
            })
            .map((variant) => variant.sku);

  useEffect(() => {
    if (variantOnly || !q.data) return;
    if (groupOptionKey === "__family") {
      if (groupValue !== "__all") setGroupValue("__all");
      return;
    }
    if (groupOptionKey === "__sku") {
      if (groupValue !== "__all" && !skus.includes(groupValue)) setGroupValue("__all");
      return;
    }
    const axis = axisOptions.find((item) => item.axis_key === groupOptionKey);
    if (!axis) {
      setGroupOptionKey(axisOptions[0]?.axis_key ?? (skus.length ? "__sku" : "__family"));
      setGroupValue("__all");
      return;
    }
    if (groupValue !== "__all" && !activeAxisValues.includes(groupValue)) setGroupValue("__all");
  }, [activeAxisValues, axisOptions, groupOptionKey, groupValue, q.data, skus, variantOnly]);

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const targets = Array.from(new Set(uploadTargets)).filter((sku) => sku === "" || skus.includes(sku));
    if (!targets.length) return toast.error("No matching variation found");
    if (!q.data || q.error || targets.length !== uploadTargets.length)
      return toast.error("Save and reload this SKU before attaching photos");
    for (const sku of targets) {
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
      for (const sku of targets) {
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

        const rows = targets.map((sku) => ({
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
        targets.length === 1
          ? "Photos uploaded"
          : `Photos uploaded to ${targets.length} variations`,
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

  const images = (q.data?.images ?? [])
    .filter((row) => !variantOnly || row.variant_sku === (uploadTargets[0] || ""))
    .slice()
    .sort((a, b) => (a.variant_sku ?? "").localeCompare(b.variant_sku ?? "") || a.sort_order - b.sort_order);
  const selectedScope = uploadTargets[0] ?? "";
  const selectedCount = (q.data?.images ?? []).filter((image) => (image.variant_sku ?? "") === selectedScope).length;
  const remainingCount = Math.max(0, MAX_PHOTOS_PER_SCOPE - selectedCount);
  const selectedVisible = images.filter(image => selectedPhotos.has(image.id));

  const deleteSelectedPhotos = async () => {
    if (!q.data || !confirmPhotos.length) return;
    setDeletingPhotos(true);
    try {
      const result = await adminDeleteOpenedProductPhotos({ data: {
        productId, familyId: q.data.familyId, categoryId: q.data.categoryId, photoIds: confirmPhotos,
      } });
      setSelectedPhotos(new Set());
      setConfirmPhotos([]);
      toast.success(`${result.deleted} photos deleted`);
      refresh();
      await q.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete selected photos");
    } finally {
      setDeletingPhotos(false);
    }
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

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="mb-3">
          <div className="text-xs font-medium text-slate-600">Set photos by option</div>
          <p className="text-xs text-slate-500">Choose Wattage, Body Colour, Size or SKU, then upload once for every matching variation.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block space-y-1">
            <div className="text-xs font-medium text-slate-600">Option</div>
            <select
              className="h-11 min-w-[160px] rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={groupOptionKey}
              disabled={variantOnly}
              onChange={(event) => {
                setGroupOptionKey(event.target.value);
                setGroupValue("__all");
              }}
            >
              <option value="__family">Family photo</option>
              {axisOptions.map((axis) => (
                <option key={axis.axis_key} value={axis.axis_key}>
                  {axis.label || axis.axis_key.replace(/_/g, " ")}
                </option>
              ))}
              {skus.length > 0 && <option value="__sku">Exact SKU</option>}
            </select>
          </label>

          <label className="block space-y-1">
            <div className="text-xs font-medium text-slate-600">Value</div>
            <select
              className="h-11 min-w-[200px] rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={groupValue}
              disabled={variantOnly || groupOptionKey === "__family"}
              onChange={(event) => setGroupValue(event.target.value)}
            >
              {groupOptionKey === "__family" ? (
                <option value="__all">All variations / family photo</option>
              ) : groupOptionKey === "__sku" ? (
                <>
                  <option value="__all">All SKUs</option>
                  {skus.map((sku) => (
                    <option key={sku} value={sku}>
                      {sku}
                    </option>
                  ))}
                </>
              ) : (
                <>
                  <option value="__all">All values</option>
                  {activeAxisValues.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </>
              )}
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
          <Button
            type="button"
            disabled={busy || q.isPending || q.isError || uploadTargets.length === 0}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {busy ? "Uploading…" : `Upload to ${uploadTargets.length || 0}`}
          </Button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Maximum 6 photos per variation. Existing photos stay unless you remove them.
        </p>
      </div>
      <div className="text-xs text-slate-500">
        {uploadTargets.length} selected · first selected has {selectedCount}/{MAX_PHOTOS_PER_SCOPE} photos · {remainingCount} left
      </div>

      {images.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-y border-border py-3">
          <Button type="button" variant="outline" disabled={deletingPhotos || busy}
            onClick={() => setSelectedPhotos(new Set(images.map(image => image.id)))}>
            Select All
          </Button>
          <Button type="button" variant="destructive" disabled={!selectedVisible.length || deletingPhotos || busy}
            onClick={() => setConfirmPhotos(selectedVisible.map(image => image.id))}>
            <Trash2 className="mr-2 h-4 w-4" />Delete Selected Photos
          </Button>
          <span className="text-sm text-muted-foreground">{selectedVisible.length} selected</span>
        </div>
      )}
      <AlertDialog open={confirmPhotos.length > 0} onOpenChange={open => { if (!open && !deletingPhotos) setConfirmPhotos([]); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmPhotos.length} selected photos?</AlertDialogTitle>
            <AlertDialogDescription>
              Only selected photos of this product will be removed. Products, variations and other categories stay unchanged. Shared stored files are retained for safety.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingPhotos}>Cancel</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={deletingPhotos} onClick={deleteSelectedPhotos}>
              {deletingPhotos ? "Deleting…" : "Delete Photos"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {images.length === 0 ? (
        <div className="text-xs text-slate-500">
          No photos yet. Upload square images for best results.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((row) => (
            <div key={row.id} className="rounded-lg border border-slate-200 p-2 space-y-2">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={selectedPhotos.has(row.id)} disabled={deletingPhotos || busy}
                  aria-label={`Select photo ${row.alt_text || row.variant_sku || row.id}`}
                  onCheckedChange={checked => setSelectedPhotos(previous => {
                    const next = new Set(previous);
                    if (checked === true) next.add(row.id); else next.delete(row.id);
                    return next;
                  })} />
                Select photo
              </label>
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
