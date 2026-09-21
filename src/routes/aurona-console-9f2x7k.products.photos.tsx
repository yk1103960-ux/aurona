import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CheckCircle2, ImageIcon, Upload } from "lucide-react";

export const Route = createFileRoute("/aurona-console-9f2x7k/products/photos")({
  component: BulkPhotos,
});

type Target = {
  /** Variant SKU, or null when the photo belongs to the whole family gallery. */
  variantSku: string | null;
  familyId: string;
  familySku: string;
  familyName: string;
};

type Row = {
  id: string;
  file: File;
  previewUrl: string;
  fileSlug: string;
  target: Target | null;
  matchedBy: "sku" | "family" | "manual" | "none";
  status: "ready" | "uploading" | "done" | "error" | "duplicate" | "invalid";
  message?: string;
};

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PHOTOS_PER_SCOPE = 6;

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normaliseSku = (value: string) => value.trim().toUpperCase().replace(/[\s_]+/g, "-");

function BulkPhotos() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  /** SKU/family directory used to map each filename to exactly one target. */
  const catalog = useQuery({
    queryKey: ["bulk-photo-targets"],
    staleTime: 60_000,
    queryFn: async () => {
      const [families, variants, images] = await Promise.all([
        supabase.from("product_families").select("id, name, main_sku"),
        supabase.from("product_variants").select("sku, family_id"),
        supabase.from("product_images").select("id, image_url, family_id, variant_sku, is_primary"),
      ]);
      if (families.error) throw families.error;
      if (variants.error) throw variants.error;
      if (images.error) throw images.error;

      const familyById = new Map(
        (families.data ?? []).map((f) => [
          f.id,
          { id: f.id, name: f.name as string, main_sku: (f.main_sku as string) ?? "" },
        ]),
      );

      const bySku = new Map<string, Target>();
      for (const variant of variants.data ?? []) {
        const family = familyById.get(variant.family_id as string);
        if (!family) continue;
        bySku.set(normaliseSku(variant.sku as string), {
          variantSku: variant.sku as string,
          familyId: family.id,
          familySku: family.main_sku,
          familyName: family.name,
        });
      }

      const byFamilySku = new Map<string, Target>();
      for (const family of familyById.values()) {
        if (!family.main_sku) continue;
        byFamilySku.set(normaliseSku(family.main_sku), {
          variantSku: null,
          familyId: family.id,
          familySku: family.main_sku,
          familyName: family.name,
        });
      }

      return {
        bySku,
        byFamilySku,
        targets: [...byFamilySku.values(), ...bySku.values()],
        images: images.data ?? [],
      };
    },
  });

  const targetOptions = useMemo(() => catalog.data?.targets ?? [], [catalog.data]);

  const matchFile = (name: string): { target: Target | null; matchedBy: Row["matchedBy"] } => {
    const data = catalog.data;
    if (!data) return { target: null, matchedBy: "none" };
    // Filenames may carry a trailing counter, e.g. CL-JOY-9W-2.jpg
    const base = name.replace(/\.[^.]+$/, "");
    const candidates = [base, base.replace(/[-_ ]\d+$/, "")];
    for (const candidate of candidates) {
      const key = normaliseSku(candidate);
      const sku = data.bySku.get(key);
      if (sku) return { target: sku, matchedBy: "sku" };
      const family = data.byFamilySku.get(key);
      if (family) return { target: family, matchedBy: "family" };
    }
    return { target: null, matchedBy: "none" };
  };

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const next: Row[] = [];
    for (const file of Array.from(files)) {
      const { target, matchedBy } = matchFile(file.name);
      const invalid = !ACCEPTED.includes(file.type)
        ? "Only JPG, PNG, WebP, GIF or AVIF images are allowed"
        : file.size > MAX_BYTES
          ? "Larger than 8 MB"
          : null;
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        previewUrl: URL.createObjectURL(file),
        fileSlug: slug(file.name),
        target,
        matchedBy,
        status: invalid ? "invalid" : "ready",
        message: invalid ?? undefined,
      });
    }
    setRows((prev) => {
      const seen = new Set(prev.map((r) => r.id));
      return [...prev, ...next.filter((r) => !seen.has(r.id))];
    });
  };

  const setTarget = (id: string, key: string) => {
    const target =
      targetOptions.find((t) => `${t.familyId}::${t.variantSku ?? ""}` === key) ?? null;
    setRows((prev) =>
      prev.map((row) =>
        row.id === id && row.status !== "done"
          ? {
              ...row,
              target,
              matchedBy: target ? "manual" : "none",
              status: row.status === "invalid" ? "invalid" : "ready",
              message: row.status === "invalid" ? row.message : undefined,
            }
          : row,
      ),
    );
  };

  const refreshEverything = () => {
    for (const key of [
      "bulk-photo-targets",
      "admin-product-images",
      "product-images",
      "compare-product-images",
      "product",
      "family",
      "family-products",
      "products",
      "families-page",
      "browse-products",
      "admin-product-master",
    ]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  };

  const uploadAll = async () => {
    const data = catalog.data;
    if (!data) return;
    const queue = rows.filter((row) => row.status === "ready" && row.target);
    if (!queue.length) return toast.error("Nothing ready to upload");
    setBusy(true);

    // Track per-scope state so sort order and the single primary photo stay correct.
    const existing = [...data.images];
    let uploaded = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of queue) {
      const target = row.target!;
      const scopeKey = `${target.familyId}::${target.variantSku ?? ""}`;
      const scopeImages = existing.filter(
        (image) =>
          image.family_id === target.familyId &&
          (image.variant_sku ?? "") === (target.variantSku ?? ""),
      );

      if (scopeImages.length >= MAX_PHOTOS_PER_SCOPE) {
        failed++;
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? { ...r, status: "error", message: "Maximum 6 photos already saved for this SKU" }
              : r,
          ),
        );
        continue;
      }

      // Same filename already attached to this exact target → skip, never duplicate.
      if (scopeImages.some((image) => (image.image_url as string).includes(`-${row.fileSlug}.`))) {
        skipped++;
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? { ...r, status: "duplicate", message: "Already uploaded for this SKU" }
              : r,
          ),
        );
        continue;
      }

      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, status: "uploading", message: undefined } : r)),
      );

      try {
        const ext = row.file.name.split(".").pop()?.toLowerCase() || "jpg";
        const folder = slug(target.variantSku ?? target.familySku ?? "family") || "family";
        const path = `products/${folder}/${Date.now()}-${row.fileSlug}.${ext}`;
        const up = await supabase.storage.from("media").upload(path, row.file, {
          cacheControl: "31536000",
          upsert: false,
        });
        if (up.error) throw new Error(up.error.message);

        const image_url = `/api/public/product-image/${path}`;
        const sortOrder =
          existing.filter((image) => image.family_id === target.familyId).length + uploaded;
        const isPrimary = !scopeImages.some((image) => image.is_primary);

        const ins = await supabase
          .from("product_images")
          .insert({
            family_id: target.familyId,
            product_id: null,
            variant_sku: target.variantSku,
            image_url,
            alt_text: null,
            sort_order: sortOrder,
            is_primary: isPrimary,
          })
          .select("id, image_url, family_id, variant_sku, is_primary")
          .single();
        if (ins.error) throw new Error(ins.error.message);

        existing.push(ins.data as (typeof existing)[number]);
        uploaded++;
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? {
                  ...r,
                  status: "done",
                  message: `Saved to ${target.variantSku ?? target.familySku} (${scopeKey.length ? "" : ""}${isPrimary ? "primary" : "gallery"})`,
                }
              : r,
          ),
        );
      } catch (error) {
        failed++;
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? {
                  ...r,
                  status: "error",
                  message: error instanceof Error ? error.message : "Upload failed",
                }
              : r,
          ),
        );
      }
    }

    setBusy(false);
    refreshEverything();
    if (uploaded) toast.success(`Uploaded ${uploaded} photo(s)`);
    if (skipped) toast.info(`${skipped} duplicate photo(s) skipped`);
    if (failed) toast.error(`${failed} photo(s) failed`);
  };

  const counts = useMemo(() => {
    const total = rows.length;
    return {
      total,
      ready: rows.filter((r) => r.status === "ready" && r.target).length,
      unmatched: rows.filter((r) => !r.target && r.status !== "done").length,
      done: rows.filter((r) => r.status === "done").length,
      failed: rows.filter((r) => r.status === "error").length,
      invalid: rows.filter((r) => r.status === "invalid").length,
      duplicate: rows.filter((r) => r.status === "duplicate").length,
    };
  }, [rows]);

  const visible = rows.filter(
    (row) =>
      !filter ||
      row.file.name.toLowerCase().includes(filter.toLowerCase()) ||
      (row.target?.variantSku ?? row.target?.familySku ?? "")
        .toLowerCase()
        .includes(filter.toLowerCase()),
  );

  return (
    <div className="max-w-6xl space-y-5">
      <Link
        to="/aurona-console-9f2x7k/products"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to products
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Bulk photo upload</h1>
        <p className="text-sm text-slate-500">
          Name each file after the SKU it belongs to (for example <code>CL-JOY-9W.jpg</code> or{" "}
          <code>CL-JOY-9W-2.jpg</code>). Photos are matched automatically, previewed here, and only
          added — existing photos are never replaced or deleted.
        </p>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy || catalog.isPending}
            onClick={() => fileRef.current?.click()}
          >
            <ImageIcon className="mr-1 h-4 w-4" /> Choose photos
          </Button>
          <Button type="button" disabled={busy || !counts.ready} onClick={uploadAll}>
            <Upload className="mr-1 h-4 w-4" />
            {busy ? "Uploading…" : `Upload ${counts.ready} photo(s)`}
          </Button>
          {rows.length > 0 && (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setRows([])}>
              Clear list
            </Button>
          )}
          {rows.length > 0 && (
            <Input
              className="h-9 w-48"
              placeholder="Filter by file or SKU"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          )}
        </div>

        {catalog.isError && (
          <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            Could not load the SKU list.{" "}
            <Button variant="outline" size="sm" onClick={() => catalog.refetch()}>
              Retry
            </Button>
          </div>
        )}

        {rows.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge tone="slate">{counts.total} selected</Badge>
            <Badge tone="emerald">{counts.ready} ready</Badge>
            {counts.unmatched > 0 && <Badge tone="amber">{counts.unmatched} need a SKU</Badge>}
            {counts.invalid > 0 && <Badge tone="rose">{counts.invalid} invalid</Badge>}
            {counts.duplicate > 0 && <Badge tone="amber">{counts.duplicate} duplicates</Badge>}
            {counts.done > 0 && <Badge tone="emerald">{counts.done} uploaded</Badge>}
            {counts.failed > 0 && <Badge tone="rose">{counts.failed} failed</Badge>}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">
          No photos selected yet. Choose photos named after your SKUs to begin.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <div className="hidden grid-cols-[72px_1fr_1fr_160px] gap-3 border-b bg-slate-50 p-3 text-xs uppercase tracking-wide text-slate-500 md:grid">
            <div>Preview</div>
            <div>File</div>
            <div>Goes to</div>
            <div>Status</div>
          </div>
          <div className="divide-y">
            {visible.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[56px_1fr] items-center gap-3 p-3 md:grid-cols-[72px_1fr_1fr_160px]"
              >
                <img
                  src={row.previewUrl}
                  alt={row.file.name}
                  className="h-14 w-14 rounded border bg-white object-contain"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{row.file.name}</div>
                  <div className="text-xs text-slate-500">
                    {(row.file.size / 1024).toFixed(0)} KB
                  </div>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <select
                    className="h-9 w-full rounded-md border bg-white px-2 text-xs"
                    disabled={busy || row.status === "done"}
                    value={
                      row.target ? `${row.target.familyId}::${row.target.variantSku ?? ""}` : ""
                    }
                    onChange={(e) => setTarget(row.id, e.target.value)}
                  >
                    <option value="">Not matched — choose a SKU</option>
                    {targetOptions.map((t) => (
                      <option
                        key={`${t.familyId}::${t.variantSku ?? ""}`}
                        value={`${t.familyId}::${t.variantSku ?? ""}`}
                      >
                        {t.variantSku
                          ? `${t.variantSku} — ${t.familyName}`
                          : `${t.familySku} (all variations) — ${t.familyName}`}
                      </option>
                    ))}
                  </select>
                  {row.matchedBy === "sku" && (
                    <div className="mt-1 text-[11px] text-emerald-700">Matched by SKU</div>
                  )}
                  {row.matchedBy === "family" && (
                    <div className="mt-1 text-[11px] text-emerald-700">
                      Matched to the family gallery
                    </div>
                  )}
                </div>
                <div className="col-span-2 text-xs md:col-span-1">
                  <StatusLabel row={row} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusLabel({ row }: { row: Row }) {
  if (row.status === "done")
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> {row.message ?? "Uploaded"}
      </span>
    );
  if (row.status === "uploading") return <span className="text-slate-500">Uploading…</span>;
  if (row.status === "error" || row.status === "invalid")
    return (
      <span className="inline-flex items-center gap-1 text-rose-700">
        <AlertTriangle className="h-3.5 w-3.5" /> {row.message}
      </span>
    );
  if (row.status === "duplicate")
    return <span className="text-amber-700">{row.message ?? "Duplicate"}</span>;
  return <span className="text-slate-500">{row.target ? "Ready" : "Needs a SKU"}</span>;
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-700",
  };
  return <span className={`rounded-full px-2 py-1 ${tones[tone] ?? tones.slate}`}>{children}</span>;
}
