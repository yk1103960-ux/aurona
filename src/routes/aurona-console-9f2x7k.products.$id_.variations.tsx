import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import { ArrowLeft, Image as ImageIcon, Layers3, RefreshCw, Ruler, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductImageManager } from "@/components/admin/ProductImageManager";
import { VariantEditor } from "@/components/admin/VariantEditor";
import { adminGetProductForEdit } from "@/lib/catalog-admin.functions";

export const Route = createFileRoute("/aurona-console-9f2x7k/products/$id_/variations")({
  component: ProductVariationsPage,
});

function ProductVariationsPage() {
  const { id } = Route.useParams();
  const loadProduct = useServerFn(adminGetProductForEdit);
  const product = useQuery({
    queryKey: ["admin-product-variation-workspace", id],
    queryFn: () => loadProduct({ data: { id } }),
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (product.isLoading) {
    return (
      <div className="grid min-h-[360px] place-items-center rounded-2xl border border-slate-200 bg-white">
        <div className="text-center text-sm text-slate-500">
          <RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin" />
          Loading variation workspace…
        </div>
      </div>
    );
  }

  if (product.error || !product.data?.main_sku) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
        <h1 className="text-lg font-semibold">Could not load product variations</h1>
        <p className="mt-1 text-sm text-red-700">
          The product could not be resolved, or this account does not have catalog access.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => product.refetch()}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
          <Button variant="outline" asChild>
            <Link to="/aurona-console-9f2x7k/products">Back to products</Link>
          </Button>
        </div>
      </div>
    );
  }

  const data = product.data;
  const editorId = data.legacy_product_id ?? data.id ?? id;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/aurona-console-9f2x7k/products"
            className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to products
          </Link>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-100 text-sky-700">
              <Layers3 className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                Manage Variations
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {data.name} · <span className="font-mono">{data.main_sku}</span>
              </p>
            </div>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link to="/aurona-console-9f2x7k/products/$id" params={{ id: editorId }}>
            Edit family details
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <GuideCard
          icon={<Tags className="h-4 w-4" />}
          title="1. Name each variation"
          text="Create option axes such as Wattage, Size, Colour or Pack, then choose the values for every SKU. These values become the variation name."
        />
        <GuideCard
          icon={<Ruler className="h-4 w-4" />}
          title="2. Complete SKU details"
          text="Edit item code, barcode, customer/retailer/distributor prices, MOQ, pack size, weight and unit/package dimensions."
        />
        <GuideCard
          icon={<ImageIcon className="h-4 w-4" />}
          title="3. Attach variation photos"
          text="Upload images below, assign each one to its SKU and select one primary image for each variation."
        />
      </div>

      <VariantEditor productSku={data.main_sku} productId={editorId} />
      <ProductImageManager productSku={data.main_sku} productId={editorId} />
    </div>
  );
}

function GuideCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-slate-900">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-700">
          {icon}
        </span>
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}
