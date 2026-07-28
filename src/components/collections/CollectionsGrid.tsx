import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { categoryCountsQuery, type Category } from "@/lib/queries";
import { cn } from "@/lib/utils";

const categoryImages = import.meta.glob<{ default: string }>(
  "../../assets/categories/*.jpg",
  { eager: true },
);

const BLURB: Record<string, string> = {
  "interior-lights": "Sculpted pendants, chandeliers and mood pieces that anchor a room.",
  "mirror-lights": "Editorial vanity light — soft, shadow-free, cinema-grade CRI.",
  "concealed-lights": "Recessed downlights engineered for glare-free architecture.",
  "panel-lights": "Ultra-slim ceiling panels with copper drivers and 5-yr warranty.",
  "led-bulbs": "The everyday workhorse — 90+ CRI, 25,000-hour life.",
  "tube-lights": "Long-format ambient light for kitchens, studios and corridors.",
  "flood-lights": "IP66 architectural floods for façades, courts and warehouses.",
  "street-lights": "Municipal-grade LED street lighting with surge protection.",
  "ceiling-fans": "BLDC-driven ceiling fans — whisper-quiet, 60% less energy.",
  "exhaust-fans": "Kitchen and bath exhaust with anti-rust powder-coat frames.",
  "table-fans": "Precision-balanced desk fans with silent hush motors.",
  "heaters": "Insta-heat room warmers with tip-over safety and dust filters.",
};

// Bento layout for desktop — spans on a 12-col grid, 160px auto-rows.
// Priority list drives what appears where. Missing categories are skipped gracefully.
const LAYOUT: Array<{
  slug: string;
  span: string; // desktop col + row span classes
  size: "xl" | "lg" | "md" | "sm";
  tone: "dark" | "light";
}> = [
  // Row 1 (12): 7 + 5   Row 2 (12): 4 + 4 + 4   Row 3 (12): 5 + 4 + 3
  { slug: "interior-lights",  span: "lg:col-span-7 lg:row-span-2", size: "xl", tone: "dark"  },
  { slug: "mirror-lights",    span: "lg:col-span-5 lg:row-span-2", size: "lg", tone: "dark"  },
  { slug: "concealed-lights", span: "lg:col-span-4 lg:row-span-2", size: "md", tone: "light" },
  { slug: "panel-lights",     span: "lg:col-span-4 lg:row-span-2", size: "md", tone: "light" },
  { slug: "led-bulbs",        span: "lg:col-span-4 lg:row-span-2", size: "md", tone: "light" },
  { slug: "ceiling-fans",     span: "lg:col-span-5 lg:row-span-2", size: "lg", tone: "dark"  },
  { slug: "flood-lights",     span: "lg:col-span-4 lg:row-span-2", size: "md", tone: "dark"  },
  { slug: "heaters",          span: "lg:col-span-3 lg:row-span-2", size: "sm", tone: "light" },
];

export function CollectionsGrid({ categories }: { categories: Category[] }) {
  const counts = useQuery(categoryCountsQuery).data ?? {};

  // Ordered list of visible tiles, filtered to categories that actually exist
  const tiles = LAYOUT.map((L) => {
    const cat = categories.find((c) => c.slug === L.slug);
    if (!cat) return null;
    return {
      ...L,
      cat,
      image: categoryImages[`../../assets/categories/${cat.slug}.jpg`]?.default,
      count: counts[cat.id] ?? 0,
      blurb: BLURB[cat.slug] ?? cat.name,
    };
  }).filter(Boolean) as Array<{
    slug: string; span: string; size: "xl" | "lg" | "md" | "sm"; tone: "dark" | "light";
    cat: Category; image?: string; count: number; blurb: string;
  }>;

  return (
    <section className="container-x py-16 lg:py-24">
      {/* Header */}
      <div className="mb-10 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 lg:mb-14">
        <div className="min-w-0">
          <div className="text-eyebrow text-gold">01 · Collections</div>
          <h2 className="text-display mt-3 text-4xl leading-[1.02] sm:text-5xl lg:text-6xl">
            A room for <span className="italic">every</span> light.
          </h2>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
            Twelve categories, engineered in Karnataka, delivered PAN India. Pick a room —
            we've composed the fixtures.
          </p>
        </div>
        <Link
          to="/products"
          className="group hidden shrink-0 items-center gap-2 self-end text-[11px] font-semibold uppercase tracking-[0.2em] text-primary hover:text-gold sm:inline-flex"
        >
          Full catalogue
          <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Mobile — snap carousel */}
      <div className="-mx-4 lg:hidden">
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tiles.map((t, i) => (
            <div key={t.cat.id} className="w-[76vw] max-w-[320px] shrink-0 snap-start">
              <CollectionCard {...t} index={i} compact />
            </div>
          ))}
        </div>
      </div>

      {/* Desktop — editorial bento */}
      <div className="hidden auto-rows-[160px] grid-cols-12 gap-4 lg:grid xl:gap-5">
        {tiles.map((t, i) => (
          <div key={t.cat.id} className={cn("col-span-12", t.span)}>
            <CollectionCard {...t} index={i} />
          </div>
        ))}
      </div>
    </section>
  );
}

function CollectionCard({
  cat, image, count, blurb, size, tone, index, compact,
}: {
  cat: Category; image?: string; count: number; blurb: string;
  size: "xl" | "lg" | "md" | "sm"; tone: "dark" | "light"; index: number; compact?: boolean;
}) {
  const reduce = useReducedMotion();
  const dark = tone === "dark";
  const aspect = compact ? "aspect-[4/5]" : "";

  const titleClass =
    size === "xl" ? "text-4xl sm:text-5xl lg:text-6xl" :
    size === "lg" ? "text-3xl sm:text-4xl lg:text-5xl" :
    size === "md" ? "text-2xl sm:text-3xl" :
                    "text-xl sm:text-2xl";

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay: Math.min(index * 0.05, 0.25), ease: [0.22, 1, 0.36, 1] }}
      className="h-full w-full"
    >
      <Link
        to="/category/$slug"
        params={{ slug: cat.slug }}
        className={cn(
          "group relative flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl border transition-shadow duration-500",
          aspect,
          dark ? "border-transparent bg-[oklch(0.14_0.02_260)] text-white" : "border-border bg-surface text-primary",
          "hover:shadow-lift",
        )}
      >
        {/* Image */}
        {image && (
          <div className="absolute inset-0 overflow-hidden">
            <img
              src={image}
              alt=""
              loading="lazy"
              className={cn(
                "h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]",
                dark ? "opacity-90" : "opacity-100",
              )}
            />
            {dark ? (
              <>
                <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.10_0.02_260)] via-[oklch(0.10_0.02_260/0.55)] to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-br from-[oklch(0.10_0.02_260/0.6)] via-transparent to-transparent" />
              </>
            ) : (
              <>
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/70 to-white/10" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-transparent to-transparent" />
              </>
            )}
          </div>
        )}

        {/* Top row: index + count */}
        <div className="relative flex items-center justify-between p-5 lg:p-6">
          <div className={cn(
            "text-[10px] uppercase tracking-[0.28em]",
            dark ? "text-white/60" : "text-muted-foreground",
          )}>
            {String(index + 1).padStart(2, "0")} · {cat.parent_group}
          </div>
          {count > 0 && (
            <div className={cn(
              "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
              dark
                ? "border-white/20 bg-white/5 text-white/80 backdrop-blur"
                : "border-border bg-white/90 text-muted-foreground",
            )}>
              {count} product{count === 1 ? "" : "s"}
            </div>
          )}
        </div>

        {/* Bottom: title + blurb + CTA */}
        <div className="relative p-5 lg:p-6">
          <h3 className={cn("text-display leading-[1.02]", titleClass)}>
            {cat.name}
          </h3>
          {(size === "xl" || size === "lg" || size === "md") && (
            <p className={cn(
              "mt-3 max-w-md text-sm leading-relaxed",
              dark ? "text-white/75" : "text-muted-foreground",
            )}>
              {blurb}
            </p>
          )}
          <div className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            Explore collection
            <span className="relative block h-px w-8 overflow-hidden">
              <span className="absolute inset-y-0 left-0 block w-full bg-gold transition-transform duration-500 group-hover:translate-x-full" />
            </span>
            <ArrowUpRight className="h-4 w-4 transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-1" />
          </div>
        </div>

        {/* Hover elevation ring */}
        <div className={cn(
          "pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset transition duration-500",
          dark ? "ring-white/0 group-hover:ring-white/15" : "ring-black/0 group-hover:ring-black/10",
        )} />
      </Link>
    </motion.div>
  );
}
