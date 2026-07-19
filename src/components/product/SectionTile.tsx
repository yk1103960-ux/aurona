import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { Product } from "@/lib/queries";
import { ProductImage } from "./ProductImage";
import { inr } from "@/lib/format";

type Row = Product & { categories: { slug: string; name: string; icon?: string | null } | null };

export function SectionTile({
  title,
  subtitle,
  href,
  products,
  accent = "bg-card",
}: {
  title: string;
  subtitle?: string;
  href: string;
  products: Row[];
  accent?: string;
}) {
  return (
    <div className={`flex flex-col rounded-none border border-border ${accent}`}>
      <div className="flex items-start justify-between gap-3 px-4 pt-4 lg:px-5 lg:pt-5">
        <div>
          <h3 className="text-lg font-bold leading-tight text-foreground lg:text-xl">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <Link
          to={href}
          className="inline-flex shrink-0 items-center gap-1 rounded bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground hover:bg-primary/90"
        >
          View All <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-0 border-t border-border">
        {products.slice(0, 4).map((p, i) => (
          <Link
            key={p.id}
            to="/products/$slug"
            params={{ slug: p.slug }}
            className={`group flex flex-col p-3 transition hover:bg-surface lg:p-4 ${
              i % 2 === 0 ? "border-r border-border" : ""
            } ${i < 2 ? "border-b border-border" : ""}`}
          >
            <ProductImage
              product={p}
              categoryIcon={p.categories?.icon ?? null}
              className="aspect-square w-full"
              iconClassName="h-14 w-14"
            />
            <div className="mt-2 line-clamp-2 text-xs font-medium leading-snug text-foreground group-hover:text-gold lg:text-sm">
              {p.name}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-sm font-bold text-foreground lg:text-base">{inr(p.price)}</span>
              {Number(p.mrp) > Number(p.price) && (
                <span className="text-[10px] font-semibold text-success">
                  {Math.round(((Number(p.mrp) - Number(p.price)) / Number(p.mrp)) * 100)}% off
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
