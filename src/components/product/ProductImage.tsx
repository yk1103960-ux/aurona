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

export function ProductImage({
  product,
  className,
  iconClassName,
  categoryIcon,
}: {
  product: Pick<Product, "image_seed" | "name">;
  className?: string;
  iconClassName?: string;
  categoryIcon?: string | null;
}) {
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
