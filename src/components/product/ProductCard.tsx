import { Link } from "@tanstack/react-router";
import { Heart, ShoppingCart, Star, Check, Phone } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { discountPct, inr } from "@/lib/format";
import type { Product } from "@/lib/queries";
import { ProductImage } from "./ProductImage";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useMyRole, useVisiblePrices } from "@/lib/pricing";

type Row = Product & { categories: { slug: string; name: string; icon?: string | null } | null };

export function ProductCard({
  product,
  categoryIcon,
  compact,
}: {
  product: Row;
  categoryIcon?: string | null;
  compact?: boolean;
}) {
  const cart = useCart();
  const wl = useWishlist();
  const reduce = useReducedMotion();
  const role = useMyRole();
  const { data: priceMap } = useVisiblePrices(product.sku ? [product.sku] : []);
  const rp = product.sku ? priceMap?.[product.sku] : undefined;
  const shownPrice = rp?.price ?? Number(product.price);
  const shownMrp = rp?.mrp ?? Number(product.mrp);
  const off = discountPct(shownMrp, shownPrice);
  const icon = categoryIcon ?? product.categories?.icon ?? null;
  const [added, setAdded] = useState(false);
  const inWishlist = wl.has(product.id);
  const detailSlug = product.family_slug ?? product.slug;
  const detailSearch = product.family_slug ? { v: product.sku } : {};
  const isDistributor = role.role === "distributor";

  const handleAdd = () => {
    cart.add.mutate(
      { productId: product.id },
      {
        onSuccess: () => {
          setAdded(true);
          toast.success("Added to cart", { description: product.name, duration: 1800 });
          window.setTimeout(() => setAdded(false), 1400);
        },
      },
    );
  };

  const handleWishlist = () => {
    wl.toggle.mutate(product.id);
    toast(inWishlist ? "Removed from wishlist" : "Added to wishlist", { duration: 1200 });
  };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:border-primary/35 hover:shadow-sky">
      <Link
        to="/products/$slug"
        params={{ slug: detailSlug }}
        search={detailSearch}
        className="relative block overflow-hidden"
        aria-label={product.name}
      >
        <ProductImage
          product={product}
          categoryIcon={icon}
          className={cn(
            "aspect-square w-full transform-gpu transition-transform duration-[700ms] ease-out will-change-transform group-hover:scale-[1.06]",
            compact && "aspect-[5/4]",
          )}
          iconClassName={compact ? "h-12 w-12" : "h-20 w-20"}
        />
        {/* subtle top sheen on hover */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden />
      </Link>

      {off > 0 && (
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground shadow-[0_4px_12px_-4px_color-mix(in_oklab,var(--color-primary)_60%,transparent)]">
          {off}% OFF
        </span>
      )}
      {product.is_bestseller && (
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground shadow-[0_4px_12px_-4px_color-mix(in_oklab,var(--color-accent)_60%,transparent)]">
          Bestseller
        </span>
      )}

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
        <div className="text-eyebrow text-[10px]">{product.categories?.name ?? "Aurona"}</div>
        <Link
          to="/products/$slug"
          params={{ slug: detailSlug }}
          search={detailSearch}
          className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground transition-colors hover:text-primary"
        >
          {product.name}
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/8 px-2 py-0.5 text-primary">
            <Star className="h-3 w-3 fill-primary text-primary" />
            <span className="font-semibold">{Number(product.rating).toFixed(1)}</span>
          </span>
          <span>· {product.review_count} reviews</span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          {product.price_from && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">From</span>
          )}
          <span className="text-xl font-bold tracking-tight text-foreground">{inr(shownPrice)}</span>
          {shownMrp > shownPrice && (
            <span className="text-xs text-muted-foreground line-through">{inr(shownMrp)}</span>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground">/ {product.unit}</span>
        </div>
        {role.role === "retailer" && (
          <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">Retailer price</div>
        )}
        {isDistributor ? (
          <Button asChild size="sm" className="mt-2 w-full gap-2 rounded-full">
            <a href="tel:+919602570026">
              <Phone className="h-4 w-4" /> Contact Sales
            </a>
          </Button>
        ) : (
          <Button
            size="sm"
            className={cn(
              "press mt-2 w-full gap-2 overflow-hidden",
              added && "bg-success text-success-foreground hover:bg-success",
            )}
            onClick={handleAdd}
            disabled={cart.add.isPending}
            aria-live="polite"
          >
            <AnimatePresence mode="wait" initial={false}>
              {added ? (
                <motion.span
                  key="added"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-2"
                >
                  <Check className="h-4 w-4" /> Added
                </motion.span>
              ) : (
                <motion.span
                  key="add"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-2"
                >
                  <ShoppingCart className="h-4 w-4" /> Add to Cart
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        )}
      </div>
    </div>
  );
}
