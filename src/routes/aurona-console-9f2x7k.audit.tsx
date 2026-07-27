import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listAuditLogs } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollText, Search } from "lucide-react";

export const Route = createFileRoute("/aurona-console-9f2x7k/audit")({
  component: AuditAdmin,
});

function AuditAdmin() {
  const fetchLogs = useServerFn(listAuditLogs);
  const [actor, setActor] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["audit-logs", actor],
    queryFn: () => fetchLogs({ data: { limit: 200, actor: actor || undefined } }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><ScrollText className="w-6 h-6" /> Audit Logs</h1>
        <p className="text-sm text-slate-500">Immutable record of every admin action. Append-only.</p>
      </div>

      <div className="flex gap-2 max-w-md">
        <Input placeholder="Filter by actor email…" value={actor} onChange={(e) => setActor(e.target.value)} />
        <Button variant="outline" onClick={() => refetch()}><Search className="w-4 h-4 mr-1" /> Search</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-[180px_220px_160px_1fr_120px] bg-slate-50 text-xs uppercase tracking-wider text-slate-500 px-4 py-3">
          <div>When</div><div>Actor</div><div>Action</div><div>Entity</div><div></div>
        </div>
        <div className="divide-y max-h-[70vh] overflow-y-auto">
          {isFetching && <div className="p-6 text-center text-slate-500">Loading…</div>}
          {data?.length === 0 && <div className="p-10 text-center text-slate-500">No audit entries.</div>}
          {(data as any[])?.map((r) => (
            <div key={r.id}>
              <div className="grid grid-cols-[180px_220px_160px_1fr_120px] px-4 py-3 text-sm items-center hover:bg-slate-50">
                <div className="text-slate-500 text-xs">{new Date(r.created_at).toLocaleString()}</div>
                <div className="truncate">{r.actor_email || r.actor_user_id?.slice(0,8)}</div>
                <div><code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{r.action}</code></div>
                <div className="truncate text-xs text-slate-600">{r.entity_type ?? "—"} {r.entity_id ? `· ${r.entity_id.slice(0,12)}` : ""}</div>
                <div className="text-right">
                  {(r.before || r.after) && (
                    <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                      {expanded === r.id ? "Hide" : "Details"}
                    </Button>
                  )}
                </div>
              </div>
              {expanded === r.id && (
                <div className="bg-slate-50 px-4 py-3 grid md:grid-cols-2 gap-3 text-xs font-mono">
                  <div><div className="text-slate-500 mb-1">Before</div><pre className="whitespace-pre-wrap">{JSON.stringify(r.before, null, 2) || "—"}</pre></div>
                  <div><div className="text-slate-500 mb-1">After</div><pre className="whitespace-pre-wrap">{JSON.stringify(r.after, null, 2) || "—"}</pre></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
