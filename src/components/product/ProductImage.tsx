import { Lightbulb, Fan, Flame, LayoutGrid, Zap, Lamp, Minus, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/queries";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Lightbulb,
  Fan,
  Flame,
  LayoutGrid,
  Zap,
  Lamp,
  Minus,
  CircleDot,
  Mirror: LayoutGrid,
};

const gradClass: Record<string, string> = {
  amber: "product-gradient-amber",
  warm: "product-gradient-warm",
  cool: "product-gradient-cool",
  gold: "product-gradient-gold",
  charcoal: "product-gradient-charcoal",
};

/*
 * Load product photos from local assets.
 * Supports JPG, JPEG, PNG and WEBP.
 */
const productPhotoModules = import.meta.glob("/src/assets/products/*.{jpg,jpeg,png,webp}", {
  import: "default",
  eager: true,
}) as Record<string, string>;

const productPhotos: Record<string, string> = Object.fromEntries(
  Object.entries(productPhotoModules).map(([path, url]) => {
    const filename = path.split("/").pop() ?? "";

    const key = filename.replace(/\.(jpg|jpeg|png|webp)$/i, "");

    return [key, url];
  }),
);

type ProductImageData = Pick<Product, "image_seed" | "name" | "slug" | "image_url"> & {
  family_slug?: string | null;
  sku?: string | null;
};

export function ProductImage({
  product,
  className,
  iconClassName,
  categoryIcon,
  eager,
}: {
  product: ProductImageData;
  className?: string;
  iconClassName?: string;
  categoryIcon?: string | null;
  eager?: boolean;
}) {
  /*
   * Image priority:
   *
   * 1. Database image_url
   * 2. Exact product slug
   * 3. Family slug
   * 4. Image seed
   * 5. SKU
   */

  const photo =
    product.image_url ||
    (product.slug && productPhotos[product.slug]) ||
    (product.family_slug && productPhotos[product.family_slug]) ||
    (product.image_seed && productPhotos[product.image_seed]) ||
    (product.sku && productPhotos[product.sku]) ||
    null;

  if (photo) {
    return (
      <div
        className={cn(
          "product-tile relative flex items-center justify-center overflow-hidden rounded-lg bg-white p-2",
          className,
        )}
      >
        <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-md bg-white">
          <img
            src={photo}
            alt={product.name}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={eager ? "high" : "auto"}
            width={1024}
            height={1024}
            className="h-full w-full object-contain p-2"
          />
        </div>
      </div>
    );
  }

  const Icon = (categoryIcon && iconMap[categoryIcon]) || Lightbulb;

  const grad = gradClass[product.image_seed ?? "amber"] ?? "product-gradient-amber";

  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden rounded-lg", grad, className)}>
      <div className="absolute inset-0 opacity-40 mix-blend-overlay [background:radial-gradient(circle_at_30%_20%,white,transparent_60%)]" />

      <Icon
        className={cn("relative z-10 h-16 w-16 text-primary/70 drop-shadow-sm", iconClassName)}
        strokeWidth={1.25}
      />
    </div>
  );
}

export function CategoryTile({ categoryIcon, className }: { categoryIcon?: string | null; className?: string }) {
  const Icon = (categoryIcon && iconMap[categoryIcon]) || Lightbulb;

  return (
    <div
      className={cn("relative flex items-center justify-center overflow-hidden rounded-xl bg-surface-warm", className)}
    >
      <Icon className="h-10 w-10 text-primary/80" strokeWidth={1.5} />
    </div>
  );
}
