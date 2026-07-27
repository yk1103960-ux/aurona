import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime, useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Trash2, Copy } from "lucide-react";

export const Route = createFileRoute("/aurona-console-9f2x7k/media")({
  component: MediaLibrary,
});

function MediaLibrary() {
  const qc = useQueryClient();
  const { user } = useAdmin();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const q = useQuery({
    queryKey: ["admin-media"],
    queryFn: async () => {
      const { data, error } = await supabase.from("media_assets").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  useRealtime(["media_assets"], () => q.refetch());

  const upload = async (files: FileList | null) => {
    if (!files?.length || !user) return;
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("media").upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) { toast.error(`${file.name}: ${error.message}`); continue; }
      await supabase.from("media_assets").insert({
        path, name: file.name, mime_type: file.type, size_bytes: file.size, uploaded_by: user.id,
      });
      ok++;
    }
    setUploading(false);
    if (ok) toast.success(`Uploaded ${ok} file(s)`);
    qc.invalidateQueries({ queryKey: ["admin-media"] });
  };

  const remove = async (id: string, path: string) => {
    if (!confirm("Delete this file?")) return;
    await supabase.storage.from("media").remove([path]);
    await supabase.from("media_assets").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-media"] });
  };

  const copyUrl = async (path: string) => {
    const { data } = await supabase.storage.from("media").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (!data?.signedUrl) return toast.error("Could not generate URL");
    await navigator.clipboard.writeText(data.signedUrl);
    toast.success("URL copied");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Media Library</h1>
        <div>
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="w-4 h-4 mr-1" /> {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {(q.data ?? []).map((m) => (
          <MediaTile key={m.id} m={m} onDelete={() => remove(m.id, m.path)} onCopy={() => copyUrl(m.path)} />
        ))}
        {q.data?.length === 0 && <div className="col-span-full text-center text-slate-500 py-12">No media yet. Upload to get started.</div>}
      </div>
    </div>
  );
}

function MediaTile({ m, onDelete, onCopy }: { m: { id: string; path: string; name: string; mime_type: string | null }; onDelete: () => void; onCopy: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useQuery({
    queryKey: ["media-url", m.path],
    queryFn: async () => {
      const { data } = await supabase.storage.from("media").createSignedUrl(m.path, 3600);
      setUrl(data?.signedUrl ?? null);
      return data?.signedUrl ?? null;
    },
  });
  const isImg = m.mime_type?.startsWith("image/");
  return (
    <div className="group relative bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="aspect-square bg-slate-100 flex items-center justify-center">
        {isImg && url ? <img src={url} alt={m.name} className="w-full h-full object-cover" loading="lazy" /> : <div className="text-xs text-slate-400 p-2 text-center break-all">{m.name}</div>}
      </div>
      <div className="p-2 text-xs truncate">{m.name}</div>
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition flex gap-1">
        <button onClick={onCopy} className="p-1.5 bg-white/95 hover:bg-white rounded shadow"><Copy className="w-3.5 h-3.5" /></button>
        <button onClick={onDelete} className="p-1.5 bg-white/95 hover:bg-white text-rose-600 rounded shadow"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}
