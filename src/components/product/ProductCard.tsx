import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GitCompare, Heart, Link2, Minus, Plus, ShoppingCart, Star, Phone, Truck, Zap } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { discountPct, inr } from "@/lib/format";
import { familyQuery, familyProductsQuery, type Product, type ProductFamily } from "@/lib/queries";
import { ProductImage } from "./ProductImage";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useCompare } from "@/hooks/useCompare";
import { useAuth } from "@/hooks/useAuth";
import { useMyRole, useVisiblePrices } from "@/lib/pricing";
import { getMyApprovedAffiliateIdentity } from "@/lib/affiliate.functions";
import { supabase } from "@/integrations/supabase/client";
import { useVariantSelection } from "@/hooks/useVariantSelection";

type Row = Product & {
  categories: { slug: string; name: string; icon?: string | null } | null;
  image_url?: string | null;
  color?: string | null;
  finish?: string | null;
};

/** Family name only — strips variant suffixes like " - 3 W, RGB, Pack of 6". */
function baseName(name: string): string {
  return name.split(/\s+[-—–]\s+/)[0].trim() || name;
}

export function ProductCard({
  product,
  categoryIcon,
  compact,
  nameOnly,
}: {
  product: Row;
  categoryIcon?: string | null;
  compact?: boolean;
  /** Show only the family name (used in recommendation rails). */
  nameOnly?: boolean;
}) {
  const cart = useCart();
  const wl = useWishlist();
  const compare = useCompare();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const { user } = useAuth();
  const fetchAffiliate = useServerFn(getMyApprovedAffiliateIdentity);
  const { data: affiliateData } = useQuery({
    queryKey: ["approved-affiliate-identity", user?.id],
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchAffiliate({}),
  });
  const reduce = useReducedMotion();
  const role = useMyRole();
  const { data: priceMap } = useVisiblePrices(product.sku ? [product.sku] : []);
  const rp = product.sku ? priceMap?.[product.sku] : undefined;
  const shownPrice = rp?.price ?? Number(product.price);
  const shownMrp = rp?.mrp ?? Number(product.mrp);
  const off = discountPct(shownMrp, shownPrice);
  const icon = categoryIcon ?? product.categories?.icon ?? null;
  const inWishlist = wl.has(product.id, product.sku);
  const detailSlug = product.slug;
  const detailSearch = product.family_slug ? { v: product.sku } : {};

  const line = cart.lineFor(product.id, product.sku);
  const qty = line?.quantity ?? 0;
  const stock = Number(product.stock ?? 0);
  const lowStock = stock > 0 && stock <= 8;
  const outOfStock = stock <= 0;
  const spec = product.wattage ?? product.size ?? null;

  const handleAdd = () => {
    setQuickAddOpen(true);
  };

  const handleWishlist = () => {
    wl.toggle.mutate({ productId: product.id, sku: product.sku });
  };

  const copyAffiliateLink = async () => {
    const code = affiliateData?.affiliate?.code;
    if (!code) return;
    const url = `${window.location.origin}/products/${detailSlug}${product.family_slug ? `?v=${encodeURIComponent(product.sku)}&ref=${encodeURIComponent(code)}` : `?ref=${encodeURIComponent(code)}`}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Affiliate product link copied");
    } catch {
      toast.error("Couldn't copy the affiliate link.");
    }
  };

  return (
    <div className="card-lift group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_2px_10px_-4px_rgba(15,23,42,0.08)] hover:border-primary/40">
      <Link
        to="/products/$slug"
        params={{ slug: detailSlug }}
        search={detailSearch}
        className="relative block overflow-hidden bg-gradient-to-b from-white via-white to-sky-50/40"
        aria-label={product.name}
      >
        <div className={cn("aspect-square w-full overflow-hidden bg-white p-3 sm:p-4", compact && "aspect-square")}>
          <ProductImage
            product={product}
            categoryIcon={icon}
            className="h-full w-full object-contain transform-gpu transition-transform duration-[800ms] ease-out will-change-transform group-hover:scale-[1.04]"
            iconClassName={compact ? "h-12 w-12" : "h-20 w-20"}
          />
        </div>
        <span
          className="pointer-events-none absolute inset-x-6 bottom-2 h-6 rounded-full bg-primary/15 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden
        />
      </Link>

      {off > 0 && (
        <span className="pointer-events-none absolute left-3 top-3 rounded-full btn-gradient px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider">
          {off}% OFF
        </span>
      )}
      {product.is_bestseller && (
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground shadow-[0_4px_12px_-4px_color-mix(in_oklab,var(--color-accent)_60%,transparent)]">
          Bestseller
        </span>
      )}
      <button
        type="button"
        onClick={() => compare.toggle(detailSlug, baseName(product.name))}
        className={cn(
          "press absolute right-3 top-[5.5rem] grid h-10 w-10 place-items-center rounded-full bg-card/90 shadow-soft ring-1 ring-border backdrop-blur transition hover:bg-card hover:ring-primary/40",
          compare.has(detailSlug) && "text-primary ring-primary/40",
        )}
        aria-label={compare.has(detailSlug) ? "Remove from compare" : "Add to compare"}
        aria-pressed={compare.has(detailSlug)}
      >
        <GitCompare className="h-4 w-4" />
      </button>

      <motion.button
        onClick={handleWishlist}
        whileTap={reduce ? undefined : { scale: 0.88 }}
        animate={inWishlist && !reduce ? { scale: [1, 1.25, 1] } : { scale: 1 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "press absolute right-3 top-12 grid h-10 w-10 place-items-center rounded-full bg-card/90 shadow-soft ring-1 ring-border backdrop-blur transition hover:bg-card hover:ring-primary/40",
          inWishlist && "text-destructive ring-destructive/30",
        )}
        aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
        aria-pressed={inWishlist}
      >
        <Heart className={cn("h-4 w-4 transition", inWishlist && "fill-current")} />
      </motion.button>

      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-eyebrow text-[10px]">{product.categories?.name ?? "Aurona"}</span>
          {spec && (
            <span className="rounded-md bg-primary/8 px-1.5 py-0.5 text-[10px] font-bold text-primary">{spec}</span>
          )}
          {product.color && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {product.color}
            </span>
          )}
          {product.finish && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {product.finish}
            </span>
          )}
        </div>
        <Link
          to="/products/$slug"
          params={{ slug: detailSlug }}
          search={detailSearch}
          className="line-clamp-2 min-h-[2.6em] text-[15px] font-semibold leading-snug text-foreground transition-colors hover:text-primary"
        >
          {nameOnly ? baseName(product.name) : product.name}
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/8 px-2 py-0.5 text-primary">
            <Star className="h-3 w-3 fill-primary text-primary" />
            <span className="font-semibold">{Number(product.rating).toFixed(1)}</span>
          </span>
          <span>· {product.review_count} reviews</span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          {role.isPartnerPending ? (
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">Price hidden</span>
          ) : shownPrice > 0 ? (
            <>
              {product.price_from && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">From</span>
              )}
              <span className="text-xl font-bold tracking-tight text-foreground">{inr(shownPrice)}</span>
              {shownMrp > shownPrice && (
                <span className="text-xs text-muted-foreground line-through">{inr(shownMrp)}</span>
              )}
              <span className="ml-auto text-[11px] text-muted-foreground">/ {product.unit}</span>
            </>
          ) : (
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">Price on request</span>
          )}
        </div>

        {role.isPartnerPending ? (
          <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            Price visible after Aurona approval
          </div>
        ) : role.role === "retailer" ? (
          <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">Retailer price</div>
        ) : role.role === "distributor" ? (
          <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">Distributor price</div>
        ) : null}

        {affiliateData?.affiliate && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-1 w-full gap-2 rounded-full border-primary/30 text-primary"
            onClick={copyAffiliateLink}
          >
            <Link2 className="h-3.5 w-3.5" /> Copy affiliate link
          </Button>
        )}

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Truck className="h-3.5 w-3.5 text-success" />
          <span>Delivery charges calculated at checkout</span>
        </div>

        {lowStock && (
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
            <Zap className="h-3.5 w-3.5" /> Only {stock} left
          </div>
        )}

        {outOfStock && <div className="text-[11px] font-semibold text-muted-foreground">Currently out of stock</div>}

        {role.isPartnerPending ? (
          <div className="mt-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-2 text-center text-[11px] font-semibold text-primary">
            Verification pending
          </div>
        ) : shownPrice <= 0 ? (
          <Button asChild size="sm" className="mt-2 w-full gap-2 rounded-full">
            <a href="tel:+919602570026" aria-label="Contact Aurona">
              <Phone className="h-4 w-4" /> Product enquiry
            </a>
          </Button>
        ) : qty > 0 ? (
          <div className="mt-2 flex h-9 items-center justify-between rounded-full btn-gradient px-1">
            <button
              type="button"
              onClick={() => cart.updateQty.mutate({ id: line!.id, quantity: qty - 1 })}
              className="grid h-7 w-7 place-items-center rounded-full bg-white/20 transition hover:bg-white/30"
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="text-sm font-bold tabular-nums" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => cart.updateQty.mutate({ id: line!.id, quantity: qty + 1 })}
              className="grid h-7 w-7 place-items-center rounded-full bg-white/20 transition hover:bg-white/30"
              aria-label="Increase quantity"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <Button
            size="sm"
            className="press mt-2 w-full gap-2 rounded-full"
            onClick={handleAdd}
            disabled={cart.add.isPending || outOfStock}
          >
            <ShoppingCart className="h-4 w-4" /> {outOfStock ? "Notify me" : "ADD"}
          </Button>
        )}
      </div>

      <QuickAddDialog open={quickAddOpen} onOpenChange={setQuickAddOpen} product={product} categoryIcon={icon} />
    </div>
  );
}

function QuickAddDialog({
  open,
  onOpenChange,
  product,
  categoryIcon,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Row;
  categoryIcon?: string | null;
}) {
  const cart = useCart();

  // Resolve the exact same product family used by the real PDP.
  // Normally ProductCard already has family_slug. If it doesn't, resolve
  // the family through public_product_variants using the card SKU.
  const { data: resolvedFamilySlug } = useQuery({
    queryKey: [
      "quick-add-family-slug-v2",
      product.family_slug ?? null,
      product.slug,
      product.sku,
      baseName(product.name),
    ],
    enabled: open && !product.family_slug,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const sku = String(product.sku ?? "").trim();
      const slug = String(product.slug ?? "")
        .trim()
        .toLowerCase();
      const name = baseName(product.name).trim().toLowerCase();

      // 1) Exact variant SKU -> family.
      if (sku) {
        const exact = await supabase
          .from("public_product_variants")
          .select("family_id, product_families!inner(slug)")
          .eq("sku", sku)
          .maybeSingle();

        if (exact.error) throw exact.error;

        const exactSlug =
          (exact.data as { product_families?: { slug?: string | null } } | null)?.product_families?.slug ?? null;

        if (exactSlug) return exactSlug;
      }

      // 2) Family summary/main SKU fallback.
      const familiesResult = await supabase.from("product_families").select("slug, main_sku, name");

      if (familiesResult.error) throw familiesResult.error;

      const families = (familiesResult.data ?? []) as Array<{
        slug: string;
        main_sku: string | null;
        name?: string | null;
      }>;

      if (sku) {
        const byMainSku = families
          .filter((f) => {
            const mainSku = String(f.main_sku ?? "").trim();
            if (!mainSku) return false;
            return sku === mainSku || sku.startsWith(`${mainSku}-`) || mainSku.startsWith(`${sku}-`);
          })
          .sort((a, b) => String(b.main_sku ?? "").length - String(a.main_sku ?? "").length)[0];

        if (byMainSku?.slug) return byMainSku.slug;
      }

      // 3) Last safe fallback: family slug/name identity.
      const normalize = (value: string) =>
        value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim();

      const normalizedName = normalize(name);
      const byIdentity = families.find((f) => {
        const familySlug = String(f.slug ?? "").toLowerCase();
        const familyName = normalize(String(f.name ?? ""));
        return (
          familySlug === slug ||
          slug === familySlug ||
          slug.startsWith(`${familySlug}-`) ||
          familySlug.startsWith(`${slug}-`) ||
          (familyName && familyName === normalizedName)
        );
      });

      return byIdentity?.slug ?? null;
    },
  });

  const familySlug = product.family_slug ?? resolvedFamilySlug ?? product.slug;
  const familyResult = useQuery({
    ...familyQuery(familySlug),
    enabled: open && Boolean(familySlug),
  });

  const family = familyResult.data ?? null;
  const isLoading = familyResult.isLoading || (open && !product.family_slug && resolvedFamilySlug === undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-[720px] overflow-hidden p-0 sm:rounded-2xl">
        {isLoading ? (
          <div className="grid gap-0 sm:grid-cols-[300px_minmax(0,1fr)]">
            <div className="border-b border-border bg-surface/40 p-2.5 sm:border-b-0 sm:border-r">
              <div className="mx-auto aspect-square w-full max-w-[165px] animate-pulse rounded-xl bg-muted" />
              <div className="mt-3 grid w-full grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="aspect-square w-full animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            </div>
            <div className="p-3.5 sm:p-4">
              <div className="h-7 w-44 animate-pulse rounded bg-muted" />
              <div className="mt-4 h-9 animate-pulse rounded bg-muted" />
              <div className="mt-3 h-9 animate-pulse rounded bg-muted" />
              <div className="mt-3 h-9 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ) : family ? (
          <FamilyQuickAddContent
            key={family.id}
            family={family}
            initialSku={product.sku}
            categoryIcon={categoryIcon}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <LegacyQuickAddContent
            product={product}
            categoryIcon={categoryIcon}
            onDone={() => onOpenChange(false)}
            cart={cart}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FamilyQuickAddContent({
  family,
  initialSku,
  categoryIcon,
  onDone,
}: {
  family: ProductFamily;
  initialSku?: string;
  categoryIcon?: string | null;
  onDone: () => void;
}) {
  const cart = useCart();
  const [quickQty, setQuickQty] = useState(1);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);

  const { selection, setAxis, variant, isAvailable } = useVariantSelection(family, initialSku);

  const skus = useMemo(() => family.variants.map((v) => v.sku).filter(Boolean), [family]);

  const { data: productMap } = useQuery(familyProductsQuery(skus));
  const productId = productMap?.[variant.sku]?.id ?? variant.product_id ?? null;

  const stock = Number(variant.stock ?? 0);
  const inStock = stock > 0;
  const packSize = Number(variant.pack_size ?? variant.moq ?? 1);
  const maxQty = Math.max(1, stock);

  // REAL related photos from product_images.
  //
  // Important: older uploads are not always linked by family_id.
  // Some rows are linked only by product_id or variant_sku, so we load
  // all three relationships and merge them. This prevents an empty gallery
  // when family_id is null on existing image rows.
  const imagesQuery = useQuery({
    queryKey: [
      "quick-add-product-images-v3",
      family.id,
      variant.sku,
      productId,
      skus.join("|"),
      Object.values(productMap ?? {})
        .map((row: any) => row?.id)
        .filter(Boolean)
        .join("|"),
    ],
    enabled: Boolean(family.id || variant.sku || productId),
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const columns = "id, image_url, alt_text, sort_order, is_primary, family_id, product_id, variant_sku";

      const productIds = Array.from(
        new Set(
          [productId, ...Object.values(productMap ?? {}).map((row: any) => row?.id ?? null)].filter(
            Boolean,
          ) as string[],
        ),
      );

      const requests: PromiseLike<any>[] = [];

      if (family.id) {
        requests.push(
          supabase
            .from("product_images")
            .select(columns)
            .eq("family_id", family.id)
            .order("is_primary", { ascending: false })
            .order("sort_order", { ascending: true }),
        );
      }

      if (skus.length > 0) {
        requests.push(
          supabase
            .from("product_images")
            .select(columns)
            .in("variant_sku", skus)
            .order("is_primary", { ascending: false })
            .order("sort_order", { ascending: true }),
        );
      }

      if (productIds.length > 0) {
        requests.push(
          supabase
            .from("product_images")
            .select(columns)
            .in("product_id", productIds)
            .order("is_primary", { ascending: false })
            .order("sort_order", { ascending: true }),
        );
      }

      const results = await Promise.all(requests);

      const merged: any[] = [];
      const seenIds = new Set<string>();

      for (const result of results) {
        if (result.error) throw result.error;

        for (const row of result.data ?? []) {
          if (!row?.id || seenIds.has(row.id)) continue;
          seenIds.add(row.id);
          merged.push(row);
        }
      }

      // Selected variation first, then selected product, then family/general images.
      return merged.sort((a, b) => {
        const score = (row: any) => {
          if (row.variant_sku === variant.sku) return 0;
          if (productId && row.product_id === productId) return 1;
          if (row.family_id === family.id && !row.variant_sku) return 2;
          if (!row.variant_sku) return 3;
          return 4;
        };

        return (
          score(a) - score(b) ||
          Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) ||
          Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
        );
      });
    },
  });

  const galleryImages = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ id: string; image_url: string; alt_text?: string | null }> = [];

    for (const row of imagesQuery.data ?? []) {
      const url = String(row.image_url ?? "").trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      result.push({
        id: row.id,
        image_url: url,
        alt_text: row.alt_text,
      });
      if (result.length >= 6) break;
    }

    // Fallback to selected variant/family image only when DB has no photos.
    if (result.length === 0) {
      const fallback = String(variant.image_url ?? family.image_url ?? "").trim();
      if (fallback) {
        result.push({
          id: `fallback-${variant.sku}`,
          image_url: fallback,
          alt_text: family.name,
        });
      }
    }

    return result;
  }, [imagesQuery.data, variant.sku, variant.image_url, family.image_url, family.name]);

  const selectedImageUrl =
    activeImageUrl && galleryImages.some((img) => img.image_url === activeImageUrl)
      ? activeImageUrl
      : (galleryImages[0]?.image_url ?? null);

  const addSelected = () => {
    if (!productId) {
      toast.error("This variation is not linked to an orderable product.");
      return;
    }

    if (!inStock) {
      toast.error("This variation is currently out of stock.");
      return;
    }

    const quantity = Math.max(1, Math.min(quickQty, maxQty));

    cart.add.mutate(
      { productId, quantity },
      {
        onSuccess: () => {
          toast.success("Added to cart", {
            description: `${family.name} · ${variant.sku} · Qty ${quantity}`,
            duration: 1600,
          });
          onDone();
        },
      },
    );
  };

  return (
    <div className="grid min-h-0 gap-0 sm:grid-cols-[300px_minmax(0,1fr)]">
      {/* LEFT: compact real-photo gallery */}
      <div className="border-b border-border bg-surface/40 p-2.5 sm:border-b-0 sm:border-r">
        <div className="mx-auto flex h-[140px] w-[140px] items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-white p-1.5 sm:h-[165px] sm:w-[165px]">
          {selectedImageUrl ? (
            <img src={selectedImageUrl} alt={family.name} className="h-full w-full object-contain" />
          ) : (
            <ProductImage
              product={
                {
                  ...variant,
                  name: family.name,
                  slug: family.slug,
                  image_seed: variant.image_seed ?? family.image_seed,
                  image_url: variant.image_url ?? family.image_url,
                } as any
              }
              categoryIcon={categoryIcon}
              className="h-full w-full object-contain"
            />
          )}
        </div>

        <div className="mt-2.5">
          <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Related photos
          </div>

          {imagesQuery.isLoading ? (
            <div className="grid w-full grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="aspect-square w-full animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : galleryImages.length > 0 ? (
            <div className="grid w-full grid-cols-3 gap-2">
              {galleryImages.map((image, index) => {
                const active = selectedImageUrl === image.image_url;

                return (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setActiveImageUrl(image.image_url)}
                    className={cn(
                      "aspect-square w-full overflow-hidden rounded-xl border bg-white p-1.5 transition-all",
                      active ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/60",
                    )}
                    aria-label={`Show product photo ${index + 1}`}
                  >
                    <img
                      src={image.image_url}
                      alt={image.alt_text || `${family.name} photo ${index + 1}`}
                      className="h-full w-full object-contain"
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground">No additional photos uploaded for this variation.</div>
          )}
        </div>
      </div>

      {/* RIGHT: choices + quantity + CTA */}
      <div className="p-3.5 sm:p-4">
        <DialogHeader>
          <DialogTitle className="text-display text-lg leading-tight">{family.name}</DialogTitle>
        </DialogHeader>

        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-lg font-bold">{inr(Number(variant.price ?? 0))}</span>
          {Number(variant.mrp ?? 0) > Number(variant.price ?? 0) && (
            <span className="text-xs text-muted-foreground line-through">{inr(Number(variant.mrp ?? 0))}</span>
          )}
        </div>

        {/* Quantity is intentionally near the top so it cannot disappear below the fold. */}
        <div className="mt-3 rounded-xl border border-border bg-surface/30 p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-bold">Quantity</span>
            <span className="text-[11px] text-muted-foreground">{stock} available</span>
          </div>

          <div className="inline-flex h-9 items-center overflow-hidden rounded-full border border-primary/30 bg-background shadow-sm">
            <button
              type="button"
              onClick={() => setQuickQty((q) => Math.max(1, q - 1))}
              disabled={quickQty <= 1}
              className="grid h-9 w-9 place-items-center text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </button>

            <span className="min-w-10 border-x border-border px-2 text-center text-sm font-black tabular-nums">
              {quickQty}
            </span>

            <button
              type="button"
              onClick={() => setQuickQty((q) => Math.min(maxQty, q + 1))}
              disabled={!inStock || quickQty >= maxQty}
              className="grid h-9 w-9 place-items-center text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {family.axes.length > 0 ? (
          <div className="mt-3 space-y-2.5">
            {family.axes.map((axis) => (
              <div key={axis.axis_key}>
                <div className="mb-1 text-[11px] font-semibold">
                  {axis.label}
                  <span className="ml-2 font-normal text-muted-foreground">{selection[axis.axis_key]}</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {axis.values.map((value) => {
                    const active = selection[axis.axis_key] === value;
                    const available = isAvailable(axis.axis_key, value);

                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={!available}
                        onClick={() => {
                          setAxis(axis.axis_key, value);
                          setQuickQty(1);
                          setActiveImageUrl(null);
                        }}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-[11px] font-medium transition",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:border-primary/60",
                          !available && "cursor-not-allowed opacity-35 line-through",
                        )}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
            This product has one available variation.
          </div>
        )}

        <div className="mt-2.5 text-[10px] text-muted-foreground">
          SKU {variant.sku}
          {packSize > 1 ? ` · Pack of ${packSize}` : ""}
        </div>

        <Button
          type="button"
          size="lg"
          className="mt-3 h-10 w-full gap-2 rounded-full text-sm font-bold"
          onClick={addSelected}
          disabled={cart.add.isPending || !inStock || !productId}
        >
          <ShoppingCart className="h-4 w-4" />
          {cart.add.isPending ? "Adding..." : `Add ${quickQty} to cart`}
        </Button>
      </div>
    </div>
  );
}

function LegacyQuickAddContent({
  product,
  categoryIcon,
  onDone,
  cart,
}: {
  product: Row;
  categoryIcon?: string | null;
  onDone: () => void;
  cart: ReturnType<typeof useCart>;
}) {
  const [quickQty, setQuickQty] = useState(1);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);

  const stock = Number(product.stock ?? 0);
  const inStock = stock > 0;
  const maxQty = Math.max(1, stock);

  const imagesQuery = useQuery({
    queryKey: ["quick-add-legacy-images", product.id, product.sku],
    enabled: Boolean(product.id),
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_images")
        .select("id, image_url, alt_text, sort_order, is_primary, product_id, variant_sku")
        .eq("product_id", product.id)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  const galleryImages = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ id: string; image_url: string; alt_text?: string | null }> = [];

    for (const row of imagesQuery.data ?? []) {
      const url = String(row.image_url ?? "").trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      result.push({ id: row.id, image_url: url, alt_text: row.alt_text });
      if (result.length >= 6) break;
    }

    const fallback = String(product.image_url ?? "").trim();
    if (result.length === 0 && fallback) {
      result.push({
        id: `fallback-${product.id}`,
        image_url: fallback,
        alt_text: product.name,
      });
    }

    return result;
  }, [imagesQuery.data, product.id, product.image_url, product.name]);

  const selectedImageUrl =
    activeImageUrl && galleryImages.some((img) => img.image_url === activeImageUrl)
      ? activeImageUrl
      : (galleryImages[0]?.image_url ?? null);

  const add = () => {
    if (!inStock) {
      toast.error("This product is currently out of stock.");
      return;
    }

    const quantity = Math.max(1, Math.min(quickQty, maxQty));

    cart.add.mutate(
      {
        productId: product.id,
        sku: product.sku,
        quantity,
      },
      {
        onSuccess: () => {
          toast.success("Added to cart", {
            description: `${product.name} · Qty ${quantity}`,
            duration: 1600,
          });
          onDone();
        },
      },
    );
  };

  return (
    <div className="grid gap-0 sm:grid-cols-[300px_minmax(0,1fr)]">
      <div className="border-b border-border bg-surface/40 p-2.5 sm:border-b-0 sm:border-r">
        <div className="mx-auto flex h-[140px] w-[140px] items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-white p-1.5 sm:h-[165px] sm:w-[165px]">
          {selectedImageUrl ? (
            <img src={selectedImageUrl} alt={product.name} className="h-full w-full object-contain" />
          ) : (
            <ProductImage product={product} categoryIcon={categoryIcon} className="h-full w-full object-contain" />
          )}
        </div>

        <div className="mt-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Related photos
          </div>

          <div className="grid w-full grid-cols-3 gap-2">
            {galleryImages.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setActiveImageUrl(image.image_url)}
                className={cn(
                  "aspect-square w-full overflow-hidden rounded-xl border bg-white p-1.5 transition-all",
                  selectedImageUrl === image.image_url ? "border-primary ring-2 ring-primary/20" : "border-border",
                )}
              >
                <img
                  src={image.image_url}
                  alt={image.alt_text || `${product.name} photo ${index + 1}`}
                  className="h-full w-full object-contain"
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-3.5 sm:p-4">
        <DialogHeader>
          <DialogTitle className="text-display text-lg leading-tight">{baseName(product.name)}</DialogTitle>
        </DialogHeader>

        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-lg font-bold">{inr(Number(product.price ?? 0))}</span>
          {Number(product.mrp ?? 0) > Number(product.price ?? 0) && (
            <span className="text-xs text-muted-foreground line-through">{inr(Number(product.mrp ?? 0))}</span>
          )}
        </div>

        <div className="mt-3 rounded-xl border border-border bg-surface/30 p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-bold">Quantity</span>
            <span className="text-[11px] text-muted-foreground">{stock} available</span>
          </div>

          <div className="inline-flex h-9 items-center overflow-hidden rounded-full border border-primary/30 bg-background shadow-sm">
            <button
              type="button"
              onClick={() => setQuickQty((q) => Math.max(1, q - 1))}
              disabled={quickQty <= 1}
              className="grid h-9 w-9 place-items-center text-primary transition hover:bg-primary/10 disabled:opacity-35"
            >
              <Minus className="h-4 w-4" />
            </button>

            <span className="min-w-10 border-x border-border px-2 text-center text-sm font-black tabular-nums">
              {quickQty}
            </span>

            <button
              type="button"
              onClick={() => setQuickQty((q) => Math.min(maxQty, q + 1))}
              disabled={!inStock || quickQty >= maxQty}
              className="grid h-9 w-9 place-items-center text-primary transition hover:bg-primary/10 disabled:opacity-35"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
          This product has one available variation.
        </div>

        <div className="mt-2.5 text-[10px] text-muted-foreground">SKU {product.sku}</div>

        <Button
          type="button"
          size="lg"
          className="mt-3 h-10 w-full gap-2 rounded-full text-sm font-bold"
          onClick={add}
          disabled={cart.add.isPending || !inStock}
        >
          <ShoppingCart className="h-4 w-4" />
          {cart.add.isPending ? "Adding..." : `Add ${quickQty} to cart`}
        </Button>
      </div>
    </div>
  );
}
