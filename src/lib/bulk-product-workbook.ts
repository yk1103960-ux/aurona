import * as XLSX from "xlsx";
import { generateVariantSku, variantName, type VariationSelection } from "./sku-generation";
import {
  PRODUCT_MASTER_COLUMNS,
  PRODUCT_MASTER_DETAIL_HEADERS,
  PRODUCT_MASTER_SERIALS,
  PRODUCT_MASTER_TOP_HEADERS,
} from "./bulk-product-columns";

export const BULK_TEMPLATE_VERSION = "aurona-product-master-v1";

export const PRODUCT_MASTER_HEADERS = PRODUCT_MASTER_COLUMNS.map(
  (column) => column.detailHeader || column.topHeader,
);



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

const groupHeader = PRODUCT_MASTER_TOP_HEADERS;
const detailHeader = PRODUCT_MASTER_DETAIL_HEADERS;


export function createBulkProductWorkbook(config: TemplateConfig): ArrayBuffer {
  if (config.variations.length > 3) throw new Error("The supplied template supports up to three variation slots.");
  const rows = config.combinations.map((combination, index) => {
    const attributes = Object.fromEntries(combination.map((item) => [item.name, item.value]));
    const fixed = [
      index + 1, "Create", config.categoryName, config.productName, "", config.mainSku,
      config.brandName || "AURONA", config.unit || "Pc", config.modelName || "",
      variantName(combination), generateVariantSku(config.mainSku, combination), "", "",
    ];
    for (let slot = 0; slot < 3; slot += 1) fixed.push(combination[slot]?.name || "", combination[slot]?.value || "");
    fixed.push(JSON.stringify(attributes));
    return [...fixed, ...Array(PRODUCT_MASTER_COLUMNS.length - fixed.length).fill("")];
  });
  const ws = XLSX.utils.aoa_to_sheet([groupHeader, detailHeader, PRODUCT_MASTER_SERIALS, ...rows]);
  ws["!freeze"] = { xSplit: 0, ySplit: 3 };
  ws["!cols"] = PRODUCT_MASTER_COLUMNS.map((column, index) => {
    const header = column.detailHeader || column.topHeader;
    return { wch: Math.min(28, Math.max(11, header.length * 0.72 + (index < 13 ? 2 : 0))) };
  });
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
  // Keep serial positions strict. Header whitespace is normalized only so
  // previously downloaded Aurona templates (for example a line break versus
  // a space in "Refundable (YES/NO)") remain upload-compatible.
  const normalizeHeader = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
  const topHeader = (matrix[0] ?? []).slice(0, PRODUCT_MASTER_COLUMNS.length).map(normalizeHeader);
  const detailHeader = (matrix[1] ?? []).slice(0, PRODUCT_MASTER_COLUMNS.length).map(normalizeHeader);
  const numericHeader = (matrix[2] ?? []).slice(0, PRODUCT_MASTER_COLUMNS.length).map(String);
  const headerMismatch = PRODUCT_MASTER_COLUMNS.find((column, index) =>
    topHeader[index] !== normalizeHeader(column.topHeader) ||
    detailHeader[index] !== normalizeHeader(column.detailHeader) ||
    numericHeader[index] !== String(column.serial),
  );
  if (
    matrix[0]?.length !== PRODUCT_MASTER_COLUMNS.length ||
    matrix[1]?.length !== PRODUCT_MASTER_COLUMNS.length ||
    matrix[2]?.length !== PRODUCT_MASTER_COLUMNS.length ||
    headerMismatch
  ) {
    const detail = headerMismatch
      ? ` Column ${headerMismatch.serial} must remain "${headerMismatch.detailHeader || headerMismatch.topHeader}".`
      : "";
    throw new Error(`The Product Master column order/header structure does not match the master template.${detail}`);
  }
  const rows = matrix.slice(3).filter((row) => row.some((value) => value !== "" && value != null));
  return { metadata, rows: rows.map((row, index) => ({ excelRow: index + 4, values: row })) };
}
