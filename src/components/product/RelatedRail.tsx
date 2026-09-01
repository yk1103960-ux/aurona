import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/lib/queries";

type Row = Product & { categories: { slug: string; name: string; icon?: string | null } | null };

/**
 * Category-scoped "You may also like" rail. Up to four products render as a
 * static grid; anything more becomes a gentle auto-scrolling carousel with
 * manual left/right controls, swipe support, and pausing while the shopper
 * interacts with it.
 */
export function RelatedRail({ products, iconFor }: { products: Row[]; iconFor?: (p: Row) => string | null | undefined }) {
  const scroller = useRef<HTMLDivElement>(null);
  const holdUntil = useRef(0);
  const auto = products.length > 4;

  useEffect(() => {
    if (!auto) return;
    const el = scroller.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let hovering = false;
    const pause = () => { hovering = true; };
    const resume = () => { hovering = false; };
    const hold = () => { holdUntil.current = Date.now() + 3000; };
    el.addEventListener("mouseenter", pause);
    el.addEventListener("mouseleave", resume);
    el.addEventListener("touchstart", hold, { passive: true });
    el.addEventListener("wheel", hold, { passive: true });
    const id = window.setInterval(() => {
      if (hovering || Date.now() < holdUntil.current) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      el.scrollLeft = el.scrollLeft >= max - 2 ? 0 : el.scrollLeft + 1;
    }, 28);
    return () => {
      window.clearInterval(id);
      el.removeEventListener("mouseenter", pause);
      el.removeEventListener("mouseleave", resume);
      el.removeEventListener("touchstart", hold);
      el.removeEventListener("wheel", hold);
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

  const nudge = (dir: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    holdUntil.current = Date.now() + 4000;
    el.scrollBy({ left: dir * Math.max(200, el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <div className="relative">
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

      <button
        type="button"
        onClick={() => nudge(-1)}
        aria-label="Scroll left"
        className="absolute -left-2 top-[38%] hidden h-10 w-10 place-items-center rounded-full border border-border bg-background/95 shadow-lift backdrop-blur transition hover:border-foreground sm:grid"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => nudge(1)}
        aria-label="Scroll right"
        className="absolute -right-2 top-[38%] hidden h-10 w-10 place-items-center rounded-full border border-border bg-background/95 shadow-lift backdrop-blur transition hover:border-foreground sm:grid"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
