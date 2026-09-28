import * as XLSX from "xlsx";
import type ExcelJS from "exceljs";
import templateStyles from "./product-master-template-style.json";
import { normalizeMainSku, variantName, type VariationSelection } from "./sku-generation";
import { expectedBulkVariantSku } from "./bulk-product-identity";
import {
  buildProductMasterColumnIndex,
  buildProductMasterColumns,
  PRODUCT_MASTER_COLUMNS,
  type ProductMasterColumn,
  type ProductMasterColumnKey,
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

const LEGACY_COLUMN_WIDTHS = [
  8.88671875, 8.88671875, 15.77734375, 13.21875, 8.77734375, 9.21875, 11.44140625, 4.5546875,
  11.88671875, 26.109375, 20.44140625, 9.44140625, 7.88671875, 11.21875, 10.109375, 16.44140625,
  10, 10.77734375, 10.33203125, 15.44140625, 15.5546875, 10.44140625, 11.6640625, 11.21875,
  14, 13.77734375, 5, 10.88671875, 11.109375, 11.44140625, 10.44140625, 11.44140625, 12.6640625,
  12.88671875, 12.88671875, 11, 11.88671875, 12.109375, 12.109375, 12.109375, 12.33203125,
  8.77734375, 8.88671875, 8.6640625, 8.6640625, 10.6640625, 11.77734375, 11.6640625, 11.5546875,
  12.77734375, 11.44140625, 12.88671875, 14.21875, 14.44140625, 12.5546875, 12.77734375,
  13.33203125, 14.44140625, 14.109375, 16.21875, 13.33203125, 17.21875, 15.88671875, 16.5546875,
  15.21875, 13.33203125, 14.33203125, 15.33203125, 8.88671875, 13.44140625,
] as const;

const LEGACY_WIDTH_BY_KEY = new Map(
  PRODUCT_MASTER_COLUMNS.map((column, index) => [column.key, LEGACY_COLUMN_WIDTHS[index] ?? 12]),
);

function columnWidth(column: ProductMasterColumn) {
  const saved = LEGACY_WIDTH_BY_KEY.get(column.key);
  if (saved) return saved;
  if (/^variation_\d+_name$/.test(column.key)) return 12;
  if (/^variation_\d+_value$/.test(column.key)) return 12;
  return Math.min(28, Math.max(10, (column.detailHeader || column.topHeader).length * 0.72 + 2));
}

const HORIZONTAL_GROUPS = new Set([
  "Single PC Details",
  "Customer Details",
  "Retailer Details",
  "Distributor Details",
  "Commission Details",
  "SEO Details",
]);

function productMasterMerges(columns: ProductMasterColumn[]) {
  const merges: XLSX.Range[] = [];
  let index = 0;
  while (index < columns.length) {
    const column = columns[index];
    if (!HORIZONTAL_GROUPS.has(column.group)) {
      merges.push({ s: { r: 0, c: index }, e: { r: 1, c: index } });
      index += 1;
      continue;
    }
    let end = index;
    while (end + 1 < columns.length && columns[end + 1].group === column.group) end += 1;
    merges.push({ s: { r: 0, c: index }, e: { r: 0, c: end } });
    index = end + 1;
  }
  return merges;
}

function variationCountFromWorkbook(matrix: unknown[][]) {
  const totalColumns = Math.max(
    matrix[0]?.length ?? 0,
    matrix[1]?.length ?? 0,
    matrix[2]?.length ?? 0,
  );
  const count = (totalColumns - 64) / 2;
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error("Could not determine the dynamic variation-column count from this Product Master workbook.");
  }
  // Variation configuration contains the selected axes, while the Product
  // Master always retains all three physical variation column pairs.
  return count;
}

export async function createBulkProductWorkbook(config: TemplateConfig): Promise<Uint8Array> {
  if (!config.variations.length) throw new Error("Select at least one variation before generating Excel.");
  if (config.variations.some((variation) =>
    !variation.name.trim() || !variation.values.some((value) => value.trim())
  ) || config.combinations.some((combination) =>
    combination.length !== config.variations.length ||
    combination.some((selection) => !selection.name.trim() || !selection.value.trim())
  ) || !config.combinations.length) {
    throw new Error("Please add at least one value for this variation.");
  }
  if (config.variations.length > 3) {
    throw new Error("The Product Master template supports up to three variations.");
  }
  const columns = buildProductMasterColumns();
  const columnIndex = buildProductMasterColumnIndex(columns);
  const mainSku = normalizeMainSku(config.mainSku);

  const rows = config.combinations.map((combination, index) => {
    const values = Array(columns.length).fill("");
    const set = (key: ProductMasterColumnKey, value: unknown) => {
      const position = columnIndex[key];
      if (position == null) throw new Error(`Product Master mapping is missing ${key}.`);
      values[position] = value ?? "";
    };
    const attributes = Object.fromEntries(combination.map((item) => [item.name, item.value]));

    set("sr_no", index + 1);
    set("function", "Create");
    set("category_name", config.categoryName);
    set("product_name", config.productName);
    set("main_sku", mainSku);
    set("brand", config.brandName || "AURONA");
    set("unit", config.unit || "Pc");
    set("model", config.modelName || "");
    set("variant_name", variantName(combination));
    set("variant_sku", expectedBulkVariantSku(mainSku, combination));

    combination.forEach((selection, slot) => {
      set(`variation_${slot + 1}_name`, selection.name);
      set(`variation_${slot + 1}_value`, selection.value);
    });

    set("attributes_json", JSON.stringify(attributes));
    return values;
  });

  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Product Master", { views: [{ state: "frozen", ySplit: 3 }] });
  columns.forEach((column, index) => {
    const reference = templateStyles.columns[index];
    ws.getColumn(index + 1).width = reference.width;
    ws.getCell(1, index + 1).value = column.topHeader || null;
    ws.getCell(2, index + 1).value = column.detailHeader || null;
    ws.getCell(3, index + 1).value = column.serial;
  });
  templateStyles.rowHeights.slice(0, 3).forEach((height, index) => {
    if (height !== null) ws.getRow(index + 1).height = height;
  });
  for (const merge of productMasterMerges(columns)) {
    ws.mergeCells(merge.s.r + 1, merge.s.c + 1, merge.e.r + 1, merge.e.c + 1);
  }
  columns.forEach((_, index) => {
    const reference = templateStyles.columns[index];
    for (let row = 1; row <= 3; row += 1) {
      ws.getCell(row, index + 1).style = structuredClone(reference.styles[row - 1]) as Partial<ExcelJS.Style>;
    }
  });
  rows.forEach((values, rowIndex) => {
    const row = ws.getRow(rowIndex + 4);
    const dataHeight = templateStyles.rowHeights[3];
    if (dataHeight !== null) row.height = dataHeight;
    values.forEach((value, index) => {
      const cell = row.getCell(index + 1);
      cell.value = value === "" ? null : value as string | number;
      cell.style = structuredClone(templateStyles.columns[index].styles[3]) as Partial<ExcelJS.Style>;
    });
  });

  const metadataRows = [
    ["template_version", BULK_TEMPLATE_VERSION],
    ["category_id", config.categoryId],
    ["category_name", config.categoryName],
    ["main_sku", mainSku],
    ["variation_count", 3],
    ["variation_configuration", JSON.stringify(config.variations)],
    ["generated_at", new Date().toISOString()],
  ];
  const metadata = wb.addWorksheet("_Aurona_Config");
  metadataRows.forEach((row) => metadata.addRow(row));
  metadata.state = "hidden";
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

export function parseBulkProductWorkbook(data: ArrayBuffer) {
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const configSheet = wb.Sheets._Aurona_Config;
  const productSheet = wb.Sheets["Product Master"];
  if (!productSheet) throw new Error('Workbook must contain the "Product Master" sheet.');

  const metadataRows = configSheet
    ? XLSX.utils.sheet_to_json<unknown[]>(configSheet, { header: 1, raw: false })
    : [];
  const metadata = Object.fromEntries(
    metadataRows.filter((row) => row[0]).map((row) => [String(row[0]), row[1]]),
  ) as Record<string, unknown>;

  if (metadata.template_version && metadata.template_version !== BULK_TEMPLATE_VERSION) {
    throw new Error("Wrong or unsupported Aurona template version.");
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(productSheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  const variationCount = variationCountFromWorkbook(matrix);
  const columns = buildProductMasterColumns(variationCount);
  const columnIndex = buildProductMasterColumnIndex(columns);
  const normalizeHeader = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

  const topHeader = (matrix[0] ?? []).slice(0, columns.length).map(normalizeHeader);
  const detailHeader = (matrix[1] ?? []).slice(0, columns.length).map(normalizeHeader);
  const numericHeader = (matrix[2] ?? []).slice(0, columns.length).map(String);
  const headerMismatch = columns.find((column, index) =>
    topHeader[index] !== normalizeHeader(column.topHeader) ||
    detailHeader[index] !== normalizeHeader(column.detailHeader) ||
    numericHeader[index] !== String(column.serial),
  );

  if (
    matrix[0]?.length !== columns.length ||
    matrix[1]?.length !== columns.length ||
    matrix[2]?.length !== columns.length ||
    headerMismatch
  ) {
    const detail = headerMismatch
      ? ` Column ${headerMismatch.serial} must remain "${headerMismatch.detailHeader || headerMismatch.topHeader}".`
      : "";
    throw new Error(
      `The Product Master column order/header structure does not match the generated dynamic template.${detail}`,
    );
  }

  const populatedRows = matrix.slice(3)
    .map((row, index) => ({ excelRow: index + 4, values: row.slice(0, columns.length) }))
    .filter(({ values }) => values.some((value) => value !== "" && value != null));
  const rows = populatedRows.map(({ values }) => values);

  metadata.variation_count = variationCount;
  metadata.column_keys = columns.map((column) => column.key);

  if (!metadata.category_name && rows.length) {
    const index = columnIndex.category_name;
    const categories = [...new Set(rows.map((row) => String(row[index] ?? "").trim()).filter(Boolean))];
    if (categories.length === 1) metadata.category_name = categories[0];
  }
  if (!metadata.main_sku && rows.length) {
    const index = columnIndex.main_sku;
    const mainSkus = [...new Set(rows.map((row) => String(row[index] ?? "").trim()).filter(Boolean))];
    if (mainSkus.length === 1) metadata.main_sku = mainSkus[0];
  }
  if (!metadata.variation_configuration && rows.length) {
    const configuration = Array.from({ length: variationCount }, (_, slot) => {
      const nameIndex = columnIndex[`variation_${slot + 1}_name`];
      const valueIndex = columnIndex[`variation_${slot + 1}_value`];
      const names = [...new Set(rows.map((row) => String(row[nameIndex] ?? "").trim()).filter(Boolean))];
      if (names.length > 1) {
        throw new Error(`Variation slot ${slot + 1} contains multiple option names.`);
      }
      const values = [...new Set(rows.map((row) => String(row[valueIndex] ?? "").trim()).filter(Boolean))];
      return names.length ? { name: names[0], values } : null;
    }).filter(Boolean);
    metadata.variation_configuration = configuration;
  }

  return {
    metadata,
    rows: populatedRows,
  };
}
