import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { careersQuery } from "@/lib/careers";
import { submitCareerApplication } from "@/lib/careers.functions";

export const Route = createFileRoute("/partner-program/$id")({
  head: () => ({
    meta: [
      { title: "Partner Program — Aurona Lighting Industries" },
      {
        name: "description",
        content:
          "Details and application form for an Aurona Lighting Industries business partner program — apply online in a few minutes.",
      },
      { property: "og:title", content: "Partner Program — Aurona Lighting Industries" },
      {
        property: "og:description",
        content: "Read the program details and submit your partner application to Aurona Lighting Industries.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PartnerProgramPage,
});

const MAX_RESUME_BYTES = 3 * 1024 * 1024;

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  address: z.string().trim().min(5, "Enter your address").max(500),
});

async function toBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.length; i += 8192) binary += String.fromCharCode(...buf.subarray(i, i + 8192));
  return btoa(binary);
}

function PartnerProgramPage() {
  const { id } = Route.useParams();
  const { data: jobs = [], isLoading } = useQuery(careersQuery);
  const programs = jobs.filter((j) => j.kind !== "job");
  const program = programs.find((p) => p.id === id);

  const [partnerType, setPartnerType] = useState(program?.title ?? "");
  const [resume, setResume] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = useServerFn(submitCareerApplication);

  const selectedType = partnerType || program?.title || "";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const parsed = schema.safeParse({
      full_name: String(fd.get("full_name") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? "").replace(/^\+?91/, ""),
      address: String(fd.get("address") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    if (!selectedType) {
      toast.error("Please choose a partner type");
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
          program_id: /^[0-9a-f-]{36}$/i.test(id) ? id : null,
          program_title: selectedType,
          full_name: v.full_name,
          email: v.email,
          phone: v.phone,
          message: `Address: ${v.address}`,
          consent: true,
          resume_file: resume ? { name: resume.name, type: resume.type, data: await toBase64(resume) } : null,
        },
      });
      toast.success("Application received — our team will get in touch shortly.");
      form.reset();
      setResume(null);
      setConsent(false);
    } catch {
      toast.error("Could not submit your application. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-x py-14">
      <Link to="/careers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to careers
      </Link>

      <div className="text-eyebrow mt-6">Business Partner Program</div>
      <h1 className="text-display mt-3 max-w-3xl text-4xl md:text-5xl">
        {program?.title ?? (isLoading ? "Loading…" : "Partner Program")}
      </h1>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-8">
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">About this program</h2>
            <p className="mt-2 text-sm text-muted-foreground">Program details will be added here soon.</p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Benefits</h2>
            <p className="mt-2 text-sm text-muted-foreground">Program benefits will be added here soon.</p>
          </section>
        </div>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Apply for this program</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Share your details and our partnerships team will get in touch.
          </p>
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Name</Label>
              <Input id="full_name" name="full_name" required maxLength={100} autoComplete="name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required maxLength={255} autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone (+91)</Label>
              <Input id="phone" name="phone" required inputMode="numeric" maxLength={13} placeholder="98XXXXXXXX" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" name="address" required rows={3} maxLength={500} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partner_type">Partner type</Label>
              <Select value={selectedType} onValueChange={setPartnerType}>
                <SelectTrigger id="partner_type">
                  <SelectValue placeholder="Select partner type" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.title}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
              <span>
                I confirm the information above is accurate and allow Aurona Lighting Industries to contact me about
                this application.
              </span>
            </label>
            <Button type="submit" className="w-full rounded-full" disabled={busy}>
              {busy ? "Submitting…" : "Apply Now"}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
