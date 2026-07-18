import { Link } from "@tanstack/react-router";
import { Heart, ShoppingCart, Star } from "lucide-react";
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
  const off = discountPct(product.mrp, product.price);
  const icon = categoryIcon ?? product.categories?.icon ?? null;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-border-strong hover:shadow-lift">
      <Link
        to="/products/$slug"
        params={{ slug: product.slug }}
        className="block"
        aria-label={product.name}
      >
        <ProductImage
          product={product}
          categoryIcon={icon}
          className={cn("aspect-square w-full", compact && "aspect-[5/4]")}
          iconClassName={compact ? "h-12 w-12" : "h-20 w-20"}
        />
      </Link>

      {off > 0 && (
        <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
          {off}% OFF
        </span>
      )}
      {product.is_bestseller && (
        <span className="absolute right-3 top-3 rounded-full bg-gold px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gold-foreground">
          Bestseller
        </span>
      )}

      <button
        onClick={() => wl.toggle.mutate(product.id)}
        className={cn(
          "absolute right-3 top-12 grid h-9 w-9 place-items-center rounded-full bg-card/90 backdrop-blur transition hover:bg-card",
          wl.has(product.id) && "text-destructive",
        )}
        aria-label="Toggle wishlist"
      >
        <Heart className={cn("h-4 w-4", wl.has(product.id) && "fill-current")} />
      </button>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="text-eyebrow">{product.categories?.name ?? "Aurona"}</div>
        <Link
          to="/products/$slug"
          params={{ slug: product.slug }}
          className="line-clamp-2 text-sm font-semibold leading-snug text-foreground hover:text-gold"
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
          className="mt-2 w-full gap-2"
          onClick={() => cart.add.mutate({ productId: product.id })}
          disabled={cart.add.isPending}
        >
          <ShoppingCart className="h-4 w-4" />
          Add to Cart
        </Button>
      </div>
    </div>
  );
}
