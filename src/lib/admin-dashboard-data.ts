type Page<T> = { data: T[] | null; count: number | null; error: { message: string } | null };

/** PostgREST limits each response. Never present a truncated sample as a total. */
export async function readDashboardPages<T>(
  read: (from: number, to: number) => PromiseLike<Page<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  let expected: number | null = null;
  do {
    const page = await read(rows.length, rows.length + 499);
    if (page.error) throw new Error(page.error.message);
    if (page.count === null) throw new Error("The dashboard count could not be checked. Retry.");
    expected ??= page.count;
    if (page.count !== expected)
      throw new Error("Data changed while loading. Refresh the dashboard.");
    if (expected > 50000)
      throw new Error("This overview is too large to load safely. Use a date-filtered report.");
    const batch = page.data ?? [];
    if (!batch.length && rows.length < expected)
      throw new Error("Incomplete dashboard data. Retry.");
    rows.push(...batch);
  } while (rows.length < expected);
  return rows;
}

export function dashboardOrderSummary(
  orders: { status: string; total: number | string; created_at: string }[],
  now = new Date(),
) {
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1));
    return {
      key: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }),
      value: 0,
    };
  });
  const statuses: Record<string, number> = {};
  let orderValue = 0;
  for (const order of orders) {
    statuses[order.status] = (statuses[order.status] ?? 0) + 1;
    if (order.status === "cancelled") continue;
    const value = Number(order.total);
    if (!Number.isFinite(value))
      throw new Error("An order has an invalid total. Review it before relying on the overview.");
    orderValue += value;
    const month = monthly.find(
      (row) => row.key === new Date(order.created_at).toISOString().slice(0, 7),
    );
    if (month) month.value += value;
  }
  return { orderValue, statuses, monthly };
}
