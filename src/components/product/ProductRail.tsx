import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/product/ProductCard";
import { productsQuery } from "@/lib/queries";

/**
 * Compact 8-product rail used for "Feature Products" and "Best Selling" on the
 * homepage. Cards are smaller so four fit per row on desktop.
 */
export function ProductRail({
  eyebrow,
  title,
  subtitle,
  filter,
  viewAllTo,
  count = 10,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  filter: { featured?: boolean; bestseller?: boolean };
  viewAllTo: "/featured" | "/bestsellers" | "/deals" | "/products";
  count?: number;
}) {
  const { data = [] } = useQuery(productsQuery({ ...filter, limit: count }));
  const rows = data.slice(0, count);
  if (rows.length === 0) return null;

  return (
    <section className="container-x py-4 lg:py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-eyebrow text-gold">{eyebrow}</div>
          <h2 className="text-display mt-2 text-2xl leading-tight sm:text-3xl lg:text-4xl">{title}</h2>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <Link
          to={viewAllTo}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-primary/25 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary transition hover:bg-primary hover:text-primary-foreground sm:self-auto"
        >
          View all <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {rows.map((p) => (
          <ProductCard key={p.id} product={p} categoryIcon={p.categories?.icon ?? null} nameOnly />
        ))}
      </div>
    </section>
  );
}
