import { createFileRoute, Link, notFound, redirect, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Heart,
  Minus,
  Plus,
  ShoppingCart,
  Star,
  Truck,
  Shield,
  PackageCheck,
  ArrowRight,
  MessageCircle,
  Repeat2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  productQuery,
  productsQuery,
  categoriesQuery,
  familyQuery,
  familyProductsQuery,
  relatedFamilyProductsQuery,
} from "@/lib/queries";
import { productImagesQuery } from "@/lib/product-images";
import { supabase } from "@/integrations/supabase/client";
import { discountPct, inr } from "@/lib/format";
import { ProductImage } from "@/components/product/ProductImage";
import { ProductGallery } from "@/components/product/ProductGallery";
import { PDPSkeleton } from "@/components/product/PDPSkeleton";
import { RelatedRail } from "@/components/product/RelatedRail";

import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useCompare } from "@/hooks/useCompare";
import { useVariantSelection } from "@/hooks/useVariantSelection";
import { useMyRole, useVariantSegment, useVisiblePrices } from "@/lib/pricing";
import { ContactSalesCard, PartnerVerificationBanner } from "@/components/pricing/RolePriceGate";
import { cn } from "@/lib/utils";
import { ProductAffiliateBar } from "@/components/affiliate/ProductAffiliateBar";
import { useProductReferralClick } from "@/hooks/useReferralCapture";

import type { ProductFamily } from "@/lib/queries";

type ShopperSegment = "customer" | "retailer" | "distributor";

export const Route = createFileRoute("/products/$slug")({
  loader: async ({ context, params }) => {
    // Fire everything in parallel — only await family for redirect check.
    const famPromise = context.queryClient.ensureQueryData(familyQuery(params.slug));
    context.queryClient.ensureQueryData(categoriesQuery);
    context.queryClient.ensureQueryData(productsQuery({ featured: true, limit: 4 }));
    const fam = await famPromise;
    if (fam) {
      const skus = fam.variants.map((v) => v.sku).filter(Boolean);
      context.queryClient.ensureQueryData(familyProductsQuery(skus));
      context.queryClient.ensureQueryData(productImagesQuery({ familyId: fam.id }));
      context.queryClient.ensureQueryData(
        relatedFamilyProductsQuery({
          familyId: fam.id,
          categoryId: fam.category_id,
          excludeFamilySlug: fam.slug,
          limit: 10,
        }),
      );
      return;
    }
    const p = await context.queryClient.ensureQueryData(productQuery(params.slug));
    if (!p) throw notFound();
    const { data: v } = await supabase
      .from("public_product_variants")
      .select("family_id, product_families!inner(slug)")
      .eq("sku", p.sku)
      .maybeSingle();
    const familySlug = (v as { product_families?: { slug: string } } | null)?.product_families?.slug;
    if (familySlug && familySlug !== params.slug) {
      throw redirect({ to: "/products/$slug", params: { slug: familySlug }, search: { v: p.sku } });
    }
    context.queryClient.ensureQueryData(productImagesQuery({ productId: p.id }));
  },
  validateSearch: (s: Record<string, unknown>): { v?: string } => (typeof s.v === "string" ? { v: s.v } : {}),

  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Aurona` },
      {
        name: "description",
        content: `Buy ${params.slug.replace(/-/g, " ")} at Aurona — manufacturer-direct pricing with warranty and PAN India shipping.`,
      },
    ],
  }),
  pendingComponent: PDPSkeleton,
  pendingMs: 100,
  component: PDPRoute,
  notFoundComponent: () => (
    <div className="container-x py-24 text-center">
      <h1 className="text-display text-3xl">Product not found</h1>
      <Button asChild className="mt-6">
        <Link to="/products">Browse all products</Link>
      </Button>
    </div>
  ),
});

function PDPRoute() {
  const { slug } = Route.useParams();
  const { v } = Route.useSearch();
  const segment = useVariantSegment();
  const fam = useSuspenseQuery(familyQuery(slug, segment)).data;
  if (fam && !fam.variants.length)
    return (
      <div className="container-x py-16">
        <h1 className="text-2xl font-semibold">{fam.name}</h1>
        <p className="mt-4">No variants are currently available for this product.</p>
        <Button asChild className="mt-6">
          <Link to="/products">Browse products</Link>
        </Button>
      </div>
    );
  if (fam) return <FamilyPDP key={fam.id} family={fam} initialSku={v} />;
  return <LegacyPDP slug={slug} />;
}

function FamilyPDP({ family, initialSku }: { family: ProductFamily; initialSku?: string }) {
  const cats = useSuspenseQuery(categoriesQuery).data;
  const cat = cats.find((c) => c.id === family.category_id);
  const qc = useQueryClient();
  const relatedOptions = relatedFamilyProductsQuery({
    familyId: family.id,
    categoryId: family.category_id,
    excludeFamilySlug: family.slug,
    limit: 10,
  });
  const { data: related = [] } = useQuery(relatedOptions);

  useEffect(() => {
    const channel = supabase
      .channel(`related-products-${family.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_related_families", filter: `family_id=eq.${family.id}` },
        () => qc.invalidateQueries({ queryKey: ["related-family-products", family.id] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [family.id, qc]);

  const { selection, setAxis, variant, isAvailable } = useVariantSelection(family, initialSku);
  const [qty, setQty] = useState(1);
  const cart = useCart();
  const wl = useWishlist();
  const compare = useCompare();
  const nav = useNavigate();
  const skus = useMemo(() => family.variants.map((v) => v.sku).filter(Boolean), [family]);
  const { data: productMap } = useQuery(familyProductsQuery(skus));
  const productId = productMap?.[variant.sku]?.id ?? variant.product_id ?? null;
  useProductReferralClick(productId);

  const role = useMyRole();
  const { data: priceMap } = useVisiblePrices([variant.sku]);
  const rp = priceMap?.[variant.sku];
  const effectivePrice = rp?.price ?? Number(variant.price);
  const effectiveMrp = rp?.mrp ?? Number(variant.mrp);

  const off = discountPct(effectiveMrp, effectivePrice);
  const inStock = variant.stock > 0;
  const packSize = variant.pack_size ?? variant.moq ?? 1;
  const discountAmount = Math.max(0, effectiveMrp - effectivePrice);
  const pricePerPack = effectivePrice * packSize;
  const totalOrderValue = pricePerPack * qty;
  const totalSaved = discountAmount * packSize * qty;

  // Variation-specific values, falling back to the product-level values saved in admin.
  const weightG = variant.weight_g ?? family.weight_g ?? null;
  const weightText = weightG ? `${weightG} g` : null;
  const dims =
    variant.dim_l || variant.dim_w || variant.dim_h
      ? { l: variant.dim_l, w: variant.dim_w, h: variant.dim_h }
      : family.dim_l || family.dim_w || family.dim_h
        ? { l: family.dim_l, w: family.dim_w, h: family.dim_h }
        : null;
  const dimsText = dims ? `${dims.l ?? "—"} × ${dims.w ?? "—"} × ${dims.h ?? "—"} cm` : null;
  const packageDimensions = selectSegmentPackageDimensions(
    variant,
    role.isApproved && role.role === "retailer"
      ? "retailer"
      : role.isApproved && role.role === "distributor"
        ? "distributor"
        : "customer",
  );
  const packWeightText = packageDimensions.weight ? `${packageDimensions.weight} g` : null;
  const packDimsText = packageDimensions.dims
    ? `${packageDimensions.dims.l ?? "—"} × ${packageDimensions.dims.w ?? "—"} × ${packageDimensions.dims.h ?? "—"} cm`
    : null;
  const specEntries = Object.entries((family.specifications ?? {}) as Record<string, string>).filter(
    ([k, v]) => Boolean(k) && Boolean(v),
  ) as Array<readonly [string, string]>;

  const descriptionRows = useMemo(() => {
    if (!family.description) return [];
    return family.description
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => {
        const colonIndex = text.indexOf(":");
        const dashIndex = text.indexOf(" - ");
        let separatorIndex = -1;
        let separatorLength = 0;
        if (colonIndex > 0) {
          separatorIndex = colonIndex;
          separatorLength = 1;
        } else if (dashIndex > 0) {
          separatorIndex = dashIndex;
          separatorLength = 3;
        }
        if (separatorIndex > 0) {
          return {
            label: text.slice(0, separatorIndex).trim(),
            value: text.slice(separatorIndex + separatorLength).trim(),
          };
        }
        return { value: text };
      });
  }, [family.description]);

  const buyNow = async () => {
    if (!productId || !inStock) return;
    await cart.add.mutateAsync({ productId, quantity: qty });
    nav({ to: "/checkout" });
  };

  return (
    <div className="container-x py-8">
      <div className="mb-6 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>{" "}
        /{" "}
        <Link to="/products" className="hover:text-foreground">
          Products
        </Link>
        {cat && (
          <>
            {" "}
            /{" "}
            <Link to="/category/$slug" params={{ slug: cat.slug }} className="hover:text-foreground">
              {cat.name}
            </Link>
          </>
        )}
        <>
          {" "}
          / <span className="text-foreground">{family.name}</span>
        </>
      </div>

      <div className="grid gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <FamilyGallery
          key={variant.sku}
          family={family}
          variantSku={variant.sku}
          variantImageSeed={variant.image_seed}
          variantImageUrl={variant.image_url}
          categoryIcon={cat?.icon}
        />

        <div>
          <div className="text-eyebrow">{cat?.name ?? "Aurona"}</div>
          <h1 className="text-display mt-2 text-4xl">{family.name}</h1>
          <div className="mt-2 text-sm text-muted-foreground">
            Brand: {family.brand} · Model: {family.main_sku}
          </div>

          <PartnerVerificationBanner />

          <div className="mt-5 overflow-hidden rounded-lg border border-border bg-surface">
            <div
              className={cn(
                "flex items-center justify-between gap-4 px-4 py-3 text-primary-foreground",
                role.role === "distributor" ? "bg-gradient-to-r from-primary to-accent" : "bg-primary",
              )}
            >
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider">
                  {role.isPartnerPending
                    ? "Awaiting approval"
                    : role.role === "retailer"
                      ? "Retailer price"
                      : role.role === "distributor"
                        ? "Distributor price"
                        : "Starting price"}
                </div>
                <div className="text-[11px] opacity-80">
                  {role.isPartnerPending
                    ? "Your account is under verification"
                    : role.role === "retailer"
                      ? "Trade wholesale rate"
                      : role.role === "distributor"
                        ? "Your approved distributor rate"
                        : "Base price for this selected product model"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-display text-2xl">{role.isPartnerPending ? "Hidden" : inr(effectivePrice)}</div>
                {/* Constant label: variant resolution happens after hydration,
                    so branching on it here caused a hydration mismatch. */}
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">per unit</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star
                    key={i}
                    className={cn(
                      "h-3.5 w-3.5",
                      i < Math.round(Number(family.rating)) ? "fill-gold text-gold" : "text-border",
                    )}
                  />
                ))}
                <span className="ml-1">({family.review_count} reviews)</span>
              </div>
              <span className={cn("font-semibold", inStock ? "text-success" : "text-destructive")}>
                {inStock ? `${variant.stock} available` : "Out of stock"}
              </span>
              <button className="inline-flex items-center gap-1 hover:text-foreground">
                <MessageCircle className="h-3.5 w-3.5" /> Product enquiry
              </button>
              <button
                onClick={() => productId && wl.toggle.mutate(productId)}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Heart
                  className={cn("h-3.5 w-3.5", productId && wl.has(productId) && "fill-current text-destructive")}
                />{" "}
                Wishlist
              </button>
              <button
                type="button"
                onClick={() => compare.toggle(family.slug, family.name)}
                className={cn(
                  "inline-flex items-center gap-1 hover:text-foreground",
                  compare.has(family.slug) && "font-semibold text-primary",
                )}
              >
                <Repeat2 className="h-3.5 w-3.5" /> {compare.has(family.slug) ? "In compare" : "Compare"}
              </button>
            </div>
          </div>

          {family.short_description && <p className="mt-6 text-sm text-muted-foreground">{family.short_description}</p>}

          {/* Axis pickers */}
          {family.axes.length > 0 && (
            <div className="mt-8 space-y-4 border-t border-border pt-6">
              <div className="text-eyebrow text-foreground">Select variants</div>
              {family.axes.map((axis) => (
                <div key={axis.axis_key} className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-start">
                  <div className="pt-2 text-xs text-muted-foreground">
                    {axis.label}
                    <span className="ml-1 text-foreground">{selection[axis.axis_key]}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {axis.values.map((val) => {
                      const active = selection[axis.axis_key] === val;
                      const avail = isAvailable(axis.axis_key, val);
                      return (
                        <button
                          key={val}
                          onClick={() => setAxis(axis.axis_key, val)}
                          disabled={!avail}
                          className={cn(
                            "min-h-9 rounded-none border px-4 py-2 text-xs font-medium transition",
                            active
                              ? "border-foreground bg-foreground text-background"
                              : "border-border hover:border-foreground",
                            !avail && "cursor-not-allowed opacity-40 line-through",
                          )}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
            <div className="text-xs text-muted-foreground">Quantity of packs</div>
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-border">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="grid h-10 w-10 place-items-center hover:bg-surface"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="w-12 text-center text-sm font-semibold">{qty}</div>
                <button onClick={() => setQty(qty + 1)} className="grid h-10 w-10 place-items-center hover:bg-surface">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <span className="text-xs text-muted-foreground">Pack of {packSize}</span>
            </div>
          </div>

          <div className="mt-7 divide-y divide-border border-y border-border">
            <PriceRow label="M.R.P." value={`${inr(effectiveMrp)} /Pc`} muted />
            <PriceRow label="Discount %" value={`${off}%`} highlight />
            <PriceRow label="Discount amount" value={`${inr(discountAmount)} /Pc`} highlight />
            <PriceRow
              label={
                role.role === "retailer"
                  ? "Retailer price / unit"
                  : role.role === "distributor"
                    ? "Distributor price / unit"
                    : "Price per unit"
              }
              value={`${inr(effectivePrice)} /Pc`}
            />
            <PriceRow label="Price per pack" value={`${inr(pricePerPack)} /Pack`} />
            <PriceRow label="Total order value" value={inr(totalOrderValue)} />
            <PriceRow label="You save on this order" value={inr(totalSaved)} highlight />
            <PriceRow label="SKU" value={variant.sku} mono />
          </div>

          <div className="mt-8 grid gap-3 border border-border p-4 sm:grid-cols-2">
            <Spec label="MOQ" value={variant.moq ? String(variant.moq) : null} />
            <Spec label="Weight" value={weightText} />
            <Spec label="Pack size" value={variant.pack_size ? String(variant.pack_size) : null} />
            <Spec label="Dimensions (LxWxH)" value={dimsText} />
            <Spec label="Package weight" value={packWeightText} />
            <Spec label="Package dimensions" value={packDimsText} />
            <Spec label="Warranty" value={family.warranty} />
            <Spec label="Country of origin" value={specValue(specEntries, "Country of origin") ?? "India"} />
          </div>

          {role.isPartnerPending ? (
            <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm">
              <div className="font-semibold text-primary">Verification pending</div>
              <div className="mt-0.5 text-muted-foreground">
                Ordering unlocks as soon as Aurona approves your {role.role} account.
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Button
                size="lg"
                variant="outline"
                className="h-12 gap-2 rounded-none"
                onClick={() => productId && cart.add.mutate({ productId, quantity: qty })}
                disabled={!inStock || cart.add.isPending}
              >
                <ShoppingCart className="h-4 w-4" /> Add to cart
              </Button>
              <Button size="lg" className="h-12 rounded-none" onClick={buyNow} disabled={!inStock}>
                Buy now
              </Button>
            </div>
          )}

          {role.role === "distributor" && !role.isPartnerPending && (
            <ContactSalesCard className="mt-4" productName={family.name} sku={variant.sku} />
          )}

          <div className="mt-4">
            <ProductAffiliateBar productId={productId} slug={family.slug} />
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
            <div className="flex flex-col items-center gap-1 rounded-xl border border-border p-3 text-center">
              <Truck className="h-4 w-4 text-gold" /> PAN India delivery
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl border border-border p-3 text-center">
              <Shield className="h-4 w-4 text-gold" /> {family.warranty ?? "1 Year"} warranty
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl border border-border p-3 text-center">
              <PackageCheck className="h-4 w-4 text-gold" /> Manufacturer direct
            </div>
          </div>
        </div>
      </div>

      <div className="mt-16">
        <Tabs defaultValue={family.description ? "about" : "specs"}>
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
            {family.description && <TabsTrigger value="about">Description</TabsTrigger>}
            <TabsTrigger value="specs">Specifications</TabsTrigger>
            <TabsTrigger value="variations">All Variations ({family.variants.length})</TabsTrigger>
            <TabsTrigger value="ship">Shipping</TabsTrigger>
          </TabsList>
          {family.description && (
            <TabsContent value="about" className="pt-6">
              <div className="max-w-2xl">
                <div className="text-eyebrow">About this product</div>
                <div className="mt-3">
                  <LinedRows items={descriptionRows} />
                </div>
              </div>
            </TabsContent>
          )}
          <TabsContent value="specs" className="pt-6">
            <div className="max-w-2xl">
              <LinedRows
                items={mergeSpecRows(
                  [
                    ["Brand", family.brand],
                    ["Category", cat?.name],
                    ["Main SKU", family.main_sku],
                    ["Selected SKU", variant.sku],
                    ...Object.entries(variant.attributes)
                      .filter(([k, v]) => k !== "variant_label" && Boolean(v))
                      .map(
                        ([k, v]) =>
                          [family.axes.find((axis) => axis.axis_key === k)?.label ?? k.replace(/_/g, " "), v] as const,
                      ),
                    ["MOQ", variant.moq ? String(variant.moq) : null],
                    ["Pack size", variant.pack_size ? String(variant.pack_size) : null],
                    ["Weight", weightText],
                    ["Dimensions (LxWxH)", dimsText],
                    ["Package weight", packWeightText],
                    ["Package dimensions", packDimsText],
                    ["Body type", specValue(specEntries, "Body type")],
                    ["Warranty", family.warranty],
                    ["Material", specValue(specEntries, "Material")],
                    ["Refundable", family.refundable === false ? "No" : "Yes"],
                    ["Country of origin", "India"],
                  ] as Array<readonly [string, string | null | undefined]>,
                  specEntries,
                )}
              />
            </div>
          </TabsContent>

          <TabsContent value="variations" className="pt-6">
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">SKU</th>
                    {family.axes.map((a) => (
                      <th key={a.axis_key} className="px-3 py-2">
                        {a.label}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right">MRP</th>
                    <th className="px-3 py-2 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {family.variants.map((v) => (
                    <tr key={v.id} className={cn(v.sku === variant.sku && "bg-surface/60")}>
                      <td className="px-3 py-2 font-mono text-xs">{v.sku}</td>
                      {family.axes.map((a) => (
                        <td key={a.axis_key} className="px-3 py-2">
                          {v.attributes[a.axis_key] ?? "—"}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right text-muted-foreground line-through">{inr(v.mrp)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{inr(v.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
          <TabsContent value="ship" className="pt-6 text-sm text-muted-foreground">
            {family.estimated_shipping_days != null && family.estimated_shipping_days > 0
              ? `PAN India delivery in ${family.estimated_shipping_days} business day${family.estimated_shipping_days === 1 ? "" : "s"}.`
              : "PAN India delivery. Delivery time is confirmed at checkout."}{" "}
            Free shipping on orders over ₹999.
          </TabsContent>
        </Tabs>
      </div>

      {related.length > 0 && <div className="mt-20">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="text-eyebrow">Frequently bought together</div>
            <h2 className="text-display mt-2 text-3xl">Pairs from this category</h2>
          </div>
          <Link
            to="/category/$slug"
            params={{ slug: cat?.slug ?? "" }}
            disabled={!cat}
            className="hidden items-center gap-1 text-sm font-medium hover:text-gold sm:inline-flex"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <RelatedRail products={related} iconFor={(p) => cats.find((c) => c.id === p.category_id)?.icon} />
      </div>}
    </div>
  );
}

function LegacyPDP({ slug }: { slug: string }) {
  const product = useSuspenseQuery(productQuery(slug)).data!;
  useProductReferralClick(product.id);

  const cats = useSuspenseQuery(categoriesQuery).data;
  const cat = cats.find((c) => c.id === product.category_id);
  // Recommendations stay inside the product's own category.
  const { data: sameCategory = [] } = useQuery(productsQuery({ categorySlug: cat?.slug ?? "", limit: 12 }));
  const related = sameCategory.filter((p) => p.category_id === product.category_id && p.id !== product.id).slice(0, 10);
  const [qty, setQty] = useState(1);
  const cart = useCart();
  const wl = useWishlist();
  const nav = useNavigate();
  const off = discountPct(product.mrp, product.price);

  const buyNow = async () => {
    await cart.add.mutateAsync({ productId: product.id, quantity: qty });
    nav({ to: "/checkout" });
  };

  return (
    <div className="container-x py-8">
      <div className="mb-6 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>{" "}
        /{" "}
        <Link to="/products" className="hover:text-foreground">
          Products
        </Link>
        {cat && (
          <>
            {" "}
            /{" "}
            <Link to="/category/$slug" params={{ slug: cat.slug }} className="hover:text-foreground">
              {cat.name}
            </Link>
          </>
        )}
        <>
          {" "}
          / <span className="text-foreground">{product.name}</span>
        </>
      </div>

      <div className="grid gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <LegacyGallery product={product} categoryIcon={cat?.icon} />
        <div>
          <div className="text-eyebrow">{cat?.name ?? "Aurona"}</div>
          <h1 className="text-display mt-2 text-4xl">{product.name}</h1>
          <div className="mt-2 text-sm text-muted-foreground">
            SKU: {product.sku} · Brand: {product.brand}
          </div>
          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-display text-4xl">{inr(product.price)}</span>
            {Number(product.mrp) > Number(product.price) && (
              <>
                <span className="text-lg text-muted-foreground line-through">{inr(product.mrp)}</span>
                <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                  {off}% OFF
                </span>
              </>
            )}
          </div>
          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center rounded-full border border-border">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="grid h-11 w-11 place-items-center">
                <Minus className="h-4 w-4" />
              </button>
              <div className="w-10 text-center text-sm font-semibold">{qty}</div>
              <button onClick={() => setQty(qty + 1)} className="grid h-11 w-11 place-items-center">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => wl.toggle.mutate(product.id)}
              className={cn(
                "grid h-11 w-11 place-items-center rounded-full border border-border hover:bg-surface",
                wl.has(product.id) && "text-destructive",
              )}
            >
              <Heart className={cn("h-4 w-4", wl.has(product.id) && "fill-current")} />
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button
              size="lg"
              variant="outline"
              className="h-12 gap-2 rounded-full"
              onClick={() => cart.add.mutate({ productId: product.id, quantity: qty })}
            >
              <ShoppingCart className="h-4 w-4" /> Add to cart
            </Button>
            <Button size="lg" className="h-12 rounded-full" onClick={buyNow}>
              Buy now
            </Button>
          </div>
          <div className="mt-4">
            <ProductAffiliateBar productId={product.id} slug={product.slug} />
          </div>
        </div>
      </div>

      <div className="mt-20">
        <div className="text-eyebrow">More from {cat?.name ?? "Aurona"}</div>
        <h2 className="text-display mt-2 text-3xl">You may also like</h2>
        <div className="mt-8">
          <RelatedRail products={related} iconFor={(p) => cats.find((c) => c.id === p.category_id)?.icon} />
        </div>
      </div>
    </div>
  );
}

function LinedRows({ items }: { items: Array<{ label?: string; value: string }> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {items.map((item, index) => (
        <div
          key={index}
          className="grid grid-cols-[minmax(120px,0.8fr)_1.2fr] gap-4 border-b border-border px-4 py-3 text-sm last:border-b-0 sm:grid-cols-2"
        >
          {item.label ? (
            <>
              <div className="capitalize text-muted-foreground">{item.label}</div>
              <div className="font-medium">{item.value || "—"}</div>
            </>
          ) : (
            <div className="col-span-2 font-medium">{item.value}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-eyebrow">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value || "—"}</div>
    </div>
  );
}

function PriceRow({
  label,
  value,
  muted,
  highlight,
  mono,
}: {
  label: string;
  value: string;
  muted?: boolean;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(118px,0.8fr)_1.2fr] gap-4 px-4 py-3 text-sm sm:grid-cols-[150px_1fr]">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-semibold text-foreground",
          muted && "text-muted-foreground line-through",
          highlight && "text-success",
          mono && "font-mono text-xs font-medium",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function FamilyGallery({
  family,
  variantSku,
  variantImageSeed,
  variantImageUrl,
  categoryIcon,
}: {
  family: ProductFamily;
  variantSku: string;
  variantImageSeed: string | null;
  variantImageUrl: string | null;
  categoryIcon?: string | null;
}) {
  const { data: all = [] } = useQuery(productImagesQuery({ familyId: family.id }));
  // Variation-wise photos, in order of specificity:
  //   1. photos tagged with this exact variant SKU
  //   2. photos tagged with an SKU prefix this variant starts with (model/watt group)
  //   3. untagged family photos
  const exact = all.filter((i) => i.variant_sku === variantSku);
  const prefixed = all
    .filter((i) => i.variant_sku && i.variant_sku !== variantSku && variantSku.startsWith(i.variant_sku))
    .sort((a, b) => b.variant_sku!.length - a.variant_sku!.length || a.sort_order - b.sort_order);
  const generic = all.filter((i) => !i.variant_sku);
  const images = exact.length ? exact : prefixed.length ? prefixed : generic.length ? generic : all;
  return (
    <ProductGallery
      images={images}
      fallback={{
        image_seed: variantImageSeed ?? family.image_seed,
        image_url: variantImageUrl ?? family.image_url,
        name: family.name,
        slug: family.slug,
      }}
      categoryIcon={categoryIcon}
      resetKey={variantSku}
    />
  );
}

function LegacyGallery({
  product,
  categoryIcon,
}: {
  product: { id: string; name: string; slug: string; image_seed: string | null; image_url?: string | null };
  categoryIcon?: string | null;
}) {
  const { data: images = [] } = useQuery(productImagesQuery({ productId: product.id }));
  return (
    <ProductGallery
      images={images}
      fallback={{
        image_seed: product.image_seed,
        image_url: product.image_url ?? null,
        name: product.name,
        slug: product.slug,
      }}
      categoryIcon={categoryIcon}
    />
  );
}

/** Value saved in the admin Specifications editor for a label, if any. */
function specValue(entries: Array<readonly [string, string]>, label: string): string | null {
  const key = label.trim().toLowerCase();
  const hit = entries.find(([k]) => k.trim().toLowerCase() === key);
  return hit ? hit[1] : null;
}

/**
 * Built-in rows first, but any row the admin also typed in Specifications uses
 * the admin value; remaining admin specifications are appended in order.
 */
function mergeSpecRows(
  base: Array<readonly [string, string | null | undefined]>,
  entries: Array<readonly [string, string]>,
): Array<{ label: string; value: string }> {
  const used = new Set<string>();
  const rows = base.map(([label, value]) => {
    const override = specValue(entries, label);
    if (override !== null) used.add(label.trim().toLowerCase());
    return { label, value: override ?? value };
  });
  for (const [label, value] of entries) {
    if (used.has(label.trim().toLowerCase())) continue;
    rows.push({ label, value });
  }
  return rows.filter((r): r is { label: string; value: string } => Boolean(r.value));
}

function selectSegmentPackageDimensions(
  variant: ProductFamily["variants"][number],
  segment: ShopperSegment,
): {
  weight: number | null;
  dims: { l: number | null; w: number | null; h: number | null } | null;
} {
  const weight =
    segment === "retailer"
      ? variant.retailer_pack_weight_g ?? variant.pack_weight_g ?? null
      : segment === "distributor"
        ? variant.distributor_pack_weight_g ?? variant.pack_weight_g ?? null
        : variant.pack_weight_g ?? null;
  const l =
    segment === "retailer"
      ? variant.retailer_pack_l ?? variant.pack_l ?? null
      : segment === "distributor"
        ? variant.distributor_pack_l ?? variant.pack_l ?? null
        : variant.pack_l ?? null;
  const w =
    segment === "retailer"
      ? variant.retailer_pack_w ?? variant.pack_w ?? null
      : segment === "distributor"
        ? variant.distributor_pack_w ?? variant.pack_w ?? null
        : variant.pack_w ?? null;
  const h =
    segment === "retailer"
      ? variant.retailer_pack_h ?? variant.pack_h ?? null
      : segment === "distributor"
        ? variant.distributor_pack_h ?? variant.pack_h ?? null
        : variant.pack_h ?? null;
  return {
    weight,
    dims: l || w || h ? { l, w, h } : null,
  };
}
