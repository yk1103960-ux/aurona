import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminListReviews, adminModerateReview } from "@/lib/operations-admin.functions";
import { toast } from "sonner";
import { Star } from "lucide-react";
export const Route = createFileRoute("/aurona-console-9f2x7k/reviews")({ component: ReviewsAdmin });
function ReviewsAdmin() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListReviews);
  const moderate = useServerFn(adminModerateReview);
  const [filter, setFilter] = useState("pending");
  const q = useQuery({ queryKey: ["admin-reviews"], queryFn: () => listFn() });
  const rows = (q.data ?? []).filter((r: any) => filter === "all" || r.status === filter);
  const act = async (id: string, status: "published" | "rejected", note = "") => {
    try {
      await moderate({ data: { id, status, note } });
      toast.success(`Review ${status}`);
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    } catch (e: any) {
      toast.error(e?.message || "Moderation failed");
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Review moderation</h1>
          <p className="text-sm text-slate-500">
            Publish verified feedback or reject inappropriate and irrelevant submissions.
          </p>
        </div>
        <select
          className="h-10 rounded border bg-white px-3"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {["pending", "published", "rejected", "all"].map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-3">
        {rows.map((r: any) => (
          <Review key={r.id} review={r} act={act} />
        ))}
      </div>
      {!q.isLoading && !rows.length && (
        <div className="rounded-xl border border-dashed bg-white p-10 text-center text-slate-500">
          No reviews in this queue.
        </div>
      )}
    </div>
  );
}
function Review({
  review: r,
  act,
}: {
  review: any;
  act: (id: string, s: "published" | "rejected", n?: string) => Promise<void>;
}) {
  const [note, setNote] = useState(r.moderation_note ?? "");
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <div className="font-semibold">
            {r.product_families?.name ?? "Product"}{" "}
            <span className="font-mono text-xs text-slate-500">{r.product_families?.main_sku}</span>
          </div>
          <div className="flex text-amber-500">
            {Array.from({ length: r.rating }).map((_: any, i: number) => (
              <Star key={i} className="h-4 w-4 fill-current" />
            ))}
          </div>
        </div>
        <span className="rounded bg-slate-100 px-2 py-1 text-xs capitalize">{r.status}</span>
      </div>
      <div className="mt-2 text-sm font-medium">{r.title}</div>
      <p className="text-sm text-slate-700">{r.body}</p>
      <div className="mt-1 text-xs text-slate-500">
        {r.author_name} · {r.verified_purchase ? "Verified purchase" : "Unverified"} ·{" "}
        {new Date(r.created_at).toLocaleString()}
      </div>
      {r.status === "pending" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            className="max-w-md"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Moderation note (optional)"
          />
          <Button size="sm" variant="success" onClick={() => act(r.id, "published", note)}>
            Publish
          </Button>
          <Button size="sm" variant="destructive" onClick={() => act(r.id, "rejected", note)}>
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
