import { Link } from "@tanstack/react-router";
import { GitCompare, Heart, Link2, Minus, Plus, ShoppingCart, Star, Phone, Truck, Zap } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { discountPct, inr } from "@/lib/format";
import type { Product } from "@/lib/queries";
import { ProductImage } from "./ProductImage";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useCompare } from "@/hooks/useCompare";
import { useAuth } from "@/hooks/useAuth";
import { useMyRole, useVisiblePrices } from "@/lib/pricing";
import { getMyApprovedAffiliateIdentity } from "@/lib/affiliate.functions";

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
    cart.add.mutate(
      { productId: product.id, sku: product.sku },
      { onSuccess: () => toast.success("Added to cart", { description: product.name, duration: 1600 }) },
    );
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
    </div>
  );
}
