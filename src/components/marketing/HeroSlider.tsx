import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useCmsBlocks } from "@/hooks/useCmsBlocks";
import b1 from "@/assets/banners/banner-1.jpg";
import b2 from "@/assets/banners/banner-2.jpg";
import b3 from "@/assets/banners/banner-3.jpg";
import b4 from "@/assets/banners/banner-4.jpg";
import b5 from "@/assets/banners/banner-5.jpg";

type Slide = {
  image: string;
  eyebrow: string;
  title: string;
  italic: string;
  suffix?: string;
  copy: string;
  ctaLabel: string;
  ctaTo: string;
  ctaParams?: Record<string, string>;
};

const DEFAULT_SLIDES: Slide[] = [
  {
    image: b1,
    eyebrow: "Signature Collection",
    title: "Light,",
    italic: "sculpted",
    suffix: "for India.",
    copy: "Concealed lighting, panels and interior fixtures — engineered at our Karnataka facility.",
    ctaLabel: "Explore the collection",
    ctaTo: "/products",
  },
  {
    image: b2,
    eyebrow: "Air, refined",
    title: "Silent motors.",
    italic: "Statement",
    suffix: "blades.",
    copy: "Ceiling fans that sit at the centre of the room — quiet, precise, built to last.",
    ctaLabel: "Browse fans",
    ctaTo: "/category/$slug",
    ctaParams: { slug: "ceiling-fans" },
  },
  {
    image: b3,
    eyebrow: "LED Lighting",
    title: "A bulb for",
    italic: "every",
    suffix: "room.",
    copy: "From high-glow bulbs to slim panels — the full Aurona lighting library, in one place.",
    ctaLabel: "Shop LED lighting",
    ctaTo: "/products",
  },
  {
    image: b4,
    eyebrow: "Outdoor & Facade",
    title: "Architecture,",
    italic: "illuminated",
    suffix: "after dark.",
    copy: "Flood lights, street lights and facade fixtures rated for Indian weather.",
    ctaLabel: "Outdoor lighting",
    ctaTo: "/category/$slug",
    ctaParams: { slug: "flood-lights" },
  },
  {
    image: b5,
    eyebrow: "Just landed",
    title: "New season,",
    italic: "new light.",
    copy: "Fresh silhouettes, quieter motors, warmer temperatures — the latest Aurona drops.",
    ctaLabel: "See new arrivals",
    ctaTo: "/new-arrivals",
  },
];

export function HeroSlider() {
  const { data: cmsSlides } = useCmsBlocks("hero_slide");
  const SLIDES = useMemo<Slide[]>(() => {
    if (cmsSlides && cmsSlides.length > 0) {
      return cmsSlides.map((b) => {
        const p = (b.payload ?? {}) as Record<string, any>;
        return {
          image: p.image || b1,
          eyebrow: p.eyebrow || "",
          title: p.title || (b.title ?? ""),
          italic: p.italic || "",
          suffix: p.suffix,
          copy: p.copy || "",
          ctaLabel: p.ctaLabel || "Explore",
          ctaTo: p.ctaTo || "/products",
        } as Slide;
      });
    }
    return DEFAULT_SLIDES;
  }, [cmsSlides]);

  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const go = useCallback((n: number) => setI((n + SLIDES.length) % SLIDES.length), [SLIDES.length]);

  useEffect(() => {
    if (paused || SLIDES.length <= 1) return;
    const t = window.setInterval(() => setI((v) => (v + 1) % SLIDES.length), 5500);
    return () => window.clearInterval(t);
  }, [paused, SLIDES.length]);

  const s = SLIDES[Math.min(i, SLIDES.length - 1)];
  if (!s) return null;

  return (
    <section
      className="relative -mt-16 h-[74vh] min-h-[460px] max-h-[680px] w-full overflow-hidden bg-black text-white md:h-[78vh] md:max-h-[760px] lg:-mt-20 lg:h-[92vh] lg:max-h-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Aurona featured collections"
    >
      <div className="absolute inset-0" style={{ perspective: "1600px" }}>
        <AnimatePresence mode="sync">
          <motion.div
            key={i}
            initial={{ opacity: 0, rotateY: 22, scale: 1.08, x: "8%" }}
            animate={{ opacity: 1, rotateY: 0, scale: 1, x: "0%" }}
            exit={{ opacity: 0, rotateY: -22, scale: 1.02, x: "-8%" }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
            style={{ transformStyle: "preserve-3d", transformOrigin: "center center" }}
          >
            <img
              src={s.image}
              alt={s.title + " " + s.italic}
              className="h-full w-full object-cover"
              {...(i === 0 ? { fetchpriority: "high" as const } : { loading: "lazy" as const })}
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-black/30" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40" />
            <div className="absolute inset-y-0 left-0 w-[65%] bg-gradient-to-r from-black/70 to-transparent" />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="container-x relative flex h-full items-center pt-20 lg:pt-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={i + "-txt"}
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 backdrop-blur">
              <span className="h-1 w-1 rounded-full bg-[color:var(--color-gold)]" />
              <span className="text-[10px] uppercase tracking-[0.24em] text-white/90">{s.eyebrow}</span>
            </div>
            <h1
              className="text-display text-[38px] leading-[0.98] tracking-tight sm:text-5xl md:text-6xl lg:text-[92px]"
              style={{ textShadow: "0 2px 24px rgba(0,0,0,0.65), 0 1px 2px rgba(0,0,0,0.8)" }}
            >
              <span className="block text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">{s.title}</span>
              <span
                className="block italic text-[color:var(--color-gold)]"
                style={{ textShadow: "0 2px 24px rgba(0,0,0,0.7), 0 0 40px rgba(212,175,55,0.35)" }}
              >
                {s.italic}
              </span>
              {s.suffix && <span className="block text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">{s.suffix}</span>}
            </h1>
            <p
              className="mt-5 max-w-md text-sm font-medium text-white sm:text-base"
              style={{ textShadow: "0 1px 12px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.8)" }}
            >
              {s.copy}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to={s.ctaTo as never}
                params={s.ctaParams as never}
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-[color:var(--color-gold)] px-6 text-sm font-semibold text-[color:var(--color-gold-foreground)] transition hover:brightness-110"
              >
                {s.ctaLabel}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/deals"
                className="inline-flex h-12 items-center rounded-full border border-white/30 bg-white/5 px-6 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
              >
                Season deals
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Prev / Next */}
      <button
        onClick={() => go(i - 1)}
        aria-label="Previous slide"
        className="absolute left-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/30 text-white backdrop-blur transition hover:bg-black/50 lg:grid lg:left-6 lg:h-12 lg:w-12"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={() => go(i + 1)}
        aria-label="Next slide"
        className="absolute right-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/30 text-white backdrop-blur transition hover:bg-black/50 lg:grid lg:right-6 lg:h-12 lg:w-12"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Dots */}
      <div className="absolute inset-x-0 bottom-6 z-10 flex items-center justify-center gap-2">
        {SLIDES.map((_, n) => (
          <button
            key={n}
            aria-label={`Go to slide ${n + 1}`}
            onClick={() => go(n)}
            className={cn(
              "h-1.5 rounded-full bg-white/40 transition-all",
              n === i ? "w-8 bg-[color:var(--color-gold)]" : "w-3 hover:bg-white/70",
            )}
          />
        ))}
      </div>
    </section>
  );
}
