import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Clock, Flame } from "lucide-react";
import type { Product } from "@/lib/queries";
import { ProductImage } from "@/components/product/ProductImage";
import { inr, discountPct } from "@/lib/format";
import { useEffect, useState } from "react";

function useCountdown(endHour = 23) {
  const [t, setT] = useState({ h: 0, m: 0, s: 0 });
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now);
      end.setHours(endHour, 59, 59, 999);
      let d = Math.max(0, (end.getTime() - now.getTime()) / 1000);
      const h = Math.floor(d / 3600); d -= h * 3600;
      const m = Math.floor(d / 60); d -= m * 60;
      const s = Math.floor(d);
      setT({ h, m, s });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endHour]);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(t.h)} : ${pad(t.m)} : ${pad(t.s)}`;
}

export function SalesOfTheDay({ products }: { products: Product[] }) {
  const reduce = useReducedMotion();
  const timeLeft = useCountdown();
  if (products.length === 0) return null;

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background via-white to-background py-16 lg:py-20">
      <div className="pointer-events-none absolute -left-32 top-10 h-[380px] w-[380px] rounded-full bg-primary/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-[380px] w-[380px] rounded-full bg-gold/10 blur-3xl" aria-hidden />
      <div className="container-x relative">
        <div className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              <Flame className="h-3.5 w-3.5" /> Sales of the Day
            </div>
            <h2 className="text-display mt-3 text-4xl leading-[1.02] sm:text-5xl lg:text-6xl">
              Today's <span className="italic text-primary">best</span>&nbsp;prices.
            </h2>
          </div>
          <div className="hidden shrink-0 items-center gap-3 rounded-2xl border border-border bg-white px-4 py-2.5 shadow-[0_4px_18px_-8px_rgba(15,23,42,0.15)] sm:flex">
            <Clock className="h-4 w-4 text-primary" />
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Ends&nbsp;in</div>
            <div className="text-display text-lg tabular-nums text-foreground">{timeLeft}</div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.slice(0, 6).map((p, i) => {
            const off = discountPct(p.mrp, p.price);
            return (
              <motion.div
                key={p.id}
                initial={reduce ? false : { opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.55, delay: Math.min(i * 0.05, 0.25), ease: [0.22, 1, 0.36, 1] }}
              >
                <Link
                  to="/products/$slug"
                  params={{ slug: p.slug }}
                  className="group relative flex overflow-hidden rounded-2xl border border-border bg-white shadow-[0_2px_12px_-6px_rgba(15,23,42,0.10)] transition-all duration-500 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_24px_50px_-18px_rgba(10,132,209,0.30)]"
                >
                  <div className="relative h-36 w-36 shrink-0 overflow-hidden bg-gradient-to-b from-sky-50/70 to-white sm:h-40 sm:w-40">
                    <ProductImage
                      product={p}
                      categoryIcon={p.categories?.icon}
                      className="h-full w-full transform-gpu transition-transform duration-[700ms] ease-out group-hover:scale-[1.08]"
                      iconClassName="h-14 w-14"
                    />
                    {off > 0 && (
                      <span className="absolute left-2 top-2 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow">
                        {off}% OFF
                      </span>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between p-4">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {p.categories?.name}
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm font-semibold text-foreground group-hover:text-primary">
                        {p.name}
                      </div>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <div>
                        <div className="text-display text-lg leading-none text-foreground">{inr(p.price)}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground line-through">{inr(p.mrp)}</div>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                        Shop now <ArrowUpRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/deals"
            className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-white px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.22em] text-primary transition hover:bg-primary hover:text-primary-foreground"
          >
            All deals <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
