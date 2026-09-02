import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRealtime } from "@/hooks/useAdmin";
import { adminListCareerApplications, adminUpdateCareerApplication } from "@/lib/careers.functions";

export const Route = createFileRoute("/aurona-console-9f2x7k/careers")({
  component: CareerApplicationsPage,
});

const STATUSES = ["new", "reviewing", "shortlisted", "rejected", "hired"] as const;

const TONE: Record<string, string> = {
  new: "bg-primary/10 text-primary",
  reviewing: "bg-amber-500/15 text-amber-600",
  shortlisted: "bg-emerald-500/15 text-emerald-600",
  rejected: "bg-destructive/10 text-destructive",
  hired: "bg-emerald-600/20 text-emerald-700",
};

type Row = Record<string, any>;

function CareerApplicationsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState<Row | null>(null);

  const list = useServerFn(adminListCareerApplications);
  const update = useServerFn(adminUpdateCareerApplication);

  const q = useQuery({
    queryKey: ["admin-career-applications", search, status],
    queryFn: () => list({ data: { search, status } }),
  });

  useRealtime(
    useMemo(() => ["career_applications"], []),
    () => qc.invalidateQueries({ queryKey: ["admin-career-applications"] }),
  );

  const setStatusFor = useMutation({
    mutationFn: (vars: { id: string; status: (typeof STATUSES)[number] }) => update({ data: vars }),
    onSuccess: () => {
      toast.success("Application updated");
      qc.invalidateQueries({ queryKey: ["admin-career-applications"] });
    },
    onError: () => toast.error("Could not update this application"),
  });

  const rows: Row[] = q.data ?? [];

  function exportCsv() {
    const cols = [
      "created_at",
      "program_title",
      "full_name",
      "email",
      "phone",
      "city",
      "state",
      "qualification",
      "experience",
      "status",
      "resume_url",
    ];
    const csv = [
      cols.join(","),
      ...rows.map((r) => cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `aurona-career-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Career & partnership applications</h1>
          <p className="text-sm text-muted-foreground">
            Every submission from the Careers page, with resumes and live status tracking.
          </p>
        </div>
        <Button variant="outline" className="rounded-full" onClick={exportCsv} disabled={!rows.length}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, email, mobile, program"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading applications…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No applications yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Applicant</th>
                <th className="p-3">Program</th>
                <th className="p-3">Location</th>
                <th className="p-3">Resume</th>
                <th className="p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/70">
                  <td className="p-3">
                    <div className="font-medium">{r.full_name}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                    <div className="text-xs text-muted-foreground">{r.phone}</div>
                  </td>
                  <td className="p-3">
                    <div>{r.program_title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("en-IN")}
                    </div>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {[r.city, r.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="p-3 text-xs">
                    {r.resume_download ? (
                      <a href={r.resume_download} target="_blank" rel="noreferrer" className="text-primary underline">
                        <FileText className="mr-1 inline h-3.5 w-3.5" />
                        Download
                      </a>
                    ) : r.resume_url ? (
                      <a href={r.resume_url} target="_blank" rel="noreferrer" className="text-primary underline">
                        Open link
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3">
                    <Badge className={TONE[r.status] ?? ""} variant="secondary">
                      {r.status}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Select
                        value={r.status}
                        onValueChange={(v) =>
                          setStatusFor.mutate({ id: r.id, status: v as (typeof STATUSES)[number] })
                        }
                      >
                        <SelectTrigger className="h-8 w-[140px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setOpen(r)}>
                        View
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{open?.full_name}</DialogTitle>
          </DialogHeader>
          {open && (
            <dl className="space-y-2 text-sm">
              {[
                ["Program", open.program_title],
                ["Email", open.email],
                ["Mobile", open.phone],
                ["City", open.city],
                ["State", open.state],
                ["Qualification", open.qualification],
                ["Experience", open.experience],
                ["Consent given", open.consent_at ? new Date(open.consent_at).toLocaleString("en-IN") : null],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-4 border-b border-border/60 pb-1">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{v || "—"}</dd>
                </div>
              ))}
              {open.message && (
                <div>
                  <dt className="text-muted-foreground">Message</dt>
                  <dd className="mt-1 whitespace-pre-wrap">{open.message}</dd>
                </div>
              )}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
