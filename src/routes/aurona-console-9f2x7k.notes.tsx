import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Plus, Trash2, Pencil, StickyNote } from "lucide-react";

export const Route = createFileRoute("/aurona-console-9f2x7k/notes")({ component: NotesPage });

type Note = { id: number; title: string; body: string; createdAt: string };

function NotesPage() {
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);

  const filtered = useMemo(() => notes.filter((n) => `${n.title} ${n.body}`.toLowerCase().includes(query.toLowerCase())), [notes, query]);
  const save = () => {
    if (!title.trim()) return;
    if (editing) setNotes((x) => x.map((n) => n.id === editing ? { ...n, title: title.trim(), body: body.trim() } : n));
    else setNotes((x) => [{ id: Date.now(), title: title.trim(), body: body.trim(), createdAt: new Date().toLocaleString() }, ...x]);
    setTitle(""); setBody(""); setEditing(null);
  };

  return <div className="space-y-5">
    <div className="flex items-center justify-between"><div><h1 className="text-xl font-semibold">Notes</h1><p className="text-sm text-slate-500">Admin notes and reminders</p></div></div>
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <section className="rounded border bg-white shadow-sm">
        <div className="border-b px-5 py-4 font-semibold">{editing ? "Edit Note" : "Add New Note"}</div>
        <div className="space-y-4 p-5">
          <label className="block text-sm font-medium">Title<input value={title} onChange={(e)=>setTitle(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 font-normal" /></label>
          <label className="block text-sm font-medium">Description<textarea value={body} onChange={(e)=>setBody(e.target.value)} rows={7} className="mt-1 w-full rounded border px-3 py-2 font-normal" /></label>
          <button onClick={save} className="inline-flex items-center gap-2 rounded bg-[#25a36f] px-4 py-2 text-sm font-medium text-white"><Plus className="h-4 w-4" />{editing ? "Update" : "Save"}</button>
        </div>
      </section>
      <section className="rounded border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><span className="font-semibold">All Notes</span><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search" className="rounded border py-2 pl-9 pr-3 text-sm"/></div></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">#</th><th className="px-5 py-3">Title</th><th className="px-5 py-3">Description</th><th className="px-5 py-3">Created</th><th className="px-5 py-3 text-right">Options</th></tr></thead><tbody>{filtered.length === 0 ? <tr><td colSpan={5} className="px-5 py-14 text-center text-slate-400"><StickyNote className="mx-auto mb-2 h-8 w-8"/>No notes found</td></tr> : filtered.map((n,i)=><tr key={n.id} className="border-t"><td className="px-5 py-3">{i+1}</td><td className="px-5 py-3 font-medium">{n.title}</td><td className="max-w-md truncate px-5 py-3 text-slate-600">{n.body}</td><td className="px-5 py-3 text-slate-500">{n.createdAt}</td><td className="px-5 py-3"><div className="flex justify-end gap-2"><button onClick={()=>{setEditing(n.id);setTitle(n.title);setBody(n.body)}} className="rounded bg-sky-50 p-2 text-sky-600"><Pencil className="h-4 w-4"/></button><button onClick={()=>setNotes(x=>x.filter(v=>v.id!==n.id))} className="rounded bg-red-50 p-2 text-red-600"><Trash2 className="h-4 w-4"/></button></div></td></tr>)}</tbody></table></div>
      </section>
    </div>
  </div>;
}
