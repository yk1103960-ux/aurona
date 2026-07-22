import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import type { Category } from "@/lib/queries";
import { cn } from "@/lib/utils";

const categoryImages = import.meta.glob<{ default: string }>(
  "../../assets/categories/*.jpg",
  { eager: true },
);

export function CategoryCircles({ categories }: { categories: Category[] }) {
  const reduce = useReducedMotion();
  const tiles = categories
    .map((c) => ({
      cat: c,
      image: categoryImages[`../../assets/categories/${c.slug}.jpg`]?.default,
    }))
    .filter((t) => t.image);

  if (tiles.length === 0) return null;

  return (
    <section className="border-b border-border bg-surface/40">
      <div className="container-x py-8 lg:py-10">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <div className="text-eyebrow text-gold">Shop by category</div>
            <h2 className="text-display mt-1 text-2xl leading-tight sm:text-3xl">
              Curated <span className="italic">collections</span>
            </h2>
          </div>
        </div>

        <div className="-mx-4 overflow-x-auto scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-5 px-4 pb-2 sm:gap-6 md:justify-center md:flex-wrap">
            {tiles.map((t, i) => (
              <motion.div
                key={t.cat.id}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: Math.min(i * 0.03, 0.2), ease: [0.22, 1, 0.36, 1] }}
                className="shrink-0"
              >
                <Link
                  to="/category/$slug"
                  params={{ slug: t.cat.slug }}
                  className="group flex w-[88px] flex-col items-center gap-2 sm:w-[104px]"
                >
                  <div className="relative">
                    {/* soft ambient ring */}
                    <div
                      className={cn(
                        "absolute inset-0 -m-1 rounded-full bg-gradient-to-br from-primary/25 via-sky-300/20 to-gold/25 opacity-0 blur-md transition-opacity duration-500 group-hover:opacity-100",
                      )}
                      aria-hidden
                    />
                    <div className="relative h-[76px] w-[76px] overflow-hidden rounded-full bg-white shadow-[0_10px_30px_-12px_rgba(15,23,42,0.25)] ring-1 ring-black/5 transition-all duration-500 group-hover:shadow-[0_18px_40px_-14px_rgba(10,132,209,0.45)] group-hover:ring-primary/35 sm:h-[92px] sm:w-[92px]">
                      <img
                        src={t.image}
                        alt={t.cat.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110"
                      />
                      {/* inner sheen */}
                      <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/40 via-transparent to-transparent opacity-70" />
                      <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/50" />
                    </div>
                  </div>
                  <div className="line-clamp-2 text-center text-[11px] font-semibold leading-tight text-foreground transition-colors group-hover:text-primary sm:text-xs">
                    {t.cat.name}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
