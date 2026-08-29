import { useEffect, useRef } from "react";
import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/lib/queries";

type Row = Product & { categories: { slug: string; name: string; icon?: string | null } | null };

/**
 * Category-scoped "You may also like" rail. Up to four products render as a
 * static grid; anything more becomes a gentle auto-scrolling carousel that
 * pauses on hover/touch.
 */
export function RelatedRail({ products, iconFor }: { products: Row[]; iconFor?: (p: Row) => string | null | undefined }) {
  const scroller = useRef<HTMLDivElement>(null);
  const auto = products.length > 4;

  useEffect(() => {
    if (!auto) return;
    const el = scroller.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let paused = false;
    const pause = () => { paused = true; };
    const resume = () => { paused = false; };
    el.addEventListener("mouseenter", pause);
    el.addEventListener("mouseleave", resume);
    el.addEventListener("touchstart", pause, { passive: true });
    const id = window.setInterval(() => {
      if (paused) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      el.scrollLeft = el.scrollLeft >= max - 2 ? 0 : el.scrollLeft + 1;
    }, 28);
    return () => {
      window.clearInterval(id);
      el.removeEventListener("mouseenter", pause);
      el.removeEventListener("mouseleave", resume);
      el.removeEventListener("touchstart", pause);
    };
  }, [auto, products.length]);

  if (products.length === 0) return null;

  if (!auto) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} nameOnly categoryIcon={iconFor?.(p) ?? p.categories?.icon ?? null} />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={scroller}
      className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
    >
      {products.map((p) => (
        <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[32%] md:w-[23%] lg:w-[19%]">
          <ProductCard product={p} nameOnly categoryIcon={iconFor?.(p) ?? p.categories?.icon ?? null} />
        </div>
      ))}
    </div>
  );
}
