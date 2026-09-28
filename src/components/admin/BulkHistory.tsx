import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  adminDeleteBulkHistory,
  adminGetBulkHistory,
  adminListBulkHistory,
  adminSetBulkHistoryArchived,
} from "@/lib/bulk-history.functions";

type HistoryDetail = {
  main_sku: string;
  product_name?: string;
  outcome: "success" | "failed" | "skipped";
  error?: string;
  rows: Array<{ excel_row?: number; variant_sku?: string }>;
  before?: Array<{ variant_sku?: string; family?: Record<string, unknown>; variant?: Record<string, unknown> }>;
  after?: Array<{ variant_sku?: string; family?: Record<string, unknown>; variant?: Record<string, unknown> }>;
};

const fields: Array<[string, "family" | "variant", string]> = [
  ["Product Name", "family", "name"], ["Category ID", "family", "category_id"],
  ["Customer Price", "variant", "price"], ["Customer Stock", "variant", "stock"],
  ["Customer Pack Size", "variant", "pack_size"], ["Retailer Price", "variant", "retailer_price"],
  ["Retailer Stock", "variant", "retailer_stock"], ["Retailer Pack Size", "variant", "retailer_pack_size"],
  ["Distributor Price", "variant", "distributor_price"], ["Distributor Stock", "variant", "distributor_stock"],
  ["Distributor Pack Size", "variant", "distributor_pack_size"], ["MRP", "variant", "mrp"],
  ["Status", "variant", "is_active"], ["Weight", "variant", "weight_g"],
  ["Package Weight", "variant", "pack_weight_g"],
];

function changes(item: HistoryDetail) {
  return (item.after ?? []).flatMap((after) => {
    const before = item.before?.find((entry) => entry.variant_sku === after.variant_sku);
    if (!before) return [];
    return fields.flatMap(([label, entity, field]) => {
      const previous = before[entity]?.[field];
      const next = after[entity]?.[field];
      return JSON.stringify(previous) === JSON.stringify(next)
        ? [] : [`${after.variant_sku ?? "Variant"} · ${label}: ${String(previous ?? "blank")} → ${String(next ?? "blank")}`];
    });
  });
}

function downloadErrors(details: HistoryDetail[], id: string) {
  const cells = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines = ["Excel Row,Product Name,Main SKU,Variant SKU,Reason"];
  for (const detail of details.filter((item) => item.outcome !== "success")) {
    for (const row of detail.rows) {
      lines.push([row.excel_row, detail.product_name, detail.main_sku, row.variant_sku, detail.error]
        .map(cells).join(","));
    }
  }
  if (lines.length === 1) { toast.info("This operation has no failed or skipped rows."); return; }
  const url = URL.createObjectURL(new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `bulk-errors-${id}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BulkHistory() {
  const listFn = useServerFn(adminListBulkHistory);
  const getFn = useServerFn(adminGetBulkHistory);
  const archiveFn = useServerFn(adminSetBulkHistoryArchived);
  const deleteFn = useServerFn(adminDeleteBulkHistory);
  const queryClient = useQueryClient();
  const [archived, setArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const list = useQuery({ queryKey: ["admin-bulk-history"], queryFn: () => listFn(), retry: false });
  const selected = useQuery({
    queryKey: ["admin-bulk-history", selectedId],
    queryFn: () => getFn({ data: { id: selectedId! } }),
    enabled: Boolean(selectedId), retry: false,
  });
  const details = Array.isArray(selected.data?.details) ? selected.data.details as HistoryDetail[] : [];

  const changeHistory = async (id: string, action: "archive" | "restore" | "delete") => {
    if (action === "delete" && !window.confirm("Delete this history record permanently? This will NOT delete or modify any products.")) return;
    setBusy(true);
    try {
      if (action === "delete") await deleteFn({ data: { id } });
      else await archiveFn({ data: { id, archived: action === "archive" } });
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-bulk-history"] });
      toast.success(action === "delete" ? "History record deleted" : action === "archive" ? "History archived" : "History restored");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "History action failed");
    } finally { setBusy(false); }
  };

  return <section className="space-y-4 rounded-xl border bg-white p-5">
    <h2 className="font-semibold">Bulk Import History</h2>
    <div className="flex gap-2">
      <Button type="button" variant={!archived ? "default" : "outline"} onClick={() => setArchived(false)}>Active History</Button>
      <Button type="button" variant={archived ? "default" : "outline"} onClick={() => setArchived(true)}>Archived History</Button>
    </div>
    {list.isError && <p role="alert" className="text-red-700">{list.error instanceof Error ? list.error.message : "History could not be loaded"}</p>}
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-[900px] w-full text-sm">
        <thead className="bg-slate-100"><tr>{["Date & Time", "Action", "File Name", "Category", "Products", "Success", "Failed", "Skipped", "Admin", "Status", "Actions"].map((heading) => <th key={heading} className="p-2 text-left">{heading}</th>)}</tr></thead>
        <tbody>{(list.data ?? []).filter((entry) => Boolean(entry.archived_at) === archived).map((entry) =>
          <tr key={entry.id} className="border-t">
            <td className="p-2">{new Date(entry.created_at).toLocaleString()}</td>
            <td className="p-2">{entry.action}</td><td className="p-2">{entry.file_name}</td>
            <td className="p-2">{entry.category_name || "Multiple"}</td><td className="p-2">{entry.products_processed}</td>
            <td className="p-2">{entry.successful}</td><td className="p-2">{entry.failed}</td><td className="p-2">{entry.skipped}</td>
            <td className="p-2">{entry.actor_email || entry.created_by || "—"}</td><td className="p-2">{entry.status}</td>
            <td className="p-2"><div className="flex flex-wrap gap-1">
              <Button size="sm" variant="outline" onClick={() => setSelectedId(entry.id)}>View Details</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => changeHistory(entry.id, archived ? "restore" : "archive")}>{archived ? "Restore" : "Archive"}</Button>
              {archived && <Button size="sm" variant="destructive" disabled={busy} onClick={() => changeHistory(entry.id, "delete")}>Delete Permanently</Button>}
            </div></td>
          </tr>)}</tbody>
      </table>
    </div>
    {selectedId && <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>Operation details</strong><Button size="sm" variant="outline" onClick={() => setSelectedId(null)}>Close</Button>
      </div>
      {selected.isError && <p role="alert" className="text-red-700">{selected.error instanceof Error ? selected.error.message : "Details could not be loaded"}</p>}
      {selected.data && <>
        <p className="text-sm">{selected.data.action} · {selected.data.file_name} · {selected.data.successful} successful · {selected.data.failed} failed</p>
        <Button type="button" size="sm" variant="outline" onClick={() => downloadErrors(details, selected.data.id)}>Download Error Report</Button>
        {details.map((item) => <div key={item.main_sku} className="rounded border p-3 text-sm">
          <strong>{item.product_name || "Product"} · {item.main_sku}</strong> · {item.outcome}
          <div className="text-xs text-slate-600">SKUs: {item.rows.map((row) => row.variant_sku).filter(Boolean).join(", ")}</div>
          <div className="text-xs text-slate-600">Excel rows: {item.rows.map((row) => row.excel_row).join(", ")}</div>
          {item.error && <p className="text-red-700">{item.error}</p>}
          {changes(item).map((change) => <p key={change} className="text-xs">{change}</p>)}
        </div>)}
      </>}
    </div>}
  </section>;
}
