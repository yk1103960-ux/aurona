import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Edit3, Trash2, Megaphone, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { adminArchiveCmsBlock, adminSaveCmsBlock } from "@/lib/operations-admin.functions";

export const Route = createFileRoute("/aurona-console-9f2x7k/content")({
  component: ContentAdmin,
});

type Block = {
  id: string;
  key: string;
  type: string;
  title: string | null;
  payload: Record<string, any>;
  sort_order: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

const TYPES = [
  {
    value: "hero_slide",
    label: "Hero slider slide",
    fields: ["image", "eyebrow", "title", "italic", "suffix", "copy", "ctaLabel", "ctaTo"],
  },
  { value: "promo_strip", label: "Promo strip", fields: ["text", "ctaLabel", "ctaTo", "tone"] },
  { value: "sales_of_day", label: "Sales of the day", fields: ["title", "subtitle", "endsAt"] },
  { value: "homepage_section", label: "Generic homepage section", fields: ["title", "body"] },
];

function ContentAdmin() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Block> | null>(null);
  const saveBlock = useServerFn(adminSaveCmsBlock);
  const archiveBlock = useServerFn(adminArchiveCmsBlock);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-cms"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cms_blocks")
        .select("*")
        .is("archived_at", null)
        .order("type")
        .order("sort_order");
      if (error) throw error;
      return data as Block[];
    },
  });

  const save = async () => {
    if (!editing?.key || !editing.type) return toast.error("Key and type are required");
    const payload = {
      key: editing.key,
      type: editing.type,
      title: editing.title ?? null,
      payload: editing.payload ?? {},
      sort_order: Number(editing.sort_order ?? 0),
      active: editing.active ?? true,
      starts_at: editing.starts_at || null,
      ends_at: editing.ends_at || null,
      updated_at: new Date().toISOString(),
    };
    try {
      await saveBlock({
        data: {
          ...payload,
          id: editing.id,
          title: payload.title,
          payload: payload.payload as any,
          sort_order: payload.sort_order,
          starts_at: payload.starts_at,
          ends_at: payload.ends_at,
        } as any,
      });
      toast.success("Saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-cms"] });
      qc.invalidateQueries({ queryKey: ["cms-blocks"] });
    } catch (error: any) {
      toast.error(error?.message || "Could not save content");
    }
  };

  const remove = async (id: string) => {
    if (
      !confirm(
        "Archive this block? It will be removed from the storefront but retained in history.",
      )
    )
      return;
    try {
      await archiveBlock({ data: { id } });
      qc.invalidateQueries({ queryKey: ["admin-cms"] });
      qc.invalidateQueries({ queryKey: ["cms-blocks"] });
    } catch (error: any) {
      toast.error(error?.message || "Could not archive block");
    }
  };

  const reorder = async (b: Block, delta: number) => {
    try {
      await saveBlock({
        data: { ...b, sort_order: b.sort_order + delta, payload: b.payload, title: b.title } as any,
      });
      qc.invalidateQueries({ queryKey: ["admin-cms"] });
      qc.invalidateQueries({ queryKey: ["cms-blocks"] });
    } catch (error: any) {
      toast.error(error?.message || "Could not reorder block");
    }
  };

  const grouped = (data ?? []).reduce<Record<string, Block[]>>((m, b) => {
    (m[b.type] ??= []).push(b);
    return m;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Megaphone className="w-6 h-6" /> Content & Banners
          </h1>
          <p className="text-sm text-slate-500">
            Manage hero slides, promo strips and homepage sections. Changes go live immediately.
          </p>
        </div>
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogTrigger asChild>
            <Button
              onClick={() =>
                setEditing({ type: "hero_slide", active: true, sort_order: 0, payload: {} })
              }
            >
              <Plus className="w-4 h-4 mr-1" /> New block
            </Button>
          </DialogTrigger>
          <BlockDialog editing={editing} setEditing={setEditing} save={save} />
        </Dialog>
      </div>

      {isLoading && <div className="p-6 text-center text-slate-500">Loading…</div>}
      {Object.keys(grouped).length === 0 && !isLoading && (
        <div className="bg-white rounded-xl border p-10 text-center text-slate-500">
          No content blocks yet. Add a hero slide or promo strip to override the built-in homepage
          content.
        </div>
      )}
      {Object.entries(grouped).map(([type, blocks]) => (
        <div key={type} className="bg-white rounded-xl border border-slate-200">
          <div className="px-4 py-3 border-b bg-slate-50 font-semibold text-sm capitalize">
            {type.replace(/_/g, " ")}
          </div>
          <div className="divide-y">
            {blocks.map((b) => (
              <div key={b.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => reorder(b, -1)}
                    className="text-slate-400 hover:text-slate-800"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => reorder(b, 1)}
                    className="text-slate-400 hover:text-slate-800"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {b.title || b.key}{" "}
                    <span className="text-xs text-slate-400 font-mono">#{b.sort_order}</span>
                  </div>
                  <div className="text-xs text-slate-500 truncate max-w-2xl">
                    {JSON.stringify(b.payload).slice(0, 120)}
                  </div>
                </div>
                <div className="text-xs">
                  {b.active ? (
                    <span className="text-emerald-600">Live</span>
                  ) : (
                    <span className="text-slate-400">Draft</span>
                  )}
                </div>
                <Button size="icon" variant="ghost" aria-label={`Edit ${b.title || b.key}`} onClick={() => setEditing(b)}>
                  <Edit3 className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="destructive" aria-label={`Delete ${b.title || b.key}`} onClick={() => remove(b.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BlockDialog({
  editing,
  setEditing,
  save,
}: {
  editing: Partial<Block> | null;
  setEditing: (v: Partial<Block> | null) => void;
  save: () => void;
}) {
  if (!editing) return null;
  const typeSpec = TYPES.find((t) => t.value === editing.type);
  const set = (k: keyof Block, v: any) => setEditing({ ...editing, [k]: v });
  const setPayload = (k: string, v: any) =>
    setEditing({ ...editing, payload: { ...(editing.payload ?? {}), [k]: v } });
  return (
    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editing.id ? "Edit block" : "New block"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Key (unique)</Label>
            <Input
              value={editing.key ?? ""}
              onChange={(e) => set("key", e.target.value)}
              placeholder="hero-1"
            />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={editing.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Title (internal)</Label>
          <Input value={editing.title ?? ""} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div>
          <Label>Sort order</Label>
          <Input
            type="number"
            value={editing.sort_order ?? 0}
            onChange={(e) => set("sort_order", e.target.value)}
          />
        </div>
        <div className="border-t pt-3">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Payload fields</div>
          {typeSpec?.fields.map((f) => (
            <div key={f} className="mb-2">
              <Label className="text-xs">{f}</Label>
              {f === "copy" || f === "body" ? (
                <Textarea
                  rows={3}
                  value={editing.payload?.[f] ?? ""}
                  onChange={(e) => setPayload(f, e.target.value)}
                />
              ) : (
                <Input
                  value={editing.payload?.[f] ?? ""}
                  onChange={(e) => setPayload(f, e.target.value)}
                />
              )}
            </div>
          ))}
          <details className="mt-2">
            <summary className="text-xs text-slate-500 cursor-pointer">Raw JSON payload</summary>
            <Textarea
              rows={5}
              className="font-mono text-xs mt-1"
              value={JSON.stringify(editing.payload ?? {}, null, 2)}
              onChange={(e) => {
                try {
                  set("payload", JSON.parse(e.target.value));
                } catch {
                  // Keep the last valid payload while the administrator is still typing JSON.
                }
              }}
            />
          </details>
        </div>
        <label className="flex items-center gap-2">
          <Switch checked={editing.active ?? true} onCheckedChange={(v) => set("active", v)} />{" "}
          Active
        </label>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={() => setEditing(null)}>
          Cancel
        </Button>
        <Button onClick={save}>Save</Button>
      </DialogFooter>
    </DialogContent>
  );
}
