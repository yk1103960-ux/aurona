import { useEffect, useState } from "react";
import { Lightbulb, Fan, Flame, LayoutGrid, Zap, Lamp, Minus, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/queries";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Lightbulb, Fan, Flame, LayoutGrid, Zap, Lamp, Minus, CircleDot, Mirror: LayoutGrid,
};

const gradClass: Record<string, string> = {
  amber: "product-gradient-amber",
  warm: "product-gradient-warm",
  cool: "product-gradient-cool",
  gold: "product-gradient-gold",
  charcoal: "product-gradient-charcoal",
};

// Lazily import generated product photos; key by slug (filename minus .jpg)
const productPhotoModules = import.meta.glob("/src/assets/products/*.jpg", {
  import: "default",
}) as Record<string, () => Promise<string>>;

const productPhotoLoaders: Record<string, () => Promise<string>> = Object.fromEntries(
  Object.entries(productPhotoModules).map(([path, loader]) => {
    const slug = path.split("/").pop()!.replace(/\.jpg$/, "");
    return [slug, loader];
  }),
);

export function ProductImage({
  product,
  className,
  iconClassName,
  categoryIcon,
}: {
  product: Pick<Product, "image_seed" | "name" | "slug">;
  className?: string;
  iconClassName?: string;
  categoryIcon?: string | null;
}) {
  const photoKey =
    (product.slug && productPhotoLoaders[product.slug] ? product.slug : undefined) ??
    (product.image_seed && productPhotoLoaders[product.image_seed] ? product.image_seed : undefined);
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setPhoto(null);
    if (!photoKey) return () => { active = false; };

    productPhotoLoaders[photoKey]().then((url) => {
      if (active) setPhoto(url);
    });

    return () => {
      active = false;
    };
  }, [photoKey]);

  if (photo) {
    return (
      <div
        className={cn(
          "product-tile relative flex items-center justify-center overflow-hidden rounded-lg p-2",
          className,
        )}
      >
        <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-md bg-white">
          <img
            src={photo}
            alt={product.name}
            loading="lazy"
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
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-lg",
        grad,
        className,
      )}
    >
      <div className="absolute inset-0 opacity-40 mix-blend-overlay [background:radial-gradient(circle_at_30%_20%,white,transparent_60%)]" />
      <Icon
        className={cn("relative z-10 h-16 w-16 text-primary/70 drop-shadow-sm", iconClassName)}
        strokeWidth={1.25}
      />
    </div>
  );
}

export function CategoryTile({
  categoryIcon,
  className,
}: {
  categoryIcon?: string | null;
  className?: string;
}) {
  const Icon = (categoryIcon && iconMap[categoryIcon]) || Lightbulb;
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-xl bg-surface-warm",
        className,
      )}
    >
      <Icon className="h-10 w-10 text-primary/80" strokeWidth={1.5} />
    </div>
  );
}
