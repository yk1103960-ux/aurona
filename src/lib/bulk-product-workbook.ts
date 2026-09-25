import * as XLSX from "xlsx";
import { generateVariantSku, variantName, type VariationSelection } from "./sku-generation";

export const BULK_TEMPLATE_VERSION = "aurona-product-master-v1";

export const PRODUCT_MASTER_HEADERS = [
  "Sr No", "Function", "Product Category", "Product Name", "family_id", "Main SKU", "Brand Name", "Unit", "Model Name",
  "Variants Name", "Variants SKU", "variant_id", "barcode", "Variations 1 Name", "Variation 1 Value",
  "Variations 2 Name", "Variation 2 Value", "Variations 3 Name", "Variation 3 Value", "attributes_json",
  "Short Description", "Description", "Key Features", "Refundable (YES/NO)", "Status (For Sale/ Deal )",
  "Status (Active-True / Inactive-False)", "MRP", "Single PC’s Weight", "Single PC’s Length", "Single PC’s Width", "Single PC’s Height",
  "Customer’s Discount", "Customer’s Price", "Customer’s MOQ", "Customer’s Stock", "Customer’s Reserved Stock", "Customer’s Pack Size",
  "Customer’s Package’s Weight", "Customer’s Package’s Length", "Customer’s Package’s Width", "Customer’s Package’s Height",
  "Retailer’s Discount", "Retailer’s Price", "Retailer’s MOQ", "Retailer’s Stock", "Retailer’s Reserved Stock", "Retailer’s Pack Size",
  "Retailer’s Package’s Weight", "Retailer’s Package’s Length", "Retailer’s Package’s Width", "Retailer’s Package’s Height",
  "Distributor’s Discount", "Distributor’s Price", "Distributor’s MOQ", "Distributor’s Stock", "Distributor’s Reserved Stock", "Distributor’s Pack Size",
  "Distributor’s Package’s Weight", "Distributor’s Package’s Length", "Distributor’s Package’s Width", "Distributor’s Package’s Height",
  "Commission Set on", "Commission Type", "Commission Value", "Max commission", "SEO Meta Title", "SEO Description",
  "Shipping Estimated Days", "Warranty", "Frequently Bought Category",
] as const;

export type TemplateConfig = {
  categoryId: string;
  categoryName: string;
  mainSku: string;
  productName: string;
  brandName?: string;
  unit?: string;
  modelName?: string;
  variations: Array<{ name: string; values: string[] }>;
  combinations: VariationSelection[][];
};

const groupHeader = [
  "Sr No", "Function", "Product Category", "Product Name", "family_id", "Main SKU", "Brand Name", "Unit", "Model Name",
  "Variants Name", "Variants SKU", "variant_id", "barcode", "Variations 1 Name", "Variation 1 Value", "Variations 2 Name",
  "Variation 2 Value", "Variations 3 Name", "Variation 3 Value", "attributes_json", "Short Description", "Description",
  "Key Features", "Refundable (YES/NO)", "Status (For Sale/ Deal )", "Status (Active-True / Inactive-False)",
  "Single PC Details", "", "", "", "", "Details For Customer's", "", "", "", "", "", "", "", "", "",
  "Details for Retailors", "", "", "", "", "", "", "", "", "", "Details for Distributors", "", "", "", "", "", "", "", "", "",
  "Commission Details", "", "", "", "SEO Details", "", "Shipping Estimated Days", "Warranty", "Frequently Bought Category",
];

export function createBulkProductWorkbook(config: TemplateConfig): ArrayBuffer {
  if (config.variations.length > 3) throw new Error("The supplied template supports up to three variation slots.");
  const detailHeader = PRODUCT_MASTER_HEADERS.map((header, index) => index < 26 ? "" : header);
  const rows = config.combinations.map((combination, index) => {
    const attributes = Object.fromEntries(combination.map((item) => [item.name, item.value]));
    const fixed = [
      index + 1, "Create", config.categoryName, config.productName, "", config.mainSku,
      config.brandName || "AURONA", config.unit || "Pc", config.modelName || "",
      variantName(combination), generateVariantSku(config.mainSku, combination), "", "",
    ];
    for (let slot = 0; slot < 3; slot += 1) fixed.push(combination[slot]?.name || "", combination[slot]?.value || "");
    fixed.push(JSON.stringify(attributes));
    return [...fixed, ...Array(PRODUCT_MASTER_HEADERS.length - fixed.length).fill("")];
  });
  const ws = XLSX.utils.aoa_to_sheet([groupHeader, detailHeader, PRODUCT_MASTER_HEADERS.map((_, index) => index + 1), ...rows]);
  ws["!freeze"] = { xSplit: 0, ySplit: 3 };
  ws["!cols"] = PRODUCT_MASTER_HEADERS.map((header, index) => ({ wch: Math.min(28, Math.max(11, header.length * 0.72 + (index < 13 ? 2 : 0))) }));
  ws["!merges"] = [
    ...Array.from({ length: 26 }, (_, i) => ({ s: { r: 0, c: i }, e: { r: 1, c: i } })),
    { s: { r: 0, c: 26 }, e: { r: 0, c: 30 } }, { s: { r: 0, c: 31 }, e: { r: 0, c: 40 } },
    { s: { r: 0, c: 41 }, e: { r: 0, c: 50 } }, { s: { r: 0, c: 51 }, e: { r: 0, c: 60 } },
    { s: { r: 0, c: 61 }, e: { r: 0, c: 64 } }, { s: { r: 0, c: 65 }, e: { r: 0, c: 66 } },
    ...[67, 68, 69].map((c) => ({ s: { r: 0, c }, e: { r: 1, c } })),
  ];
  const metadata = XLSX.utils.aoa_to_sheet([
    ["template_version", BULK_TEMPLATE_VERSION], ["category_id", config.categoryId], ["category_name", config.categoryName],
    ["main_sku", config.mainSku], ["variation_configuration", JSON.stringify(config.variations)],
    ["generated_at", new Date().toISOString()],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Product Master");
  XLSX.utils.book_append_sheet(wb, metadata, "_Aurona_Config");
  wb.Workbook = { Sheets: [{ name: "Product Master" }, { name: "_Aurona_Config", Hidden: 1 }] };
  return XLSX.write(wb, { type: "array", bookType: "xlsx", compression: true });
}

export function parseBulkProductWorkbook(data: ArrayBuffer) {
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const configSheet = wb.Sheets._Aurona_Config;
  const productSheet = wb.Sheets["Product Master"];
  if (!configSheet || !productSheet) throw new Error("This is not an Aurona dynamic product template.");
  const metadataRows = XLSX.utils.sheet_to_json<unknown[]>(configSheet, { header: 1, raw: false });
  const metadata = Object.fromEntries(metadataRows.filter((row) => row[0]).map((row) => [String(row[0]), row[1]]));
  if (metadata.template_version !== BULK_TEMPLATE_VERSION) throw new Error("Wrong or unsupported Aurona template version.");
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(productSheet, { header: 1, defval: "", raw: true });
  const numericHeader = matrix[2]?.map(String);
  if (!numericHeader || numericHeader.length !== PRODUCT_MASTER_HEADERS.length || numericHeader.some((v, i) => v !== String(i + 1))) {
    throw new Error("The Product Master column structure was changed. Download a fresh template.");
  }
  const rows = matrix.slice(3).filter((row) => row.some((value) => value !== "" && value != null));
  return { metadata, rows: rows.map((row, index) => ({ excelRow: index + 4, values: row })) };
}
