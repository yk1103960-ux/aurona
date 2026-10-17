import ExcelJS from "exceljs";
import {
  buildProductMasterColumns,
  buildProductMasterColumnIndex,
  PRODUCT_MASTER_COLUMNS,
  type ProductMasterColumnKey,
} from "./bulk-product-columns";
import templateStyles from "./product-master-template-style.json";

type RecordData = Record<string, any>;
type ExportFamily = RecordData & { variants: RecordData[]; axes: RecordData[] };
type ExportData = { families: ExportFamily[]; commissions: RecordData[]; programs: RecordData[] };

const number = (value: unknown) => value == null || value === "" ? "" : Number(value);
const attribute = (variant: RecordData, axis: RecordData) =>
  variant.attributes?.[axis.axis_key] ?? variant.attributes?.[axis.label] ?? "";

// Match the editor's derived segment discount without borrowing another buyer's MRP.
const savedDiscount = (variant: RecordData, segment: "customer" | "retailer" | "distributor") => {
  const field = segment === "customer" ? "discount_pct" : `${segment}_discount_pct`;
  if (variant[field] != null && variant[field] !== "") return number(variant[field]);
  const mrp = variant[segment === "customer" ? "mrp" : `${segment}_mrp`];
  const price = variant[segment === "customer" ? "price" : `${segment}_price`];
  if (mrp == null || mrp === "" || price == null || price === "") return "";
  if (!Number.isFinite(Number(mrp)) || !Number.isFinite(Number(price)) || Number(mrp) <= 0 || Number(price) < 0 || Number(price) > Number(mrp)) return "";
  return Number(((Number(mrp) - Number(price)) / Number(mrp) * 100).toFixed(2));
};

export function productMasterExportRows(data: ExportData) {
  const families = data.families.filter((family) => !family.archived_at);
  const columns = buildProductMasterColumns();
  const indices = buildProductMasterColumnIndex(columns);
  const rows: Array<Array<string | number | boolean>> = [];
  for (const family of families) {
    const axes = [...family.axes].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
    const legacy = family.legacy ?? {};
    const variants = family.variants.filter((variant) => variant.id && variant.is_active === true && !variant.archived_at && String(variant.sku ?? "").trim());
    for (const variant of variants) {
      const values: Array<string | number | boolean> = Array(columns.length).fill("");
      const set = (key: ProductMasterColumnKey, value: unknown) => {
        values[indices[key]] = value == null ? "" : value as string | number | boolean;
      };
      const commission = data.commissions.find((item) => item.variant_id === variant.id && item.is_active !== false);
      const program = data.programs.find((item) => item.id === commission?.program_id);
      set("sr_no", rows.length + 1);
      set("function", "Update");
      set("category_name", Array.isArray(family.categories) ? family.categories[0]?.name : family.categories?.name);
      set("product_name", family.name);
      set("family_id", family.id);
      set("main_sku", family.main_sku);
      set("brand", family.brand);
      set("unit", family.unit ?? legacy.unit);
      set("model", family.model ?? legacy.model);
      set("variant_name", variant.attributes?.variant_label ?? axes.map((axis) => attribute(variant, axis)).filter(Boolean).join(" / "));
      set("variant_sku", variant.sku);
      set("variant_id", variant.id || "");
      set("barcode", variant.barcode);
      axes.slice(0, 3).forEach((axis, slot) => {
        set(`variation_${slot + 1}_name`, axis.label);
        set(`variation_${slot + 1}_value`, attribute(variant, axis));
      });
      set("attributes_json", JSON.stringify(variant.attributes ?? {}));
      set("short_description", family.short_description || legacy.short_description);
      set("description", family.description || legacy.description);
      const features = family.features || legacy.features;
      set("features", Array.isArray(features) ? features.join("\n") : features);
      const refundable = family.refundable ?? legacy.refundable;
      set("refundable", refundable == null ? "" : refundable ? "YES" : "NO");
      set("sale_status", (family.is_sale ?? legacy.is_sale) ? "Deal" : "For Sale");
      set("active_status", Boolean(variant.is_active && !variant.archived_at));
      for (const [key, field] of Object.entries({
        mrp: "mrp", weight_g: "weight_g", dim_l: "dim_l", dim_w: "dim_w", dim_h: "dim_h",
        customer_discount: "discount_pct", customer_price: "price", customer_moq: "moq",
        customer_stock: "stock", customer_reserved_stock: "reserved_stock",
        customer_pack_size: "pack_size", customer_pack_weight_g: "pack_weight_g",
        customer_pack_l: "pack_l", customer_pack_w: "pack_w", customer_pack_h: "pack_h",
        retailer_discount: "retailer_discount_pct", retailer_price: "retailer_price",
        retailer_moq: "retailer_moq", retailer_stock: "retailer_stock",
        retailer_reserved_stock: "retailer_reserved_stock", retailer_pack_size: "retailer_pack_size",
        retailer_pack_weight_g: "retailer_pack_weight_g", retailer_pack_l: "retailer_pack_l",
        retailer_pack_w: "retailer_pack_w", retailer_pack_h: "retailer_pack_h",
        distributor_discount: "distributor_discount_pct", distributor_price: "distributor_price",
        distributor_moq: "distributor_moq", distributor_stock: "distributor_stock",
        distributor_reserved_stock: "distributor_reserved_stock", distributor_pack_size: "distributor_pack_size",
        distributor_pack_weight_g: "distributor_pack_weight_g", distributor_pack_l: "distributor_pack_l",
        distributor_pack_w: "distributor_pack_w", distributor_pack_h: "distributor_pack_h",
      })) set(key as ProductMasterColumnKey, number(variant[field]));
      for (const segment of ["customer", "retailer", "distributor"] as const) {
        set(`${segment}_discount`, savedDiscount(variant, segment));
      }
      set("commission_program", commission ? (program?.name ?? "All Variants") : "");
      set("commission_type", commission?.commission_kind
        ? String(commission.commission_kind).replace(/^./, (letter) => letter.toUpperCase())
        : "");
      set("commission_value", number(commission?.commission_value));
      set("max_commission", number(commission?.max_commission));
      set("seo_title", family.meta_title || legacy.meta_title);
      set("seo_description", family.meta_description || legacy.meta_description);
      set("shipping_days", number(family.estimated_shipping_days ?? legacy.estimated_shipping_days));
      set("warranty", family.warranty || legacy.warranty);
      set("frequently_bought_category", family.frequently_bought_category || legacy.frequently_bought_category);
      rows.push(values);
    }
  }
  return { columns, rows };
}

export async function createProductMasterExport(data: ExportData): Promise<Uint8Array> {
  const { columns, rows } = productMasterExportRows(data);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Product Master", {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  const styleByKey = Object.fromEntries(PRODUCT_MASTER_COLUMNS.map((column, index) => [column.key, index]));
  const variationStyle = (key: string) =>
    key.endsWith("_name") ? styleByKey.variation_3_name : styleByKey.variation_3_value;
  columns.forEach((column, index) => {
    const source = styleByKey[column.key] ?? variationStyle(column.key);
    const reference = templateStyles.columns[source];
    sheet.getColumn(index + 1).width = reference.width;
    sheet.getCell(1, index + 1).value = column.topHeader || null;
    sheet.getCell(2, index + 1).value = column.detailHeader || null;
    sheet.getCell(3, index + 1).value = column.serial;
  });
  templateStyles.rowHeights.slice(0, 3).forEach((height, i) => {
    if (height !== null) sheet.getRow(i + 1).height = height;
  });
  let index = 0;
  while (index < columns.length) {
    const group = columns[index].group;
    if (["Single PC Details", "Customer Details", "Retailer Details", "Distributor Details", "Commission Details", "SEO Details"].includes(group)) {
      let end = index;
      while (end + 1 < columns.length && columns[end + 1].group === group) end++;
      sheet.mergeCells(1, index + 1, 1, end + 1);
      index = end + 1;
    } else {
      sheet.mergeCells(1, index + 1, 2, index + 1);
      index++;
    }
  }
  columns.forEach((column, columnIndex) => {
    const source = styleByKey[column.key] ?? variationStyle(column.key);
    const reference = templateStyles.columns[source];
    for (let row = 1; row <= 3; row += 1) {
      sheet.getCell(row, columnIndex + 1).style = structuredClone(reference.styles[row - 1]) as Partial<ExcelJS.Style>;
    }
  });
  rows.forEach((values, rowIndex) => {
    const row = sheet.getRow(rowIndex + 4);
    const dataHeight = templateStyles.rowHeights[3];
    if (dataHeight !== null) row.height = dataHeight;
    values.forEach((value, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      cell.value = value === "" ? null : value;
      const styleKey = columns[columnIndex].key;
      const source = styleByKey[styleKey] ?? variationStyle(styleKey);
      cell.style = structuredClone(templateStyles.columns[source].styles[3]) as Partial<ExcelJS.Style>;
    });
  });
  const segmentSheet = workbook.addWorksheet("Segment Single PC Details");
  segmentSheet.addRow(["variant_id", "Variant SKU", "Buyer Segment", "MRP", "Weight (g)", "Length (cm)", "Width (cm)", "Height (cm)"]);
  segmentSinglePieceRows(data).forEach((row) => segmentSheet.addRow(row));
  segmentSheet.columns.forEach((column) => { column.width = 22; });
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export function segmentSinglePieceRows(data: ExportData) {
  return data.families.filter((family) => !family.archived_at).flatMap((family) =>
    family.variants.filter((variant) => variant.id && variant.is_active === true && !variant.archived_at && String(variant.sku ?? "").trim()).flatMap((variant) =>
      (["customer", "retailer", "distributor"] as const).map((segment) => {
        const prefix = segment === "customer" ? "" : `${segment}_`;
        return [variant.id, variant.sku, segment, ...["mrp", "weight_g", "dim_l", "dim_w", "dim_h"].map((field) => number(variant[`${prefix}${field}`]))];
      }),
    ),
  );
}
