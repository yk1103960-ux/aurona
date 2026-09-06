import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  adminArchiveCampaign,
  adminListCampaigns,
  adminSaveCampaign,
} from "@/lib/operations-admin.functions";
import { toast } from "sonner";
import { Megaphone, Plus } from "lucide-react";
export const Route = createFileRoute("/aurona-console-9f2x7k/campaigns")({
  component: CampaignsAdmin,
});
const empty = {
  name: "",
  kind: "flash_deal",
  status: "draft",
  starts_at: "",
  ends_at: "",
  payload: '{\n  "family_skus": [],\n  "headline": ""\n}',
};
const local = (v: string | null) => (v ? new Date(v).toISOString().slice(0, 16) : "");
const iso = (v: string) => (v ? new Date(v).toISOString() : null);
function CampaignsAdmin() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListCampaigns);
  const saveFn = useServerFn(adminSaveCampaign);
  const archiveFn = useServerFn(adminArchiveCampaign);
  const [editing, setEditing] = useState<any>(null);
  const q = useQuery({ queryKey: ["admin-campaigns"], queryFn: () => listFn() });
  const save = async () => {
    try {
      const payload = JSON.parse(editing.payload);
      await saveFn({
        data: {
          id: editing.id,
          name: editing.name,
          kind: editing.kind,
          status: editing.status,
          starts_at: iso(editing.starts_at),
          ends_at: iso(editing.ends_at),
          payload,
        },
      });
      toast.success("Campaign saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
    } catch (e: any) {
      toast.error(e?.message || "Check campaign fields and JSON");
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Megaphone className="h-5 w-5" />
            Campaigns
          </h1>
          <p className="text-sm text-slate-500">
            Schedule flash deals, homepage promotions and coupon campaigns.
          </p>
        </div>
        <Button onClick={() => setEditing({ ...empty })}>
          <Plus className="mr-1 h-4 w-4" />
          New campaign
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3 text-left">Campaign</th>
              <th className="p-3 text-left">Window</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(q.data ?? []).map((c: any) => (
              <tr key={c.id}>
                <td className="p-3">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs capitalize text-slate-500">
                    {c.kind.replaceAll("_", " ")}
                  </div>
                </td>
                <td className="p-3 text-xs">
                  {c.starts_at ? new Date(c.starts_at).toLocaleString() : "No start"}
                  <br />
                  {c.ends_at ? new Date(c.ends_at).toLocaleString() : "No end"}
                </td>
                <td className="p-3 capitalize">{c.status}</td>
                <td className="p-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditing({
                        ...c,
                        starts_at: local(c.starts_at),
                        ends_at: local(c.ends_at),
                        payload: JSON.stringify(c.payload ?? {}, null, 2),
                      })
                    }
                  >
                    Edit
                  </Button>{" "}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (confirm("Archive this campaign?")) {
                        await archiveFn({ data: { id: c.id } });
                        qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
                      }
                    }}
                  >
                    Archive
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit campaign" : "New campaign"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <Label>Type</Label>
                  <select
                    className="h-10 w-full rounded border px-2"
                    value={editing.kind}
                    onChange={(e) => setEditing({ ...editing, kind: e.target.value })}
                  >
                    {["flash_deal", "homepage_promotion", "coupon_campaign"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <Label>Status</Label>
                  <select
                    className="h-10 w-full rounded border px-2"
                    value={editing.status}
                    onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                  >
                    {["draft", "scheduled", "active", "paused", "completed"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <Label>Starts</Label>
                  <Input
                    type="datetime-local"
                    value={editing.starts_at}
                    onChange={(e) => setEditing({ ...editing, starts_at: e.target.value })}
                  />
                </label>
                <label>
                  <Label>Ends</Label>
                  <Input
                    type="datetime-local"
                    value={editing.ends_at}
                    onChange={(e) => setEditing({ ...editing, ends_at: e.target.value })}
                  />
                </label>
              </div>
              <div>
                <Label>Campaign payload</Label>
                <Textarea
                  rows={9}
                  className="font-mono text-xs"
                  value={editing.payload}
                  onChange={(e) => setEditing({ ...editing, payload: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
