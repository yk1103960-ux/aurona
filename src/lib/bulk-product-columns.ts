export type ProductMasterColumn = {
  serial: number;
  key: ProductMasterColumnKey;
  topHeader: string;
  detailHeader: string;
  group: string;
  productManagerField: string;
};

type FixedProductMasterColumnKey =
  | "sr_no" | "function" | "category_name" | "product_name" | "family_id" | "main_sku"
  | "brand" | "unit" | "model" | "variant_name" | "variant_sku" | "variant_id" | "barcode"
  | "attributes_json" | "short_description" | "description" | "features" | "refundable"
  | "sale_status" | "active_status" | "mrp" | "weight_g" | "dim_l" | "dim_w" | "dim_h"
  | "customer_discount" | "customer_price" | "customer_moq" | "customer_stock"
  | "customer_reserved_stock" | "customer_pack_size" | "customer_pack_weight_g"
  | "customer_pack_l" | "customer_pack_w" | "customer_pack_h" | "retailer_discount"
  | "retailer_price" | "retailer_moq" | "retailer_stock" | "retailer_reserved_stock"
  | "retailer_pack_size" | "retailer_pack_weight_g" | "retailer_pack_l" | "retailer_pack_w"
  | "retailer_pack_h" | "distributor_discount" | "distributor_price" | "distributor_moq"
  | "distributor_stock" | "distributor_reserved_stock" | "distributor_pack_size"
  | "distributor_pack_weight_g" | "distributor_pack_l" | "distributor_pack_w"
  | "distributor_pack_h" | "commission_program" | "commission_type" | "commission_value"
  | "max_commission" | "seo_title" | "seo_description" | "shipping_days" | "warranty"
  | "frequently_bought_category";

export type ProductMasterColumnKey =
  | FixedProductMasterColumnKey
  | `variation_${number}_name`
  | `variation_${number}_value`;

type ColumnSeed = Omit<ProductMasterColumn, "serial">;

const BEFORE_VARIATIONS: ColumnSeed[] = [
  { key: "sr_no", topHeader: "Sr No", detailHeader: "", group: "Product / Variant", productManagerField: "Import row serial (workflow metadata; not stored)" },
  { key: "function", topHeader: "Function", detailHeader: "", group: "Product / Variant", productManagerField: "Import action: Create / Update (workflow metadata; not stored)" },
  { key: "category_name", topHeader: "Product Category", detailHeader: "", group: "Product / Variant", productManagerField: "categories.name → product_families.category_id" },
  { key: "product_name", topHeader: "Product Name", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.name" },
  { key: "family_id", topHeader: "family_id", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.id (lookup / validation)" },
  { key: "main_sku", topHeader: "Main SKU", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.main_sku" },
  { key: "brand", topHeader: "Brand Name", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.brand" },
  { key: "unit", topHeader: "Unit", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.unit" },
  { key: "model", topHeader: "Model Name", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.model" },
  { key: "variant_name", topHeader: "Variants Name", detailHeader: "", group: "Product / Variant", productManagerField: "product_variants.attributes.variant_label" },
  { key: "variant_sku", topHeader: "Variants SKU", detailHeader: "", group: "Product / Variant", productManagerField: "product_variants.sku" },
  { key: "variant_id", topHeader: "variant_id", detailHeader: "", group: "Product / Variant", productManagerField: "product_variants.id (lookup / validation)" },
  { key: "barcode", topHeader: "barcode", detailHeader: "", group: "Product / Variant", productManagerField: "product_variants.barcode" },
];

const AFTER_VARIATIONS: ColumnSeed[] = [
  { key: "attributes_json", topHeader: "attributes_json", detailHeader: "", group: "Product / Variant", productManagerField: "product_variants.attributes (merged JSON)" },
  { key: "short_description", topHeader: "Short Description", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.short_description" },
  { key: "description", topHeader: "Description", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.description" },
  { key: "features", topHeader: "Key Features", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.features" },
  { key: "refundable", topHeader: "Refundable \n(YES/NO)", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.refundable" },
  { key: "sale_status", topHeader: "Status (For Sale/ Deal )", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.is_sale" },
  { key: "active_status", topHeader: "Status (Active-True / Inactive-False)", detailHeader: "", group: "Product / Variant", productManagerField: "product_variants.is_active" },

  { key: "mrp", topHeader: "Single PC Details", detailHeader: "MRP", group: "Single PC Details", productManagerField: "product_variants.mrp" },
  { key: "weight_g", topHeader: "", detailHeader: "Single PC’s Weight", group: "Single PC Details", productManagerField: "product_variants.weight_g" },
  { key: "dim_l", topHeader: "", detailHeader: "Single PC’s Length", group: "Single PC Details", productManagerField: "product_variants.dim_l" },
  { key: "dim_w", topHeader: "", detailHeader: "Single PC’s Width", group: "Single PC Details", productManagerField: "product_variants.dim_w" },
  { key: "dim_h", topHeader: "", detailHeader: "Single PC’s Height", group: "Single PC Details", productManagerField: "product_variants.dim_h" },

  { key: "customer_discount", topHeader: "Details For Customer's", detailHeader: "Customer’s Discount", group: "Customer Details", productManagerField: "product_variants.discount_pct" },
  { key: "customer_price", topHeader: "", detailHeader: "Customer’s Price", group: "Customer Details", productManagerField: "product_variants.price" },
  { key: "customer_moq", topHeader: "", detailHeader: "Customer’s MOQ", group: "Customer Details", productManagerField: "product_variants.moq" },
  { key: "customer_stock", topHeader: "", detailHeader: "Customer’s Stock", group: "Customer Details", productManagerField: "product_variants.stock" },
  { key: "customer_reserved_stock", topHeader: "", detailHeader: "Customer’s Reserved Stock", group: "Customer Details", productManagerField: "product_variants.reserved_stock" },
  { key: "customer_pack_size", topHeader: "", detailHeader: "Customer’s Pack Size", group: "Customer Details", productManagerField: "product_variants.pack_size" },
  { key: "customer_pack_weight_g", topHeader: "", detailHeader: "Customer’s Package’s Weight", group: "Customer Details", productManagerField: "product_variants.pack_weight_g" },
  { key: "customer_pack_l", topHeader: "", detailHeader: "Customer’s Package’s Length", group: "Customer Details", productManagerField: "product_variants.pack_l" },
  { key: "customer_pack_w", topHeader: "", detailHeader: "Customer’s Package’s Width", group: "Customer Details", productManagerField: "product_variants.pack_w" },
  { key: "customer_pack_h", topHeader: "", detailHeader: "Customer’s Package’s Height", group: "Customer Details", productManagerField: "product_variants.pack_h" },

  { key: "retailer_discount", topHeader: "Details for Retailors", detailHeader: "Retailer’s Discount", group: "Retailer Details", productManagerField: "product_variants.retailer_discount_pct" },
  { key: "retailer_price", topHeader: "", detailHeader: "Retailer’s Price", group: "Retailer Details", productManagerField: "product_variants.retailer_price" },
  { key: "retailer_moq", topHeader: "", detailHeader: "Retailer’s MOQ", group: "Retailer Details", productManagerField: "product_variants.retailer_moq" },
  { key: "retailer_stock", topHeader: "", detailHeader: "Retailer’s Stock", group: "Retailer Details", productManagerField: "product_variants.retailer_stock" },
  { key: "retailer_reserved_stock", topHeader: "", detailHeader: "Retailer’s Reserved Stock", group: "Retailer Details", productManagerField: "product_variants.retailer_reserved_stock" },
  { key: "retailer_pack_size", topHeader: "", detailHeader: "Retailer’s Pack Size", group: "Retailer Details", productManagerField: "product_variants.retailer_pack_size" },
  { key: "retailer_pack_weight_g", topHeader: "", detailHeader: "Retailer’s Package’s Weight", group: "Retailer Details", productManagerField: "product_variants.retailer_pack_weight_g" },
  { key: "retailer_pack_l", topHeader: "", detailHeader: "Retailer’s Package’s Length", group: "Retailer Details", productManagerField: "product_variants.retailer_pack_l" },
  { key: "retailer_pack_w", topHeader: "", detailHeader: "Retailer’s Package’s Width", group: "Retailer Details", productManagerField: "product_variants.retailer_pack_w" },
  { key: "retailer_pack_h", topHeader: "", detailHeader: "Retailer’s Package’s Height", group: "Retailer Details", productManagerField: "product_variants.retailer_pack_h" },

  { key: "distributor_discount", topHeader: "Details for Distributors", detailHeader: "Distributor’s Discount", group: "Distributor Details", productManagerField: "product_variants.distributor_discount_pct" },
  { key: "distributor_price", topHeader: "", detailHeader: "Distributor’s Price", group: "Distributor Details", productManagerField: "product_variants.distributor_price" },
  { key: "distributor_moq", topHeader: "", detailHeader: "Distributor’s MOQ", group: "Distributor Details", productManagerField: "product_variants.distributor_moq" },
  { key: "distributor_stock", topHeader: "", detailHeader: "Distributor’s Stock", group: "Distributor Details", productManagerField: "product_variants.distributor_stock" },
  { key: "distributor_reserved_stock", topHeader: "", detailHeader: "Distributor’s Reserved Stock", group: "Distributor Details", productManagerField: "product_variants.distributor_reserved_stock" },
  { key: "distributor_pack_size", topHeader: "", detailHeader: "Distributor’s Pack Size", group: "Distributor Details", productManagerField: "product_variants.distributor_pack_size" },
  { key: "distributor_pack_weight_g", topHeader: "", detailHeader: "Distributor’s Package’s Weight", group: "Distributor Details", productManagerField: "product_variants.distributor_pack_weight_g" },
  { key: "distributor_pack_l", topHeader: "", detailHeader: "Distributor’s Package’s Length", group: "Distributor Details", productManagerField: "product_variants.distributor_pack_l" },
  { key: "distributor_pack_w", topHeader: "", detailHeader: "Distributor’s Package’s Width", group: "Distributor Details", productManagerField: "product_variants.distributor_pack_w" },
  { key: "distributor_pack_h", topHeader: "", detailHeader: "Distributor’s Package’s Height", group: "Distributor Details", productManagerField: "product_variants.distributor_pack_h" },

  { key: "commission_program", topHeader: "Commission Details", detailHeader: "Commission Set on", group: "Commission Details", productManagerField: "Product Manager commission grouping: All Variants / selected variation axis; existing partner program name remains supported" },
  { key: "commission_type", topHeader: "", detailHeader: "Commission Type", group: "Commission Details", productManagerField: "variant_program_commissions.commission_kind" },
  { key: "commission_value", topHeader: "", detailHeader: "Commission Value", group: "Commission Details", productManagerField: "variant_program_commissions.commission_value" },
  { key: "max_commission", topHeader: "", detailHeader: "Max commission", group: "Commission Details", productManagerField: "variant_program_commissions.max_commission" },

  { key: "seo_title", topHeader: "SEO Details", detailHeader: "SEO Meta Title", group: "SEO Details", productManagerField: "product_families.meta_title" },
  { key: "seo_description", topHeader: "", detailHeader: "SEO Description", group: "SEO Details", productManagerField: "product_families.meta_description" },
  { key: "shipping_days", topHeader: "Shipping Estimated Days", detailHeader: "", group: "Shipping", productManagerField: "product_families.estimated_shipping_days" },
  { key: "warranty", topHeader: "Warranty", detailHeader: "", group: "Warranty", productManagerField: "product_families.warranty" },
  { key: "frequently_bought_category", topHeader: "Frequently Bought Category", detailHeader: "", group: "Frequently Bought Category", productManagerField: "product_families.frequently_bought_category (metadata only; does not auto-select FBT products)" },
];

export function buildProductMasterColumns(variationCount = 3): ProductMasterColumn[] {
  if (!Number.isInteger(variationCount) || variationCount < 1 || variationCount > 20) {
    throw new Error("Variation count must be between 1 and 20.");
  }
  const variationColumns: ColumnSeed[] = [];
  for (let slot = 1; slot <= variationCount; slot += 1) {
    variationColumns.push(
      {
        key: `variation_${slot}_name`,
        topHeader: `Variations ${slot} Name`,
        detailHeader: "",
        group: "Product / Variant",
        productManagerField: `product_variant_axes.label / axis_key (slot ${slot})`,
      },
      {
        key: `variation_${slot}_value`,
        topHeader: `Variation ${slot} Value`,
        detailHeader: "",
        group: "Product / Variant",
        productManagerField: `product_variant_axes.values + product_variants.attributes (slot ${slot})`,
      },
    );
  }

  return [...BEFORE_VARIATIONS, ...variationColumns, ...AFTER_VARIATIONS].map((column, index) => ({
    ...column,
    serial: index + 1,
  }));
}

export function buildProductMasterColumnIndex(columns: ProductMasterColumn[]) {
  return Object.fromEntries(columns.map((column) => [column.key, column.serial - 1])) as Record<ProductMasterColumnKey, number>;
}

/** Backward-compatible supplied Product Master shape: three variation slots = 70 columns. */
export const PRODUCT_MASTER_COLUMNS = buildProductMasterColumns(3);
export const PRODUCT_MASTER_COLUMN_INDEX = buildProductMasterColumnIndex(PRODUCT_MASTER_COLUMNS);
export const PRODUCT_MASTER_TOP_HEADERS = PRODUCT_MASTER_COLUMNS.map((column) => column.topHeader);
export const PRODUCT_MASTER_DETAIL_HEADERS = PRODUCT_MASTER_COLUMNS.map((column) => column.detailHeader);
export const PRODUCT_MASTER_SERIALS = PRODUCT_MASTER_COLUMNS.map((column) => column.serial);

export const bulkColumnValue = (
  values: unknown[],
  key: ProductMasterColumnKey,
  columnIndex: Record<ProductMasterColumnKey, number> = PRODUCT_MASTER_COLUMN_INDEX,
) => values[columnIndex[key]];
