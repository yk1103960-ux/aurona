import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  experience: z.string().trim().max(120).optional().or(z.literal("")),
  resume_url: z.string().trim().url("Enter a valid link").max(500).optional().or(z.literal("")),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type ApplyTarget = { id: string; title: string } | null;

export function ApplyDialog({
  target,
  onOpenChange,
}: {
  target: ApplyTarget;
  onOpenChange: (open: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!target) return;
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      full_name: String(fd.get("full_name") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? "").replace(/^\+?91/, ""),
      city: String(fd.get("city") ?? ""),
      experience: String(fd.get("experience") ?? ""),
      resume_url: String(fd.get("resume_url") ?? ""),
      message: String(fd.get("message") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    setBusy(true);
    const { data: session } = await supabase.auth.getUser();
    const v = parsed.data;
    const { error } = await supabase.from("career_applications").insert({
      program_id: target.id,
      program_title: target.title,
      full_name: v.full_name,
      email: v.email,
      phone: `+91${v.phone}`,
      city: v.city || null,
      experience: v.experience || null,
      resume_url: v.resume_url || null,
      message: v.message || null,
      user_id: session.user?.id ?? null,
    });
    setBusy(false);
    if (error) {
      toast.error("Could not submit your application. Please try again.");
      return;
    }
    toast.success("Application received — our team will get in touch shortly.");
    onOpenChange(false);
  }

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply — {target?.title}</DialogTitle>
          <DialogDescription>
            Share your details and our partnerships team will review your application.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" name="full_name" required maxLength={100} autoComplete="name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Mobile (+91)</Label>
              <Input id="phone" name="phone" required inputMode="numeric" maxLength={13} placeholder="98XXXXXXXX" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required maxLength={255} autoComplete="email" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="experience">Experience</Label>
              <Input id="experience" name="experience" maxLength={120} placeholder="e.g. 3 years in lighting sales" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="resume_url">Resume / portfolio link (optional)</Label>
            <Input id="resume_url" name="resume_url" maxLength={500} placeholder="https://…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="message">Why are you a good fit?</Label>
            <Textarea id="message" name="message" rows={4} maxLength={1000} />
          </div>
          <Button type="submit" className="w-full rounded-full" disabled={busy}>
            {busy ? "Submitting…" : "Submit application"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
