export const inr = (n: number | string) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(v)) return "₹0";
  return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 0 });
};

export const discountPct = (mrp: number | string, price: number | string) => {
  const m = typeof mrp === "string" ? parseFloat(mrp) : mrp;
  const p = typeof price === "string" ? parseFloat(price) : price;
  if (!m || m <= p) return 0;
  return Math.round(((m - p) / m) * 100);
};
