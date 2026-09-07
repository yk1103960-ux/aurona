import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Minus,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminAdjustInventory, adminListInventory } from "@/lib/catalog-admin.functions";
import { useRealtime } from "@/hooks/useAdmin";

export const Route = createFileRoute("/aurona-console-9f2x7k/inventory")({
  component: InventoryAdmin,
});

type ProductFamily = {
  id: string;
  legacy_product_id: string | null;
  name: string;
  main_sku: string;
  slug: string;
  is_published: boolean;
};

type InventoryRow = {
  id: string;
  family_id: string;
  sku: string;
  attributes: Record<string, string>;
  stock: number;
  reserved_stock: number;
  low_stock_threshold: number;
  is_active: boolean;
  updated_at: string;
  product_families: ProductFamily | ProductFamily[] | null;
};

type InventoryFamily = {
  id: string;
  product: ProductFamily | null;
  variants: InventoryRow[];
  reserved: number;
  available: number;
  lowCount: number;
};

const relation = (row: InventoryRow) =>
  Array.isArray(row.product_families) ? (row.product_families[0] ?? null) : row.product_families;

const optionEntries = (row: InventoryRow) =>
  Object.entries(row.attributes ?? {}).filter(([, value]) => Boolean(value));

function InventoryAdmin() {
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);
  const [editing, setEditing] = useState<InventoryRow | null>(null);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["admin-inventory", search, lowOnly],
    queryFn: () => adminListInventory({ data: { search, lowOnly } }) as Promise<InventoryRow[]>,
  });

  useRealtime(["product_variants", "product_families", "inventory_ledger"], () => {
    void qc.invalidateQueries({ queryKey: ["admin-inventory"] });
  });

  const rows = useMemo(() => q.data ?? [], [q.data]);
  const families = useMemo<InventoryFamily[]>(() => {
    const grouped = new Map<string, InventoryFamily>();
    for (const row of rows) {
      const product = relation(row);
      const current = grouped.get(row.family_id) ?? {
        id: row.family_id,
        product,
        variants: [],
        reserved: 0,
        available: 0,
        lowCount: 0,
      };
      const reserved = Number(row.reserved_stock ?? 0);
      const available = Number(row.stock ?? 0) - reserved;
      current.variants.push(row);
      current.reserved += reserved;
      current.available += available;
      if (available <= Number(row.low_stock_threshold ?? 0)) current.lowCount += 1;
      grouped.set(row.family_id, current);
    }
    return [...grouped.values()].sort((a, b) =>
      (a.product?.name ?? "Product").localeCompare(b.product?.name ?? "Product"),
    );
  }, [rows]);

  useEffect(() => {
    if (families.length && !families.some((family) => family.id === expandedFamily)) {
      setExpandedFamily(families[0].id);
    }
    if (!families.length) setExpandedFamily(null);
  }, [families, expandedFamily]);

  const totalAvailable = families.reduce((sum, family) => sum + family.available, 0);
  const totalReserved = families.reduce((sum, family) => sum + family.reserved, 0);
  const lowCount = rows.filter(
    (row) => Number(row.stock) - Number(row.reserved_stock) <= Number(row.low_stock_threshold),
  ).length;

  const adjust = async () => {
    if (!editing || !delta || reason.trim().length < 3) {
      toast.error("Enter a non-zero quantity and a clear reason");
      return;
    }
    setSaving(true);
    try {
      await adminAdjustInventory({ data: { variantId: editing.id, delta, reason: reason.trim() } });
      toast.success(`Inventory updated for ${editing.sku}`);
      setEditing(null);
      setDelta(0);
      setReason("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-inventory"] }),
        qc.invalidateQueries({ queryKey: ["admin-products"] }),
        qc.invalidateQueries({ queryKey: ["admin-product-variants"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update inventory");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <CircleCheck className="h-3.5 w-3.5" /> Live updates enabled
          </div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight text-slate-950">
            <Boxes className="h-7 w-7 text-sky-600" /> SKU Inventory
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Products are grouped by family. Open a product to manage every real variant and SKU.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button
            variant={lowOnly ? "default" : "outline"}
            onClick={() => setLowOnly((value) => !value)}
          >
            <AlertTriangle className="mr-2 h-4 w-4" /> Low stock {lowCount ? `(${lowCount})` : ""}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Product families"
          value={families.length}
          icon={<Boxes className="h-5 w-5" />}
          tone="sky"
        />
        <Stat
          label="Active SKUs"
          value={rows.filter((row) => row.is_active).length}
          icon={<PackageCheck className="h-5 w-5" />}
          tone="violet"
        />
        <Stat
          label="Available units"
          value={totalAvailable}
          icon={<CircleCheck className="h-5 w-5" />}
          tone="emerald"
        />
        <Stat
          label="Reserved units"
          value={totalReserved}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="amber"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="relative max-w-2xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="h-11 bg-slate-50 pl-9"
            placeholder="Search product, family SKU, variant SKU or option…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {q.isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          Inventory could not be loaded. Check the admin session and required database migration,
          then retry.
        </div>
      )}

      <div className="space-y-3">
        {families.map((family) => {
          const isOpen = expandedFamily === family.id;
          return (
            <section
              key={family.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => setExpandedFamily(isOpen ? null : family.id)}
                  aria-expanded={isOpen}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700">
                    {isOpen ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-950">
                      {family.product?.name ?? "Product family"}
                    </span>
                    <span className="block truncate font-mono text-xs text-slate-500">
                      {family.product?.main_sku ?? family.id}
                    </span>
                  </span>
                </button>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge>
                    {family.variants.length} variant{family.variants.length === 1 ? "" : "s"}
                  </Badge>
                  <Badge className="bg-emerald-50 text-emerald-700">
                    {family.available} available
                  </Badge>
                  {family.lowCount > 0 && (
                    <Badge className="bg-rose-50 text-rose-700">{family.lowCount} low</Badge>
                  )}
                  {!family.product?.is_published && (
                    <Badge className="bg-slate-100 text-slate-600">Hidden</Badge>
                  )}
                </div>
                {family.product?.legacy_product_id && (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      to="/aurona-console-9f2x7k/products/$id"
                      params={{ id: family.product.legacy_product_id }}
                    >
                      <Pencil className="mr-2 h-3.5 w-3.5" /> Edit family
                    </Link>
                  </Button>
                )}
              </div>

              {isOpen && (
                <div className="border-t border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[940px] text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="p-3 pl-5">Variant SKU</th>
                          <th className="p-3">Variant options</th>
                          <th className="p-3 text-right">On hand</th>
                          <th className="p-3 text-right">Reserved</th>
                          <th className="p-3 text-right">Available</th>
                          <th className="p-3 text-right">Alert at</th>
                          <th className="p-3 pr-5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {family.variants.map((row) => {
                          const available = Number(row.stock) - Number(row.reserved_stock);
                          const low = available <= Number(row.low_stock_threshold);
                          const options = optionEntries(row);
                          return (
                            <tr
                              key={row.id}
                              className="border-t border-slate-100 transition hover:bg-sky-50/40"
                            >
                              <td className="p-3 pl-5">
                                <div className="font-mono text-xs font-semibold text-slate-800">
                                  {row.sku}
                                </div>
                                {!row.is_active && (
                                  <span className="mt-1 inline-block text-xs text-slate-400">
                                    Inactive
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                <div className="flex flex-wrap gap-1.5">
                                  {options.length ? (
                                    options.map(([key, value]) => (
                                      <span
                                        key={key}
                                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                                      >
                                        <span className="text-slate-400">{key}:</span> {value}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-slate-400">Default variant</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-right font-semibold">{row.stock}</td>
                              <td className="p-3 text-right text-slate-500">
                                {row.reserved_stock}
                              </td>
                              <td
                                className={`p-3 text-right text-base font-bold ${low ? "text-rose-600" : "text-emerald-700"}`}
                              >
                                {available}
                              </td>
                              <td className="p-3 text-right">{row.low_stock_threshold}</td>
                              <td className="p-3 pr-5 text-right">
                                <Button
                                  size="sm"
                                  variant={low ? "default" : "outline"}
                                  onClick={() => {
                                    setEditing(row);
                                    setDelta(0);
                                    setReason("");
                                  }}
                                >
                                  Adjust stock
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          );
        })}

        {!q.isLoading && !q.isError && families.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Boxes className="mx-auto mb-3 h-9 w-9 text-slate-300" />
            <div className="font-medium text-slate-700">No product variants match this view</div>
            <div className="mt-1 text-sm text-slate-500">
              Try another product name, SKU or option.
            </div>
          </div>
        )}
        {q.isLoading && (
          <div className="rounded-2xl border bg-white p-12 text-center text-sm text-slate-500">
            Loading product families and variants…
          </div>
        )}
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Adjust inventory"
        >
          <div className="w-full max-w-lg space-y-5 rounded-2xl bg-white p-6 shadow-2xl">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-600">
                {relation(editing)?.name ?? "Product"}
              </div>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Adjust {editing.sku}</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {optionEntries(editing).map(([key, value]) => (
                  <Badge key={key}>
                    {key}: {value}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center text-sm">
              <div>
                <div className="text-xs text-slate-500">Current</div>
                <div className="mt-1 text-lg font-bold">{editing.stock}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Change</div>
                <div
                  className={`mt-1 text-lg font-bold ${delta < 0 ? "text-rose-600" : "text-emerald-700"}`}
                >
                  {delta > 0 ? `+${delta}` : delta}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">New total</div>
                <div className="mt-1 text-lg font-bold">{Number(editing.stock) + delta}</div>
              </div>
            </div>
            <div className="grid grid-cols-[44px_1fr_44px] gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => setDelta((value) => value - 1)}
                aria-label="Decrease adjustment"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={delta}
                onChange={(event) => setDelta(Number(event.target.value))}
                className="text-center text-base font-semibold"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => setDelta((value) => value + 1)}
                aria-label="Increase adjustment"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Input
              placeholder="Reason, e.g. stock received or damaged"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <p className="text-xs text-slate-500">
              Each saved adjustment is transactional and recorded in the inventory audit trail.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={adjust} disabled={saving || Number(editing.stock) + delta < 0}>
                {saving ? "Saving…" : "Apply adjustment"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({
  children,
  className = "bg-slate-100 text-slate-700",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`rounded-full px-2.5 py-1 font-medium ${className}`}>{children}</span>;
}

function Stat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: "sky" | "violet" | "emerald" | "amber";
}) {
  const tones = {
    sky: "bg-sky-50 text-sky-700",
    violet: "bg-violet-50 text-violet-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`grid h-11 w-11 place-items-center rounded-xl ${tones[tone]}`}>{icon}</span>
      <div>
        <div className="text-2xl font-bold text-slate-950">{value.toLocaleString("en-IN")}</div>
        <div className="text-xs font-medium text-slate-500">{label}</div>
      </div>
    </div>
  );
}
