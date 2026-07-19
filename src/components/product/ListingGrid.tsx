import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { ProductCard } from "./ProductCard";
import type { Product } from "@/lib/queries";

type Row = Product & { categories: { slug: string; name: string; icon?: string | null } | null };

export function ListingHero({
  eyebrow,
  title,
  description,
  count,
}: {
  eyebrow: string;
  title: string;
  description: string;
  count: number;
}) {
  return (
    <div className="border-b border-border bg-surface">
      <div className="container-x py-8 lg:py-12">
        <nav className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{title}</span>
        </nav>
        <div className="text-eyebrow">{eyebrow}</div>
        <h1 className="text-display mt-2 text-3xl sm:text-4xl lg:text-5xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground lg:text-base">{description}</p>
        <div className="mt-4 inline-flex rounded-full border border-border-strong bg-background px-3 py-1 text-xs font-semibold">
          {count} {count === 1 ? "product" : "products"}
        </div>
      </div>
    </div>
  );
}

export function ListingGrid({ products }: { products: Row[] }) {
  if (products.length === 0) {
    return (
      <div className="container-x py-16 text-center">
        <p className="text-muted-foreground">No products available right now. Check back soon.</p>
      </div>
    );
  }
  return (
    <div className="container-x py-10">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
        {products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </div>
  );
}
