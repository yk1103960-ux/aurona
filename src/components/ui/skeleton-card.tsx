import { cn } from "@/lib/utils";

/** Premium shimmer skeleton for a product card. */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}>
      <div className="aspect-square w-full shimmer" />
      <div className="space-y-2 p-4">
        <div className="h-2.5 w-16 rounded shimmer" />
        <div className="h-3.5 w-11/12 rounded shimmer" />
        <div className="h-3.5 w-8/12 rounded shimmer" />
        <div className="mt-3 h-4 w-24 rounded shimmer" />
        <div className="mt-3 h-9 w-full rounded-md shimmer" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
