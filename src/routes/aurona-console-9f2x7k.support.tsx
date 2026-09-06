import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  adminListSupportTickets,
  adminUpdateSupportTicket,
} from "@/lib/operations-admin.functions";
import { toast } from "sonner";
import { Inbox, Search } from "lucide-react";

export const Route = createFileRoute("/aurona-console-9f2x7k/support")({ component: SupportAdmin });
function SupportAdmin() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListSupportTickets);
  const updateFn = useServerFn(adminUpdateSupportTicket);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const q = useQuery({ queryKey: ["admin-support"], queryFn: () => listFn() });
  const list = useMemo(
    () =>
      (q.data ?? []).filter(
        (t: any) =>
          (status === "all" || t.status === status) &&
          (!search ||
            `${t.ticket_number} ${t.name} ${t.email} ${t.subject}`
              .toLowerCase()
              .includes(search.toLowerCase())),
      ),
    [q.data, search, status],
  );
  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Inbox className="h-5 w-5" />
          Support inbox
        </h1>
        <p className="text-sm text-slate-500">
          Prioritize, assign and resolve customer enquiries with a permanent reply history.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticket, customer or subject"
          />
        </div>
        <select
          className="h-10 rounded-md border bg-white px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          {["open", "in_progress", "waiting_customer", "resolved", "closed"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      {list.map((ticket: any) => (
        <Ticket
          key={ticket.id}
          ticket={ticket}
          save={async (data: any) => {
            try {
              await updateFn({ data: { id: ticket.id, ...data } });
              toast.success("Ticket updated");
              qc.invalidateQueries({ queryKey: ["admin-support"] });
            } catch (e: any) {
              toast.error(e?.message || "Update failed");
            }
          }}
        />
      ))}
      {!q.isLoading && !list.length && (
        <div className="rounded-xl border border-dashed bg-white p-10 text-center text-slate-500">
          No tickets match this view.
        </div>
      )}
    </div>
  );
}
function Ticket({ ticket, save }: { ticket: any; save: (d: any) => Promise<void> }) {
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <div className="font-semibold">
            {ticket.ticket_number} · {ticket.subject}
          </div>
          <div className="text-xs text-slate-500">
            {ticket.name} · {ticket.email} · {new Date(ticket.created_at).toLocaleString()}
          </div>
          <p className="mt-2 text-sm whitespace-pre-wrap">{ticket.message}</p>
        </div>
        <div className="flex gap-2">
          <select
            className="h-9 rounded border px-2 text-sm"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {["low", "normal", "high", "urgent"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            className="h-9 rounded border px-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["open", "in_progress", "waiting_customer", "resolved", "closed"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
      </div>
      {ticket.support_ticket_replies?.length > 0 && (
        <div className="mt-3 space-y-2 border-t pt-3">
          {ticket.support_ticket_replies.map((r: any) => (
            <div key={r.id} className="rounded bg-slate-50 p-2 text-sm">
              <span className="text-xs font-semibold text-slate-500">
                {r.is_internal ? "Internal note" : "Reply"} ·{" "}
                {new Date(r.created_at).toLocaleString()}
              </span>
              <p className="whitespace-pre-wrap">{r.body}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
        <Textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Reply or add an internal note"
        />
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={internal} onCheckedChange={setInternal} />
            Internal only
          </label>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await save({ status, priority, reply, internal });
              setReply("");
              setBusy(false);
            }}
          >
            {busy ? "Saving…" : "Save update"}
          </Button>
        </div>
      </div>
    </div>
  );
}
