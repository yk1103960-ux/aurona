import { Link } from "@tanstack/react-router";
import { Heart, ShoppingCart, Star, Check } from "lucide-react";
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
  const off = discountPct(product.mrp, product.price);
  const icon = categoryIcon ?? product.categories?.icon ?? null;
  const [added, setAdded] = useState(false);
  const inWishlist = wl.has(product.id);
  const detailSlug = product.family_slug ?? product.slug;
  const detailSearch = product.family_slug ? { v: product.sku } : {};

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
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-500 hover:-translate-y-1 hover:border-gold/40 hover:shadow-[0_20px_50px_-20px_color-mix(in_oklab,var(--color-gold)_38%,transparent)]">
      <Link
        to="/products/$slug"
        params={{ slug: detailSlug }}
        search={detailSearch}
        className="block overflow-hidden"
        aria-label={product.name}
      >
        <ProductImage
          product={product}
          categoryIcon={icon}
          className={cn(
            "aspect-square w-full transform-gpu transition-transform duration-500 ease-out will-change-transform group-hover:scale-[1.04]",
            compact && "aspect-[5/4]",
          )}
          iconClassName={compact ? "h-12 w-12" : "h-20 w-20"}
        />
      </Link>

      {off > 0 && (
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
          {off}% OFF
        </span>
      )}
      {product.is_bestseller && (
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-gold px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gold-foreground">
          Bestseller
        </span>
      )}

      <motion.button
        onClick={handleWishlist}
        whileTap={reduce ? undefined : { scale: 0.88 }}
        animate={inWishlist && !reduce ? { scale: [1, 1.25, 1] } : { scale: 1 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "press absolute right-3 top-12 grid h-9 w-9 place-items-center rounded-full bg-card/90 backdrop-blur transition hover:bg-card",
          inWishlist && "text-destructive",
        )}
        aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
        aria-pressed={inWishlist}
      >
        <Heart className={cn("h-4 w-4 transition", inWishlist && "fill-current")} />
      </motion.button>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="text-eyebrow">{product.categories?.name ?? "Aurona"}</div>
        <Link
          to="/products/$slug"
          params={{ slug: detailSlug }}
          search={detailSearch}
          className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors hover:text-gold"
        >
          {product.name}
        </Link>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3.5 w-3.5 fill-gold text-gold" />
          <span>{Number(product.rating).toFixed(1)}</span>
          <span>· {product.review_count} reviews</span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-lg font-semibold text-foreground">{inr(product.price)}</span>
          {Number(product.mrp) > Number(product.price) && (
            <span className="text-xs text-muted-foreground line-through">{inr(product.mrp)}</span>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground">/ {product.unit}</span>
        </div>
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
      </div>
    </div>
  );
}
