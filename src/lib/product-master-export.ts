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

export function productMasterExportRows(data: ExportData) {
  const families = data.families;
  const variationCount = families.length
    ? Math.max(1, ...families.map((family) => family.axes.length))
    : 3;
  const columns = buildProductMasterColumns(variationCount);
  const indices = buildProductMasterColumnIndex(columns);
  const rows: Array<Array<string | number>> = [];
  for (const family of families) {
    const axes = [...family.axes].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
    for (const variant of family.variants) {
      const values: Array<string | number> = Array(columns.length).fill("");
      const set = (key: ProductMasterColumnKey, value: unknown) => {
        values[indices[key]] = value == null ? "" : value as string | number;
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
      set("unit", family.unit);
      set("model", family.model);
      set("variant_name", variant.attributes?.variant_label ?? axes.map((axis) => attribute(variant, axis)).filter(Boolean).join(" / "));
      set("variant_sku", variant.sku);
      set("variant_id", variant.id);
      set("barcode", variant.barcode);
      axes.forEach((axis, slot) => {
        set(`variation_${slot + 1}_name`, axis.label);
        set(`variation_${slot + 1}_value`, attribute(variant, axis));
      });
      set("attributes_json", JSON.stringify(variant.attributes ?? {}));
      set("short_description", family.short_description);
      set("description", family.description);
      set("features", Array.isArray(family.features) ? family.features.join("\n") : family.features);
      set("refundable", family.refundable == null ? "" : family.refundable ? "YES" : "NO");
      set("sale_status", family.is_sale ? "Deal" : "For Sale");
      set("active_status", variant.is_active && !variant.archived_at ? "True" : "False");
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
      set("commission_program", commission ? (program?.name ?? "All Variants") : "");
      set("commission_type", commission?.commission_kind);
      set("commission_value", number(commission?.commission_value));
      set("max_commission", number(commission?.max_commission));
      set("seo_title", family.meta_title);
      set("seo_description", family.meta_description);
      set("shipping_days", number(family.estimated_shipping_days));
      set("warranty", family.warranty);
      set("frequently_bought_category", family.frequently_bought_category);
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
    for (let row = 1; row <= 4; row += 1) {
      sheet.getCell(row, index + 1).style = structuredClone(reference.styles[row - 1]) as unknown as ExcelJS.Style;
    }
    sheet.getCell(1, index + 1).value = column.topHeader || null;
    sheet.getCell(2, index + 1).value = column.detailHeader || null;
    sheet.getCell(3, index + 1).value = column.serial;
  });
  templateStyles.rowHeights.forEach((height, i) => { sheet.getRow(i + 1).height = height; });
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
  rows.forEach((values, rowIndex) => {
    const row = sheet.getRow(rowIndex + 4);
    row.height = templateStyles.rowHeights[3];
    values.forEach((value, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      cell.value = value === "" ? null : value;
      cell.style = structuredClone(sheet.getCell(4, columnIndex + 1).style) as ExcelJS.Style;
    });
  });
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
