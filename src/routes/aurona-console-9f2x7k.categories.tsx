import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/aurona-console-9f2x7k/categories")({
  component: CategoriesAdmin,
});

type Cat = { id: string; name: string; slug: string; parent_group: string; icon: string | null; sort_order: number };

function CategoriesAdmin() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Cat | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", parent_group: "LED Lightings", icon: "", sort_order: 0 });

  const q = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("parent_group").order("sort_order")).data as Cat[] ?? [],
  });
  useRealtime(["categories"], () => q.refetch());

  const startNew = () => { setEditing(null); setForm({ name: "", slug: "", parent_group: "LED Lightings", icon: "", sort_order: 0 }); };
  const startEdit = (c: Cat) => { setEditing(c); setForm({ name: c.name, slug: c.slug, parent_group: c.parent_group, icon: c.icon ?? "", sort_order: c.sort_order }); };

  const save = async () => {
    if (!form.name) return toast.error("Name required");
    const payload = { ...form, slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") };
    const { error } = editing
      ? await supabase.from("categories").update(payload).eq("id", editing.id)
      : await supabase.from("categories").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    startNew();
    qc.invalidateQueries({ queryKey: ["admin-categories"] });
  };
  const remove = async (id: string) => {
    if (!confirm("Delete category?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-categories"] });
  };

  const grouped = (q.data ?? []).reduce<Record<string, Cat[]>>((m, c) => {
    (m[c.parent_group] ??= []).push(c);
    return m;
  }, {});

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Categories</h1>

      <div className="grid md:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4">
          {Object.entries(grouped).map(([group, cats]) => (
            <div key={group} className="bg-white rounded-xl border border-slate-200">
              <div className="px-4 py-3 border-b border-slate-100 font-semibold text-sm">{group}</div>
              <div className="divide-y">
                {cats.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.slug} • order {c.sort_order}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => startEdit(c)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="destructive" aria-label={`Delete ${c.name}`} onClick={() => remove(c.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 h-fit sticky top-4">
          <div className="font-semibold">{editing ? "Edit Category" : "New Category"}</div>
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <Input placeholder="Parent group (e.g. LED Lightings)" value={form.parent_group} onChange={(e) => setForm({ ...form, parent_group: e.target.value })} />
          <Input placeholder="Icon (emoji or key)" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
          <Input type="number" placeholder="Sort order" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
          <div className="flex gap-2">
            <Button onClick={save} className="flex-1">{editing ? "Update" : <><Plus className="w-4 h-4 mr-1" /> Add</>}</Button>
            {editing && <Button variant="outline" onClick={startNew}>Cancel</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
