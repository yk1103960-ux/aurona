import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductImage } from "./ProductImage";
import type { Product } from "@/lib/queries";
import type { ProductImageRow } from "@/lib/product-images";

type FallbackProduct = Pick<Product, "image_seed" | "name" | "slug" | "image_url">;

export function ProductGallery({
  images,
  fallback,
  categoryIcon,
  className,
  resetKey,
}: {
  images: ProductImageRow[];
  fallback: FallbackProduct;
  categoryIcon?: string | null;
  className?: string;
  /** Changing this (e.g. the selected variant SKU) resets the gallery to the first photo. */
  resetKey?: string;
}) {
  const slides = useMemo(() => {
    return images.filter((i) => !!i.image_url).slice(0, 6);
  }, [images]);
  const hasReal = slides.length > 0;
  const count = hasReal ? slides.length : 5; // 5 fallback thumbs from generated tile
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const touchStart = useRef<number | null>(null);

  useEffect(() => { setIdx(0); }, [fallback.slug, resetKey, slides[0]?.id]);

  const goto = (n: number) => setIdx(((n % count) + count) % count);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hasReal) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setOrigin(`${x}% ${y}%`);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        className="group relative mx-auto aspect-square w-[85%] max-w-[340px] overflow-hidden rounded-lg border border-border bg-white sm:w-full sm:max-w-none"
        onMouseEnter={() => setZoom(true)}
        onMouseLeave={() => setZoom(false)}
        onMouseMove={onMove}
        onClick={() => setLightbox(true)}
        onTouchStart={(e) => { touchStart.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchStart.current == null) return;
          const dx = e.changedTouches[0].clientX - touchStart.current;
          if (Math.abs(dx) > 40) goto(idx + (dx < 0 ? 1 : -1));
          touchStart.current = null;
        }}
        role="button"
        tabIndex={0}
        aria-label="Open image viewer"
      >
        {hasReal ? (
          <img
            src={slides[idx].image_url}
            alt={slides[idx].alt_text ?? fallback.name}
            className="h-full w-full object-contain p-4 transition-transform duration-300 ease-out will-change-transform"
            style={zoom ? { transform: "scale(2)", transformOrigin: origin } : undefined}
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        ) : (
          <ProductImage
            product={fallback}
            categoryIcon={categoryIcon}
            className="h-full w-full"
            iconClassName="h-40 w-40"
          />
        )}

        <button
          type="button"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); setLightbox(true); }}
          aria-label="View fullscreen"
        >
          <ZoomIn className="h-4 w-4" />
        </button>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goto(idx - 1); }}
              className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur transition group-hover:opacity-100"
              aria-label="Previous image"
            ><ChevronLeft className="h-5 w-5" /></button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goto(idx + 1); }}
              className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur transition group-hover:opacity-100"
              aria-label="Next image"
            ><ChevronRight className="h-5 w-5" /></button>
          </>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {(hasReal ? slides : Array.from({ length: 5 })).map((s, i) => (

          <button
            key={hasReal ? `${(s as ProductImageRow).id}-${i}` : i}
            type="button"
            onClick={() => setIdx(i)}
            className={cn(
              "aspect-square overflow-hidden rounded-md border transition",
              i === idx ? "border-gold ring-2 ring-gold/40" : "border-border hover:border-foreground/40",
            )}
            aria-label={`Show image ${i + 1}`}
          >
            {hasReal ? (
              <img
                src={(s as ProductImageRow).image_url}
                alt=""
                className="h-full w-full bg-white object-contain p-1"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <ProductImage product={fallback} categoryIcon={categoryIcon} className="h-full w-full" iconClassName="h-6 w-6" />
            )}
          </button>
        ))}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-4"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={() => setLightbox(false)}
            aria-label="Close viewer"
          ><X className="h-5 w-5" /></button>
          {count > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goto(idx - 1); }}
                className="absolute left-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="Previous"
              ><ChevronLeft className="h-6 w-6" /></button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goto(idx + 1); }}
                className="absolute right-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="Next"
              ><ChevronRight className="h-6 w-6" /></button>
            </>
          )}
          <div
            className="max-h-[92vh] max-w-[92vw]"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => { touchStart.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touchStart.current == null) return;
              const dx = e.changedTouches[0].clientX - touchStart.current;
              if (Math.abs(dx) > 40) goto(idx + (dx < 0 ? 1 : -1));
              touchStart.current = null;
            }}
          >
            {hasReal ? (
              <img
                src={slides[idx].image_url}
                alt={slides[idx].alt_text ?? fallback.name}
                className="max-h-[92vh] max-w-[92vw] rounded-md bg-white object-contain p-4"
              />
            ) : (
              <div className="h-[70vh] w-[70vh] max-w-[92vw]">
                <ProductImage product={fallback} categoryIcon={categoryIcon} className="h-full w-full" iconClassName="h-40 w-40" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
