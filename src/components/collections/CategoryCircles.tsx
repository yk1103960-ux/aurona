import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Category } from "@/lib/queries";
import { cn } from "@/lib/utils";

const categoryImages = import.meta.glob<{ default: string }>(
  "../../assets/categories/*.jpg",
  { eager: true },
);

// Official Aurona category symbols (line icons, CDN-hosted pointers)
const iconPointers = import.meta.glob<{ default: { url: string } }>(
  "../../assets/category-icons/*.png.asset.json",
  { eager: true },
);
const categoryIcons: Record<string, string> = Object.fromEntries(
  Object.entries(iconPointers).map(([path, mod]) => [
    path.split("/").pop()!.replace(".png.asset.json", ""),
    mod.default.url,
  ]),
);

// Curated collection order (all 17 official Aurona categories)
const CURATED = [
  "led-bulbs", "panel-lights", "concealed-lights", "interior-lights",
  "tube-lights", "deep-lights", "street-lights", "flood-lights",
  "outdoor-lights", "ceiling-fans", "table-fans", "pedestal-fans",
  "exhaust-fans", "heaters", "water-geysers", "immersion-heaters",
  "madhani",
];

type Tile = { slug: string; name: string; image: string; isIcon: boolean };


export function CategoryCircles({ categories }: { categories: Category[] }) {
  const bySlug = new Map(categories.map((c) => [c.slug, c] as const));
  const tiles: Tile[] = CURATED
    .map((slug) => {
      const icon = categoryIcons[slug];
      const image = icon ?? categoryImages[`../../assets/categories/${slug}.jpg`]?.default;
      if (!image) return null;
      const cat = bySlug.get(slug);
      const name =
        cat?.name ??
        slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
      return { slug, name, image, isIcon: !!icon };
    })
    .filter(Boolean) as Tile[];


  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [paused, setPaused] = useState(false);

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const pages = Math.max(1, Math.round(el.scrollWidth / el.clientWidth));
    setPageCount(pages);
    setPage(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  useEffect(() => {
    measure();
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => setPage(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const scrollToPage = (p: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const target = ((p % pageCount) + pageCount) % pageCount;
    el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
  };

  const next = () => scrollToPage(page + 1);
  const prev = () => scrollToPage(page - 1);

  // Auto-scroll every 3.5s, loop, pause on hover
  useEffect(() => {
    if (paused || pageCount <= 1) return;
    const id = window.setInterval(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const nextPage = (page + 1) % pageCount;
      el.scrollTo({ left: nextPage * el.clientWidth, behavior: "smooth" });
    }, 3500);
    return () => window.clearInterval(id);
  }, [page, pageCount, paused]);

  if (tiles.length === 0) return null;

  return (
    <section
      className="border-b border-border bg-surface/40"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="container-x py-8 lg:py-10">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <div className="text-eyebrow text-gold">Shop by category</div>
            <h2 className="text-display mt-1 text-2xl leading-tight sm:text-3xl">
              Curated <span className="italic">collections</span>
            </h2>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <button
              onClick={prev}
              aria-label="Previous"
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-background text-primary shadow-sm transition hover:border-primary/40 hover:bg-primary/5 active:scale-95"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              aria-label="Next"
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-background text-primary shadow-sm transition hover:border-primary/40 hover:bg-primary/5 active:scale-95"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative">
          <div
            ref={scrollerRef}
            className="-mx-4 flex snap-x snap-mandatory overflow-x-auto scroll-smooth scrollbar-none px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ scrollBehavior: "smooth" }}
          >
            {tiles.map((t) => {
              const inner = (
                <>
                  <div className="relative">
                    <div
                      className="absolute inset-0 -m-1 rounded-full bg-gradient-to-br from-primary/25 via-sky-300/20 to-gold/25 opacity-0 blur-md transition-opacity duration-500 group-hover:opacity-100"
                      aria-hidden
                    />
                    <div className="relative h-[84px] w-[84px] overflow-hidden rounded-full bg-white shadow-[0_10px_30px_-12px_rgba(15,23,42,0.25)] ring-1 ring-black/5 transition-all duration-500 group-hover:shadow-[0_18px_40px_-14px_rgba(10,132,209,0.45)] group-hover:ring-primary/35 sm:h-[104px] sm:w-[104px] lg:h-[112px] lg:w-[112px]">
                      <img
                        src={t.image}
                        alt={t.name}
                        loading="lazy"
                        decoding="async"
                        width={112}
                        height={112}
                        className={cn(
                          "h-full w-full transition-transform duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110",
                          t.isIcon ? "object-contain p-[17%]" : "object-cover",
                        )}
                      />
                      {!t.isIcon && (
                        <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/40 via-transparent to-transparent opacity-70" />
                      )}
                      <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/50" />
                    </div>

                  </div>
                  <div className="line-clamp-2 text-center text-[11px] font-semibold leading-tight text-foreground transition-colors group-hover:text-primary sm:text-xs">
                    {t.name}
                  </div>
                </>
              );
              const cls =
                "group flex w-full flex-col items-center gap-2";
              return (
                <div
                  key={t.slug}
                  className="shrink-0 basis-1/3 snap-start px-2 sm:basis-1/4 md:basis-1/5 lg:basis-1/6 xl:basis-[12.5%]"
                >
                  <Link to="/category/$slug" params={{ slug: t.slug }} className={cls}>
                    {inner}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* Slide progress bar */}
        {pageCount > 1 && (
          <div className="mt-5 flex justify-center">
            <div className="relative h-1 w-40 overflow-hidden rounded-full bg-border sm:w-56">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width,transform] duration-500"
                style={{
                  width: `${100 / pageCount}%`,
                  transform: `translateX(${page * 100}%)`,
                }}
              />
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
