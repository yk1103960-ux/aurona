import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INDIAN_STATES } from "@/lib/indian-states";
import { submitCareerApplication } from "@/lib/careers.functions";

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  qualification: z.string().trim().max(160).optional().or(z.literal("")),
  experience: z.string().trim().max(160).optional().or(z.literal("")),
  resume_url: z.string().trim().url("Enter a valid link").max(500).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type ApplyTarget = { id: string; title: string } | null;

const MAX_RESUME_BYTES = 3 * 1024 * 1024;

async function toBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.length; i += 8192) {
    binary += String.fromCharCode(...buf.subarray(i, i + 8192));
  }
  return btoa(binary);
}

export function ApplyDialog({
  target,
  onOpenChange,
}: {
  target: ApplyTarget;
  onOpenChange: (open: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState("");
  const [consent, setConsent] = useState(false);
  const [resume, setResume] = useState<File | null>(null);
  const submit = useServerFn(submitCareerApplication);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!target) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const parsed = schema.safeParse({
      full_name: String(fd.get("full_name") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? "").replace(/^\+?91/, ""),
      city: String(fd.get("city") ?? ""),
      state,
      qualification: String(fd.get("qualification") ?? ""),
      experience: String(fd.get("experience") ?? ""),
      resume_url: String(fd.get("resume_url") ?? ""),
      message: String(fd.get("message") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    if (!consent) {
      toast.error("Please accept the declaration to submit your application.");
      return;
    }
    if (resume && resume.size > MAX_RESUME_BYTES) {
      toast.error("Resume must be 3 MB or smaller.");
      return;
    }

    setBusy(true);
    try {
      const v = parsed.data;
      await submit({
        data: {
          program_id: /^[0-9a-f-]{36}$/i.test(target.id) ? target.id : null,
          program_title: target.title,
          full_name: v.full_name,
          email: v.email,
          phone: v.phone,
          city: v.city || null,
          state: v.state || null,
          qualification: v.qualification || null,
          experience: v.experience || null,
          resume_url: v.resume_url || null,
          message: v.message || null,
          consent: true,
          resume_file: resume
            ? { name: resume.name, type: resume.type, data: await toBase64(resume) }
            : null,
        },
      });
      toast.success("Application received — our team will get in touch shortly.");
      form.reset();
      setResume(null);
      setState("");
      setConsent(false);
      onOpenChange(false);
    } catch {
      toast.error("Could not submit your application. Please try again.");
    } finally {
      setBusy(false);
    }
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
        <form onSubmit={onSubmit} className="space-y-4">
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
              <Label htmlFor="state">State</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger id="state">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {INDIAN_STATES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="qualification">Qualification</Label>
              <Input id="qualification" name="qualification" maxLength={160} placeholder="e.g. B.Com, Diploma" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="experience">Experience</Label>
              <Input id="experience" name="experience" maxLength={160} placeholder="e.g. 3 years in lighting sales" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="resume_file">Upload resume (PDF/DOC, max 3 MB)</Label>
            <Input
              id="resume_file"
              name="resume_file"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setResume(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="resume_url">Or paste a resume / portfolio link</Label>
            <Input id="resume_url" name="resume_url" maxLength={500} placeholder="https://…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="message">Why are you a good fit?</Label>
            <Textarea id="message" name="message" rows={4} maxLength={2000} />
          </div>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
            <span>
              I confirm the information above is accurate and allow Aurona Lighting Industries to contact me about
              this application.
            </span>
          </label>
          <Button type="submit" className="w-full rounded-full" disabled={busy}>
            {busy ? "Submitting…" : "Submit application"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
