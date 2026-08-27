import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Clock, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProductCard } from "@/components/product/ProductCard";
import { saleOfTheDayQuery, msUntilSaleReset, saleDayKey } from "@/lib/sale-of-the-day";

function useSaleCountdown(onReset: () => void) {
  const [label, setLabel] = useState("--:--:--");
  useEffect(() => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const tick = () => {
      const ms = msUntilSaleReset();
      if (ms <= 1000) onReset();
      let s = Math.floor(ms / 1000);
      const h = Math.floor(s / 3600);
      s -= h * 3600;
      const m = Math.floor(s / 60);
      s -= m * 60;
      setLabel(`${pad(h)}:${pad(m)}:${pad(s)}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [onReset]);
  return label;
}

export function SalesOfTheDay({ count = 8 }: { count?: number }) {
  const reduce = useReducedMotion();
  const qc = useQueryClient();
  const { data: products = [] } = useQuery(saleOfTheDayQuery(count));
  const timeLeft = useSaleCountdown(() => {
    // New IST day → refetch so a fresh set of products loads automatically.
    qc.invalidateQueries({ queryKey: ["sale-of-the-day"] });
  });

  if (products.length === 0) return null;

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background via-surface to-background py-10 lg:py-14">
      <div className="pointer-events-none absolute -left-32 top-10 h-[380px] w-[380px] rounded-full bg-primary/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-[380px] w-[380px] rounded-full bg-gold/10 blur-3xl" aria-hidden />
      <div className="container-x relative">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              <Zap className="h-3.5 w-3.5" /> Sale of the Day
            </div>
            <h2 className="text-display mt-3 text-3xl leading-[1.05] sm:text-4xl lg:text-5xl">
              Today&rsquo;s <span className="italic text-primary">best</span> prices.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A fresh hand-picked set every day — refreshed automatically at midnight.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 self-start rounded-2xl border border-border bg-card px-4 py-2.5 shadow-[0_4px_18px_-8px_rgba(15,23,42,0.15)] sm:self-auto">
            <Clock className="h-4 w-4 text-primary" />
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Ends in</div>
            <div className="text-display text-lg tabular-nums text-foreground">{timeLeft}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {products.map((p, i) => (
            <motion.div
              key={p.id}
              initial={reduce ? false : { opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: Math.min(i * 0.05, 0.25), ease: [0.22, 1, 0.36, 1] }}
            >
              <ProductCard product={p} categoryIcon={p.categories?.icon ?? null} compact nameOnly />
            </motion.div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/deals"
            data-sale-day={saleDayKey()}
            className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-card px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.22em] text-primary transition hover:bg-primary hover:text-primary-foreground"
          >
            All deals <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
