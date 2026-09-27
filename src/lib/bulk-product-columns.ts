export const PRODUCT_MASTER_COLUMNS = [
  { serial: 1, key: "sr_no", topHeader: "Sr No", detailHeader: "", group: "Product / Variant", productManagerField: "Import row serial (workflow metadata; not stored)" },
  { serial: 2, key: "function", topHeader: "Function", detailHeader: "", group: "Product / Variant", productManagerField: "Import action: Create / Update (workflow metadata; not stored)" },
  { serial: 3, key: "category_name", topHeader: "Product Category", detailHeader: "", group: "Product / Variant", productManagerField: "categories.name → product_families.category_id" },
  { serial: 4, key: "product_name", topHeader: "Product Name", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.name" },
  { serial: 5, key: "family_id", topHeader: "family_id", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.id (lookup / validation)" },
  { serial: 6, key: "main_sku", topHeader: "Main SKU", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.main_sku" },
  { serial: 7, key: "brand", topHeader: "Brand Name", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.brand" },
  { serial: 8, key: "unit", topHeader: "Unit", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.unit" },
  { serial: 9, key: "model", topHeader: "Model Name", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.model" },
  { serial: 10, key: "variant_name", topHeader: "Variants Name", detailHeader: "", group: "Product / Variant", productManagerField: "product_variants.attributes.variant_label" },
  { serial: 11, key: "variant_sku", topHeader: "Variants SKU", detailHeader: "", group: "Product / Variant", productManagerField: "product_variants.sku" },
  { serial: 12, key: "variant_id", topHeader: "variant_id", detailHeader: "", group: "Product / Variant", productManagerField: "product_variants.id (lookup / validation)" },
  { serial: 13, key: "barcode", topHeader: "barcode", detailHeader: "", group: "Product / Variant", productManagerField: "product_variants.barcode" },
  { serial: 14, key: "variation_1_name", topHeader: "Variations 1 Name", detailHeader: "", group: "Product / Variant", productManagerField: "product_variant_axes.label / axis_key (slot 1)" },
  { serial: 15, key: "variation_1_value", topHeader: "Variation 1 Value", detailHeader: "", group: "Product / Variant", productManagerField: "product_variant_axes.values + product_variants.attributes (slot 1)" },
  { serial: 16, key: "variation_2_name", topHeader: "Variations 2 Name", detailHeader: "", group: "Product / Variant", productManagerField: "product_variant_axes.label / axis_key (slot 2)" },
  { serial: 17, key: "variation_2_value", topHeader: "Variation 2 Value", detailHeader: "", group: "Product / Variant", productManagerField: "product_variant_axes.values + product_variants.attributes (slot 2)" },
  { serial: 18, key: "variation_3_name", topHeader: "Variations 3 Name", detailHeader: "", group: "Product / Variant", productManagerField: "product_variant_axes.label / axis_key (slot 3)" },
  { serial: 19, key: "variation_3_value", topHeader: "Variation 3 Value", detailHeader: "", group: "Product / Variant", productManagerField: "product_variant_axes.values + product_variants.attributes (slot 3)" },
  { serial: 20, key: "attributes_json", topHeader: "attributes_json", detailHeader: "", group: "Product / Variant", productManagerField: "product_variants.attributes (merged JSON)" },
  { serial: 21, key: "short_description", topHeader: "Short Description", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.short_description" },
  { serial: 22, key: "description", topHeader: "Description", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.description" },
  { serial: 23, key: "features", topHeader: "Key Features", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.features" },
  { serial: 24, key: "refundable", topHeader: "Refundable \n(YES/NO)", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.refundable" },
  { serial: 25, key: "sale_status", topHeader: "Status (For Sale/ Deal )", detailHeader: "", group: "Product / Variant", productManagerField: "product_families.is_sale" },
  { serial: 26, key: "active_status", topHeader: "Status (Active-True / Inactive-False)", detailHeader: "", group: "Product / Variant", productManagerField: "product_variants.is_active" },

  { serial: 27, key: "mrp", topHeader: "Single PC Details", detailHeader: "MRP", group: "Single PC Details", productManagerField: "product_variants.mrp" },
  { serial: 28, key: "weight_g", topHeader: "", detailHeader: "Single PC’s Weight", group: "Single PC Details", productManagerField: "product_variants.weight_g" },
  { serial: 29, key: "dim_l", topHeader: "", detailHeader: "Single PC’s Length", group: "Single PC Details", productManagerField: "product_variants.dim_l" },
  { serial: 30, key: "dim_w", topHeader: "", detailHeader: "Single PC’s Width", group: "Single PC Details", productManagerField: "product_variants.dim_w" },
  { serial: 31, key: "dim_h", topHeader: "", detailHeader: "Single PC’s Height", group: "Single PC Details", productManagerField: "product_variants.dim_h" },

  { serial: 32, key: "customer_discount", topHeader: "Details For Customer's", detailHeader: "Customer’s Discount", group: "Customer Details", productManagerField: "product_variants.discount_pct" },
  { serial: 33, key: "customer_price", topHeader: "", detailHeader: "Customer’s Price", group: "Customer Details", productManagerField: "product_variants.price" },
  { serial: 34, key: "customer_moq", topHeader: "", detailHeader: "Customer’s MOQ", group: "Customer Details", productManagerField: "product_variants.moq" },
  { serial: 35, key: "customer_stock", topHeader: "", detailHeader: "Customer’s Stock", group: "Customer Details", productManagerField: "product_variants.stock" },
  { serial: 36, key: "customer_reserved_stock", topHeader: "", detailHeader: "Customer’s Reserved Stock", group: "Customer Details", productManagerField: "product_variants.reserved_stock" },
  { serial: 37, key: "customer_pack_size", topHeader: "", detailHeader: "Customer’s Pack Size", group: "Customer Details", productManagerField: "product_variants.pack_size" },
  { serial: 38, key: "customer_pack_weight_g", topHeader: "", detailHeader: "Customer’s Package’s Weight", group: "Customer Details", productManagerField: "product_variants.pack_weight_g" },
  { serial: 39, key: "customer_pack_l", topHeader: "", detailHeader: "Customer’s Package’s Length", group: "Customer Details", productManagerField: "product_variants.pack_l" },
  { serial: 40, key: "customer_pack_w", topHeader: "", detailHeader: "Customer’s Package’s Width", group: "Customer Details", productManagerField: "product_variants.pack_w" },
  { serial: 41, key: "customer_pack_h", topHeader: "", detailHeader: "Customer’s Package’s Height", group: "Customer Details", productManagerField: "product_variants.pack_h" },

  { serial: 42, key: "retailer_discount", topHeader: "Details for Retailors", detailHeader: "Retailer’s Discount", group: "Retailer Details", productManagerField: "product_variants.retailer_discount_pct" },
  { serial: 43, key: "retailer_price", topHeader: "", detailHeader: "Retailer’s Price", group: "Retailer Details", productManagerField: "product_variants.retailer_price" },
  { serial: 44, key: "retailer_moq", topHeader: "", detailHeader: "Retailer’s MOQ", group: "Retailer Details", productManagerField: "product_variants.retailer_moq" },
  { serial: 45, key: "retailer_stock", topHeader: "", detailHeader: "Retailer’s Stock", group: "Retailer Details", productManagerField: "product_variants.retailer_stock" },
  { serial: 46, key: "retailer_reserved_stock", topHeader: "", detailHeader: "Retailer’s Reserved Stock", group: "Retailer Details", productManagerField: "product_variants.retailer_reserved_stock" },
  { serial: 47, key: "retailer_pack_size", topHeader: "", detailHeader: "Retailer’s Pack Size", group: "Retailer Details", productManagerField: "product_variants.retailer_pack_size" },
  { serial: 48, key: "retailer_pack_weight_g", topHeader: "", detailHeader: "Retailer’s Package’s Weight", group: "Retailer Details", productManagerField: "product_variants.retailer_pack_weight_g" },
  { serial: 49, key: "retailer_pack_l", topHeader: "", detailHeader: "Retailer’s Package’s Length", group: "Retailer Details", productManagerField: "product_variants.retailer_pack_l" },
  { serial: 50, key: "retailer_pack_w", topHeader: "", detailHeader: "Retailer’s Package’s Width", group: "Retailer Details", productManagerField: "product_variants.retailer_pack_w" },
  { serial: 51, key: "retailer_pack_h", topHeader: "", detailHeader: "Retailer’s Package’s Height", group: "Retailer Details", productManagerField: "product_variants.retailer_pack_h" },

  { serial: 52, key: "distributor_discount", topHeader: "Details for Distributors", detailHeader: "Distributor’s Discount", group: "Distributor Details", productManagerField: "product_variants.distributor_discount_pct" },
  { serial: 53, key: "distributor_price", topHeader: "", detailHeader: "Distributor’s Price", group: "Distributor Details", productManagerField: "product_variants.distributor_price" },
  { serial: 54, key: "distributor_moq", topHeader: "", detailHeader: "Distributor’s MOQ", group: "Distributor Details", productManagerField: "product_variants.distributor_moq" },
  { serial: 55, key: "distributor_stock", topHeader: "", detailHeader: "Distributor’s Stock", group: "Distributor Details", productManagerField: "product_variants.distributor_stock" },
  { serial: 56, key: "distributor_reserved_stock", topHeader: "", detailHeader: "Distributor’s Reserved Stock", group: "Distributor Details", productManagerField: "product_variants.distributor_reserved_stock" },
  { serial: 57, key: "distributor_pack_size", topHeader: "", detailHeader: "Distributor’s Pack Size", group: "Distributor Details", productManagerField: "product_variants.distributor_pack_size" },
  { serial: 58, key: "distributor_pack_weight_g", topHeader: "", detailHeader: "Distributor’s Package’s Weight", group: "Distributor Details", productManagerField: "product_variants.distributor_pack_weight_g" },
  { serial: 59, key: "distributor_pack_l", topHeader: "", detailHeader: "Distributor’s Package’s Length", group: "Distributor Details", productManagerField: "product_variants.distributor_pack_l" },
  { serial: 60, key: "distributor_pack_w", topHeader: "", detailHeader: "Distributor’s Package’s Width", group: "Distributor Details", productManagerField: "product_variants.distributor_pack_w" },
  { serial: 61, key: "distributor_pack_h", topHeader: "", detailHeader: "Distributor’s Package’s Height", group: "Distributor Details", productManagerField: "product_variants.distributor_pack_h" },

  { serial: 62, key: "commission_program", topHeader: "Commission Details", detailHeader: "Commission Set on", group: "Commission Details", productManagerField: "Product Manager commission grouping: All Variants / selected variation axis; existing partner program name remains supported" },
  { serial: 63, key: "commission_type", topHeader: "", detailHeader: "Commission Type", group: "Commission Details", productManagerField: "variant_program_commissions.commission_kind" },
  { serial: 64, key: "commission_value", topHeader: "", detailHeader: "Commission Value", group: "Commission Details", productManagerField: "variant_program_commissions.commission_value" },
  { serial: 65, key: "max_commission", topHeader: "", detailHeader: "Max commission", group: "Commission Details", productManagerField: "variant_program_commissions.max_commission" },

  { serial: 66, key: "seo_title", topHeader: "SEO Details", detailHeader: "SEO Meta Title", group: "SEO Details", productManagerField: "product_families.meta_title" },
  { serial: 67, key: "seo_description", topHeader: "", detailHeader: "SEO Description", group: "SEO Details", productManagerField: "product_families.meta_description" },
  { serial: 68, key: "shipping_days", topHeader: "Shipping Estimated Days", detailHeader: "", group: "Shipping", productManagerField: "product_families.estimated_shipping_days" },
  { serial: 69, key: "warranty", topHeader: "Warranty", detailHeader: "", group: "Warranty", productManagerField: "product_families.warranty" },
  { serial: 70, key: "frequently_bought_category", topHeader: "Frequently Bought Category", detailHeader: "", group: "Frequently Bought Category", productManagerField: "product_families.frequently_bought_category (metadata only; does not auto-select FBT products)" },
] as const;

export type ProductMasterColumnKey = (typeof PRODUCT_MASTER_COLUMNS)[number]["key"];

export const PRODUCT_MASTER_COLUMN_INDEX = Object.fromEntries(
  PRODUCT_MASTER_COLUMNS.map((column) => [column.key, column.serial - 1]),
) as Record<ProductMasterColumnKey, number>;

export const PRODUCT_MASTER_TOP_HEADERS = PRODUCT_MASTER_COLUMNS.map((column) => column.topHeader);
export const PRODUCT_MASTER_DETAIL_HEADERS = PRODUCT_MASTER_COLUMNS.map((column) => column.detailHeader);
export const PRODUCT_MASTER_SERIALS = PRODUCT_MASTER_COLUMNS.map((column) => column.serial);

export const bulkColumnValue = (values: unknown[], key: ProductMasterColumnKey) =>
  values[PRODUCT_MASTER_COLUMN_INDEX[key]];
