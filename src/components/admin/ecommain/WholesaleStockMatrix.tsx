import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Boxes, Search, SlidersHorizontal } from "lucide-react";
import { adminListProductMaster } from "@/lib/catalog-admin.functions";

const ROOT = "/aurona-console-9f2x7k";
type Segment = "customer" | "retailer" | "distributor";

type VariantRow = {
  id: string;
  sku: string;
  attributes: Record<string, unknown> | null;
  is_active: boolean;
  price: number | null;
  retailer_price: number | null;
  distributor_price: number | null;
  mrp: number | null;
  retailer_mrp: number | null;
  distributor_mrp: number | null;
  stock: number | null;
  retailer_stock: number | null;
  distributor_stock: number | null;
  pack_size: number | null;
  retailer_pack_size: number | null;
  distributor_pack_size: number | null;
  moq: number | null;
  retailer_moq: number | null;
  distributor_moq: number | null;
};

type FamilyRow = { id: string; name: string; variants: VariantRow[] };
type ProductMasterResult = { families: FamilyRow[]; count: number };

function valueForSegment(
  variant: VariantRow,
  segment: Segment,
  field: "price" | "mrp" | "stock" | "pack_size" | "moq",
) {
  if (segment === "customer") return variant[field];
  if (segment === "retailer") {
    if (field === "price") return variant.retailer_price;
    if (field === "mrp") return variant.retailer_mrp ?? variant.mrp;
    if (field === "stock") return variant.retailer_stock;
    if (field === "pack_size") return variant.retailer_pack_size;
    return variant.retailer_moq;
  }
  if (field === "price") return variant.distributor_price;
  if (field === "mrp") return variant.distributor_mrp ?? variant.mrp;
  if (field === "stock") return variant.distributor_stock;
  if (field === "pack_size") return variant.distributor_pack_size;
  return variant.distributor_moq;
}

function formatValue(value: number | null | undefined) {
  return value == null ? "—" : value.toLocaleString("en-IN");
}

export function WholesaleStockMatrix() {
  const [segment, setSegment] = useState<Segment>("customer");
  const [search, setSearch] = useState("");
  const { data, isError, isLoading } = useQuery({
    queryKey: ["ecommain-wholesale-master", search],
    queryFn: async () =>
      (await adminListProductMaster({
        data: {
          search,
          categoryId: null,
          publication: "all",
          stock: "all",
          sort: "name",
          page: 0,
          pageSize: 50,
        },
      })) as ProductMasterResult,
  });
  const rows = (data?.families ?? []).flatMap((family) =>
    (family.variants ?? []).map((variant) => ({ family, variant })),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#646970]">
            <Boxes className="h-4 w-4" /> WholesaleX
          </div>
          <h1 className="mt-1 text-2xl font-semibold">Wholesale Products &amp; Pricing</h1>
          <p className="mt-1 text-sm text-[#646970]">
            Review buyer-specific prices, minimum quantities, pack sizes, and stock from the live
            product master.
          </p>
        </div>
        <Link
          to={`${ROOT}/products/master`}
          className="inline-flex min-h-10 items-center rounded-sm bg-[#2271b1] px-4 py-2 text-sm font-medium text-white hover:bg-[#135e96]"
        >
          Edit Product Master
        </Link>
      </div>

      <section className="overflow-hidden border border-[#c3c4c7] bg-white">
        <div
          className="flex flex-wrap gap-1 border-b border-[#c3c4c7] px-4 pt-3"
          role="tablist"
          aria-label="Buyer type"
        >
          {(["customer", "retailer", "distributor"] as const).map((buyer) => (
            <button
              key={buyer}
              type="button"
              role="tab"
              aria-selected={segment === buyer}
              onClick={() => setSegment(buyer)}
              className={`min-h-10 border-b-2 px-4 text-sm font-medium capitalize ${segment === buyer ? "border-[#2271b1] text-[#2271b1]" : "border-transparent text-[#646970] hover:text-[#1d2327]"}`}
            >
              {buyer}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#c3c4c7] p-4">
          <label className="relative w-full max-w-md">
            <span className="sr-only">Search products or SKUs</span>
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#646970]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-h-10 w-full border border-[#8c8f94] py-2 pl-9 pr-3 text-sm focus:border-[#2271b1] focus:outline-none focus:ring-1 focus:ring-[#2271b1]"
              placeholder="Search products or SKUs"
            />
          </label>
          <span className="flex items-center gap-2 text-xs text-[#646970]">
            <SlidersHorizontal className="h-4 w-4" /> {rows.length} variants on this page
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-[#f6f7f7] text-xs uppercase text-[#50575e]">
              <tr>
                {[
                  "Product",
                  "Variation / SKU",
                  "MRP",
                  "Price",
                  "MOQ",
                  "Pack size",
                  "Stock",
                  "Status",
                ].map((heading) => (
                  <th key={heading} className="whitespace-nowrap px-4 py-3 font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-[#646970]">
                    Loading product data…
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-red-700">
                    Product data could not be loaded. Check access and retry.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-[#646970]">
                    No products found.
                  </td>
                </tr>
              )}
              {!isLoading &&
                !isError &&
                rows.map(({ family, variant }) => (
                  <tr key={`${family.id}-${variant.id}`} className="border-t border-[#dcdcde]">
                    <td className="px-4 py-3 font-medium">{family.name}</td>
                    <td className="px-4 py-3">
                      <div>
                        {Object.values(variant.attributes ?? {})
                          .map(String)
                          .join(" / ") || "Default"}
                      </div>
                      <div className="text-xs text-[#646970]">{variant.sku}</div>
                    </td>
                    <td className="px-4 py-3">
                      ₹{formatValue(valueForSegment(variant, segment, "mrp"))}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      ₹{formatValue(valueForSegment(variant, segment, "price"))}
                    </td>
                    <td className="px-4 py-3">
                      {formatValue(valueForSegment(variant, segment, "moq"))}
                    </td>
                    <td className="px-4 py-3">
                      {formatValue(valueForSegment(variant, segment, "pack_size"))}
                    </td>
                    <td className="px-4 py-3">
                      {formatValue(valueForSegment(variant, segment, "stock"))}
                    </td>
                    <td className="px-4 py-3">{variant.is_active ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
