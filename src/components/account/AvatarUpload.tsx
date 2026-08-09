import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAvatarUrl } from "@/hooks/useAvatarUrl";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export function AvatarUpload({
  userId,
  avatarPath,
  initials,
}: {
  userId: string;
  avatarPath?: string | null;
  initials: string;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const signed = useAvatarUrl(avatarPath);
  const src = preview ?? signed.data ?? null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["avatar-url"] });
  };

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!ALLOWED.includes(file.type)) throw new Error("Please choose a JPG, PNG or WebP image");
      if (file.size > MAX_BYTES) throw new Error("Image must be smaller than 5 MB");
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
      if (error) throw error;
      if (avatarPath && avatarPath !== path) await supabase.storage.from("avatars").remove([avatarPath]);
      return path;
    },
    onSuccess: () => {
      toast.success("Profile picture updated");
      refresh();
    },
    onError: (e: Error) => {
      setPreview(null);
      toast.error(e.message || "Could not upload picture");
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
      if (error) throw error;
      if (avatarPath) await supabase.storage.from("avatars").remove([avatarPath]);
    },
    onSuccess: () => {
      setPreview(null);
      toast.success("Profile picture removed");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = upload.isPending || remove.isPending;

  return (
    <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-border bg-card p-6">
      <div className="relative">
        <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full border border-border bg-muted text-xl font-bold text-muted-foreground">
          {src ? (
            <img src={src} alt="Your profile picture" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          aria-label="Upload profile picture"
          className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </button>
      </div>

      <div className="min-w-[200px] flex-1">
        <div className="text-sm font-semibold">Profile picture</div>
        <p className="mt-1 text-xs text-muted-foreground">JPG, PNG or WebP — up to 5 MB. Square images look best.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-9 rounded-full px-4 text-xs" disabled={busy} onClick={() => fileRef.current?.click()}>
            {avatarPath ? "Change photo" : "Upload photo"}
          </Button>
          {avatarPath && (
            <Button type="button" variant="ghost" className="h-9 gap-1.5 rounded-full px-4 text-xs text-destructive hover:text-destructive" disabled={busy} onClick={() => remove.mutate()}>
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setPreview(URL.createObjectURL(file));
          upload.mutate(file);
        }}
      />
    </div>
  );
}
