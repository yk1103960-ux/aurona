import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/lib/queries";
import { productsQuery } from "@/lib/queries";

export type SaleRow = Product & { categories: { slug: string; name: string; icon: string | null } | null };

const IST_OFFSET_MIN = 330;

/** Current sale "day" key in IST (YYYY-MM-DD) — rotation boundary. */
export function saleDayKey(now = new Date()): string {
  const ist = new Date(now.getTime() + (IST_OFFSET_MIN + now.getTimezoneOffset()) * 60_000);
  return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, "0")}-${String(ist.getDate()).padStart(2, "0")}`;
}

/** Milliseconds until the next IST midnight (when the sale rotates). */
export function msUntilSaleReset(now = new Date()): number {
  const ist = new Date(now.getTime() + (IST_OFFSET_MIN + now.getTimezoneOffset()) * 60_000);
  const end = new Date(ist);
  end.setHours(23, 59, 59, 999);
  return Math.max(0, end.getTime() - ist.getTime() + 1000);
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic per-day ordering: same all day, different tomorrow. */
function dailyPick<T extends { id: string }>(rows: T[], day: string, count: number): T[] {
  return [...rows]
    .map((r) => ({ r, k: hash(day + ":" + r.id) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, count)
    .map((x) => x.r);
}

export const saleOfTheDayQuery = (count = 6) =>
  queryOptions({
    queryKey: ["sale-of-the-day", saleDayKey(), count],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Eligible pool = admin-flagged "On sale" products; fall back to any
      // published product carrying a real MRP discount.
      const flagged = (await supabase
        .from("products")
        .select(
          "id, slug, sku, name, category_id, brand, short_description, mrp, price, unit, stock, rating, review_count, is_featured, is_bestseller, is_new, is_sale, image_seed, wattage, size, categories(slug, name, icon)",
        )
        .eq("is_published", true)
        .eq("is_sale", true)) as unknown as { data: SaleRow[] | null };

      let pool = (flagged.data ?? []).filter((p) => Number(p.price) > 0 && Number(p.mrp) > Number(p.price));

      if (pool.length < count) {
        const all = (await supabase
          .from("products")
          .select(
            "id, slug, sku, name, category_id, brand, short_description, mrp, price, unit, stock, rating, review_count, is_featured, is_bestseller, is_new, is_sale, image_seed, wattage, size, categories(slug, name, icon)",
          )
          .eq("is_published", true)) as unknown as { data: SaleRow[] | null };
        const extra = (all.data ?? []).filter(
          (p) => Number(p.price) > 0 && Number(p.mrp) > Number(p.price) && !pool.some((x) => x.id === p.id),
        );
        pool = [...pool, ...extra];
      }

      // One entry per product family — a family's variants (e.g. HEXA 3 W /
      // 5 W in six colours) must never appear as repeated cards.
      const poolSkus = [...new Set(pool.map((p) => p.sku).filter(Boolean))];
      const famIdBySku = new Map<string, string>();
      const famSlugBySku = new Map<string, string>();
      const famNameBySku = new Map<string, string>();
      if (poolSkus.length > 0) {
        const { data: links } = await supabase
          .from("product_variants")
          .select("sku, family_id, product_families(slug, name)")
          .in("sku", poolSkus);
        for (const l of (links ?? []) as unknown as {
          sku: string; family_id: string | null; product_families?: { slug: string; name: string } | null;
        }[]) {
          if (l.family_id) famIdBySku.set(l.sku, l.family_id);
          if (l.product_families?.slug) famSlugBySku.set(l.sku, l.product_families.slug);
          if (l.product_families?.name) famNameBySku.set(l.sku, l.product_families.name);
        }
      }
      const seen = new Set<string>();
      pool = pool.filter((p) => {
        const fam = famIdBySku.get(p.sku);
        if (!fam) return true;
        if (seen.has(fam)) return false;
        seen.add(fam);
        return true;
      });

      const day = saleDayKey();

      // Optional admin override: site_settings key `sale_of_the_day_skus`
      // (comma separated SKUs) pins today's selection.
      const { data: setting } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "sale_of_the_day_skus")
        .maybeSingle();
      const pinned = (setting?.value ?? "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      let picked: SaleRow[];
      if (pinned.length > 0) {
        const bySku = new Map(pool.map((p) => [p.sku?.toUpperCase(), p]));
        const forced = pinned.map((s) => bySku.get(s)).filter(Boolean) as SaleRow[];
        const rest = dailyPick(
          pool.filter((p) => !forced.some((f) => f.id === p.id)),
          day,
          Math.max(0, count - forced.length),
        );
        picked = [...forced, ...rest];
      } else {
        picked = dailyPick(pool, day, count);
      }

      if (picked.length === 0) return [] as SaleRow[];

      // Resolve real uploaded images + variant links through the shared query.
      const ids = new Set(picked.map((p) => p.id));
      const enriched = (await (productsQuery().queryFn as () => Promise<SaleRow[]>)()).filter((p) => ids.has(p.id));
      const byId = new Map(enriched.map((p) => [p.id, p]));
      return picked.map((p) => {
        const base = byId.get(p.id) ?? p;
        return {
          ...base,
          name: famNameBySku.get(p.sku) ?? base.name,
          family_slug: famSlugBySku.get(p.sku) ?? base.family_slug ?? null,
        };
      });
    },
  });

