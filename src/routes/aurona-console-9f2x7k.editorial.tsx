import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/aurona-console-9f2x7k/editorial")({
  component: EditorialAdmin,
});

type Tab = "blogs" | "careers" | "referrals" | "faqs";

const TABS: { key: Tab; label: string }[] = [
  { key: "blogs", label: "Blogs" },
  { key: "careers", label: "Careers" },
  { key: "referrals", label: "Referral programs" },
  { key: "faqs", label: "FAQs" },
];

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function EditorialAdmin() {
  const [tab, setTab] = useState<Tab>("blogs");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Editorial</h1>
        <p className="text-sm text-slate-500">Blogs, career programmes and FAQs — all live on the website immediately.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "rounded-full border px-4 py-1.5 text-sm font-semibold " +
              (tab === t.key ? "border-sky-500 bg-sky-500 text-white" : "border-slate-200 bg-white text-slate-700")
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "blogs" && <BlogsPanel />}
      {tab === "careers" && <CareersPanel />}
      {tab === "referrals" && <ReferralProgramsPanel />}
      {tab === "faqs" && <FaqsPanel />}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">{children}</div>;
}

/* ---------------- Blogs ---------------- */

type Blog = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  cover_url: string | null;
  author: string;
  read_minutes: number;
  body: any;
  published_at: string;
  is_published: boolean;
};

function BlogsPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-blogs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("blog_posts").select("*").order("published_at", { ascending: false });
      if (error) throw error;
      return data as Blog[];
    },
  });
  useRealtime(["blog_posts"], () => qc.invalidateQueries({ queryKey: ["admin-blogs"] }));

  const [draft, setDraft] = useState<Partial<Blog> | null>(null);

  const save = async (row: Partial<Blog>) => {
    if (!row.title?.trim()) return toast.error("Title is required");
    const paragraphs = String((row as any)._bodyText ?? "")
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    const payload: any = {
      slug: row.slug?.trim() || slugify(row.title),
      title: row.title.trim(),
      excerpt: row.excerpt ?? "",
      category: row.category || "Guides",
      cover_url: row.cover_url || null,
      author: row.author || "Aurona Editorial",
      read_minutes: Number(row.read_minutes ?? 4),
      published_at: row.published_at || new Date().toISOString(),
      is_published: row.is_published ?? true,
    };
    if (paragraphs.length) payload.body = { paragraphs };
    else if (row.body) payload.body = row.body;
    else payload.body = { paragraphs: [] };

    const { error } = row.id
      ? await supabase.from("blog_posts").update(payload).eq("id", row.id)
      : await supabase.from("blog_posts").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Blog saved");
    setDraft(null);
    qc.invalidateQueries({ queryKey: ["admin-blogs"] });
    qc.invalidateQueries({ queryKey: ["blogs"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this blog post?")) return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-blogs"] });
  };

  const bodyText = (b: Partial<Blog> | null) =>
    (b as any)?._bodyText ?? (Array.isArray(b?.body?.paragraphs) ? b!.body.paragraphs.join("\n\n") : "");

  return (
    <div className="space-y-4">
      <Button onClick={() => setDraft({ is_published: true })}>
        <Plus className="mr-1 h-4 w-4" /> New blog post
      </Button>

      {draft && (
        <Card>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Title">
              <Input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <Field label="URL slug">
              <Input
                value={draft.slug ?? ""}
                placeholder={draft.title ? slugify(draft.title) : "auto"}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              />
            </Field>
            <Field label="Category">
              <Input value={draft.category ?? ""} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
            </Field>
            <Field label="Author">
              <Input value={draft.author ?? ""} onChange={(e) => setDraft({ ...draft, author: e.target.value })} />
            </Field>
            <Field label="Cover image URL">
              <Input value={draft.cover_url ?? ""} onChange={(e) => setDraft({ ...draft, cover_url: e.target.value })} />
            </Field>
            <Field label="Read minutes">
              <Input
                type="number"
                value={String(draft.read_minutes ?? 4)}
                onChange={(e) => setDraft({ ...draft, read_minutes: Number(e.target.value) })}
              />
            </Field>
            <Field label="Publish date">
              <Input
                type="date"
                value={(draft.published_at ?? new Date().toISOString()).slice(0, 10)}
                onChange={(e) => setDraft({ ...draft, published_at: new Date(e.target.value).toISOString() })}
              />
            </Field>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <Switch
                checked={draft.is_published ?? true}
                onCheckedChange={(v) => setDraft({ ...draft, is_published: v })}
              />
              Published
            </label>
          </div>
          <Field label="Excerpt / meta description">
            <Textarea
              rows={2}
              value={draft.excerpt ?? ""}
              onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
            />
          </Field>
          <Field label="Body (blank line between paragraphs)">
            <Textarea
              rows={8}
              value={bodyText(draft)}
              onChange={(e) => setDraft({ ...draft, _bodyText: e.target.value } as any)}
            />
          </Field>
          <div className="flex gap-2">
            <Button onClick={() => save(draft)}>
              <Save className="mr-1 h-4 w-4" /> Save
            </Button>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="divide-y rounded-xl border border-slate-200 bg-white">
          {(data ?? []).map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{b.title}</div>
                <div className="truncate text-xs text-slate-500">
                  /{b.slug} · {b.category} · {b.is_published ? "Published" : "Draft"}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setDraft({ ...b, _bodyText: bodyText(b) } as any)}>
                Edit
              </Button>
              <Button size="sm" variant="outline" onClick={() => remove(b.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Careers ---------------- */

type Career = {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: string | null;
  kind: string;
  description: string;
  eligibility: string | null;
  reward: string | null;
  apply_url: string | null;
  apply_email: string | null;
  closes_at: string | null;
  sort_order: number;
  is_published: boolean;
};

function CareersPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-careers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("career_programs").select("*").order("sort_order");
      if (error) throw error;
      return data as Career[];
    },
  });
  useRealtime(["career_programs"], () => qc.invalidateQueries({ queryKey: ["admin-careers"] }));
  const [draft, setDraft] = useState<Partial<Career> | null>(null);

  const save = async (row: Partial<Career>) => {
    if (!row.title?.trim()) return toast.error("Title is required");
    const payload = {
      title: row.title.trim(),
      department: row.department || null,
      location: row.location || null,
      employment_type: row.employment_type || null,
      kind: row.kind || "program",
      description: row.description ?? "",
      eligibility: row.eligibility || null,
      reward: row.reward || null,
      apply_url: row.apply_url || null,
      apply_email: row.apply_email || null,
      closes_at: row.closes_at ? new Date(row.closes_at).toISOString() : null,
      sort_order: Number(row.sort_order ?? (data?.length ?? 0) + 1),
      is_published: row.is_published ?? true,
    };
    const { error } = row.id
      ? await supabase.from("career_programs").update(payload).eq("id", row.id)
      : await supabase.from("career_programs").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Programme saved");
    setDraft(null);
    qc.invalidateQueries({ queryKey: ["admin-careers"] });
    qc.invalidateQueries({ queryKey: ["careers"] });
  };

  const move = async (row: Career, dir: -1 | 1) => {
    const { error } = await supabase
      .from("career_programs")
      .update({ sort_order: Math.max(0, row.sort_order + dir) })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-careers"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this programme?")) return;
    const { error } = await supabase.from("career_programs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-careers"] });
  };

  return (
    <div className="space-y-4">
      <Button onClick={() => setDraft({ is_published: true, kind: "program" })}>
        <Plus className="mr-1 h-4 w-4" /> New programme
      </Button>

      {draft && (
        <Card>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Title">
              <Input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <Field label="Kind (program / job / internship)">
              <Input value={draft.kind ?? ""} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} />
            </Field>
            <Field label="Department">
              <Input value={draft.department ?? ""} onChange={(e) => setDraft({ ...draft, department: e.target.value })} />
            </Field>
            <Field label="Location">
              <Input value={draft.location ?? ""} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
            </Field>
            <Field label="Employment type">
              <Input
                value={draft.employment_type ?? ""}
                onChange={(e) => setDraft({ ...draft, employment_type: e.target.value })}
              />
            </Field>
            <Field label="Reward / CTA note">
              <Input value={draft.reward ?? ""} onChange={(e) => setDraft({ ...draft, reward: e.target.value })} />
            </Field>
            <Field label="Apply URL">
              <Input value={draft.apply_url ?? ""} onChange={(e) => setDraft({ ...draft, apply_url: e.target.value })} />
            </Field>
            <Field label="Apply email">
              <Input
                value={draft.apply_email ?? ""}
                onChange={(e) => setDraft({ ...draft, apply_email: e.target.value })}
              />
            </Field>
            <Field label="Last date to apply (auto-closes after this date)">
              <Input
                type="date"
                value={draft.closes_at ? String(draft.closes_at).slice(0, 10) : ""}
                onChange={(e) => setDraft({ ...draft, closes_at: e.target.value || null })}
              />
            </Field>
            <Field label="Sort order">
              <Input
                type="number"
                value={String(draft.sort_order ?? 0)}
                onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
              />
            </Field>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <Switch
                checked={draft.is_published ?? true}
                onCheckedChange={(v) => setDraft({ ...draft, is_published: v })}
              />
              Published
            </label>
          </div>
          <Field label="Description">
            <Textarea
              rows={4}
              value={draft.description ?? ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </Field>
          <Field label="Eligibility">
            <Textarea
              rows={3}
              value={draft.eligibility ?? ""}
              onChange={(e) => setDraft({ ...draft, eligibility: e.target.value })}
            />
          </Field>
          <div className="flex gap-2">
            <Button onClick={() => save(draft)}>
              <Save className="mr-1 h-4 w-4" /> Save
            </Button>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="divide-y rounded-xl border border-slate-200 bg-white">
          {(data ?? []).map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{c.title}</div>
                <div className="truncate text-xs text-slate-500">
                  #{c.sort_order} · {c.kind} · {c.is_published ? "Published" : "Hidden"}
                  {c.closes_at
                    ? ` · ${new Date(c.closes_at).getTime() < Date.now() ? "Closed" : "Closes"} ${new Date(c.closes_at).toLocaleDateString("en-IN")}`
                    : ""}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => move(c, -1)}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => move(c, 1)}>
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDraft(c)}>
                Edit
              </Button>
              <Button size="sm" variant="outline" onClick={() => remove(c.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Referral programs ---------------- */

type ReferralProgram = {
  id: string;
  name: string;
  description: string;
  eligibility: string | null;
  commission_kind: string;
  commission_value: number;
  max_commission: number | null;
  min_order_value: number;
  terms: string | null;
  closes_at: string | null;
  sort_order: number;
  is_active: boolean;
  is_published: boolean;
};

function ReferralProgramsPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-referral-programs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("referral_programs").select("*").order("sort_order");
      if (error) throw error;
      return data as ReferralProgram[];
    },
  });
  useRealtime(["referral_programs"], () => qc.invalidateQueries({ queryKey: ["admin-referral-programs"] }));
  const [draft, setDraft] = useState<Partial<ReferralProgram> | null>(null);

  const save = async (row: Partial<ReferralProgram>) => {
    if (!row.name?.trim()) return toast.error("Name is required");
    const payload = {
      name: row.name.trim(),
      description: row.description ?? "",
      eligibility: row.eligibility || null,
      commission_kind: row.commission_kind || "percentage",
      commission_value: Number(row.commission_value ?? 0),
      max_commission: row.max_commission === null || row.max_commission === undefined || String(row.max_commission) === "" ? null : Number(row.max_commission),
      min_order_value: Number(row.min_order_value ?? 0),
      terms: row.terms || null,
      closes_at: row.closes_at ? new Date(row.closes_at).toISOString() : null,
      sort_order: Number(row.sort_order ?? (data?.length ?? 0) + 1),
      is_active: row.is_active ?? true,
      is_published: row.is_published ?? true,
    };
    const { error } = row.id
      ? await supabase.from("referral_programs").update(payload).eq("id", row.id)
      : await supabase.from("referral_programs").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Referral program saved");
    setDraft(null);
    qc.invalidateQueries({ queryKey: ["admin-referral-programs"] });
    qc.invalidateQueries({ queryKey: ["referral-programs"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this referral program?")) return;
    const { error } = await supabase.from("referral_programs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-referral-programs"] });
  };

  return (
    <div className="space-y-4">
      <Button onClick={() => setDraft({ is_active: true, is_published: true, commission_kind: "percentage" })}>
        <Plus className="mr-1 h-4 w-4" /> New referral program
      </Button>

      {draft && (
        <Card>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Name">
              <Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Commission type (percentage / fixed)">
              <Input
                value={draft.commission_kind ?? ""}
                onChange={(e) => setDraft({ ...draft, commission_kind: e.target.value })}
              />
            </Field>
            <Field label={draft.commission_kind === "fixed" ? "Commission amount (₹)" : "Commission percent (%)"}>
              <Input
                type="number"
                value={String(draft.commission_value ?? 0)}
                onChange={(e) => setDraft({ ...draft, commission_value: Number(e.target.value) })}
              />
            </Field>
            <Field label="Maximum commission per order (₹, blank = no cap)">
              <Input
                type="number"
                value={draft.max_commission === null || draft.max_commission === undefined ? "" : String(draft.max_commission)}
                onChange={(e) => setDraft({ ...draft, max_commission: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label="Minimum order value (₹)">
              <Input
                type="number"
                value={String(draft.min_order_value ?? 0)}
                onChange={(e) => setDraft({ ...draft, min_order_value: Number(e.target.value) })}
              />
            </Field>
            <Field label="Closes on (blank = always open)">
              <Input
                type="date"
                value={draft.closes_at ? String(draft.closes_at).slice(0, 10) : ""}
                onChange={(e) => setDraft({ ...draft, closes_at: e.target.value || null })}
              />
            </Field>
            <Field label="Sort order">
              <Input
                type="number"
                value={String(draft.sort_order ?? 0)}
                onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
              />
            </Field>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <Switch checked={draft.is_active ?? true} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
              Active
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <Switch checked={draft.is_published ?? true} onCheckedChange={(v) => setDraft({ ...draft, is_published: v })} />
              Visible on website
            </label>
          </div>
          <Field label="Description">
            <Textarea
              rows={3}
              value={draft.description ?? ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </Field>
          <Field label="Who can join">
            <Textarea
              rows={2}
              value={draft.eligibility ?? ""}
              onChange={(e) => setDraft({ ...draft, eligibility: e.target.value })}
            />
          </Field>
          <Field label="Terms">
            <Textarea rows={3} value={draft.terms ?? ""} onChange={(e) => setDraft({ ...draft, terms: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <Button onClick={() => save(draft)}>
              <Save className="mr-1 h-4 w-4" /> Save
            </Button>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="divide-y rounded-xl border border-slate-200 bg-white">
          {(data ?? []).length === 0 && <p className="p-3 text-sm text-slate-500">No referral programs yet.</p>}
          {(data ?? []).map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{r.name}</div>
                <div className="truncate text-xs text-slate-500">
                  {r.commission_kind === "fixed" ? `₹${r.commission_value}` : `${r.commission_value}%`}
                  {r.max_commission ? ` (max ₹${r.max_commission})` : ""} · min ₹{r.min_order_value} ·{" "}
                  {r.is_active ? "Active" : "Paused"}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setDraft(r)}>
                Edit
              </Button>
              <Button size="sm" variant="outline" onClick={() => remove(r.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- FAQs ---------------- */

type Faq = {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
  is_published: boolean;
};

function FaqsPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-faqs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("faqs").select("*").order("category").order("sort_order");
      if (error) throw error;
      return data as Faq[];
    },
  });
  useRealtime(["faqs"], () => qc.invalidateQueries({ queryKey: ["admin-faqs"] }));
  const [draft, setDraft] = useState<Partial<Faq> | null>(null);

  const save = async (row: Partial<Faq>) => {
    if (!row.question?.trim() || !row.answer?.trim()) return toast.error("Question and answer are required");
    const payload = {
      question: row.question.trim(),
      answer: row.answer.trim(),
      category: row.category || "General",
      sort_order: Number(row.sort_order ?? (data?.length ?? 0) + 1),
      is_published: row.is_published ?? true,
    };
    const { error } = row.id
      ? await supabase.from("faqs").update(payload).eq("id", row.id)
      : await supabase.from("faqs").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("FAQ saved");
    setDraft(null);
    qc.invalidateQueries({ queryKey: ["admin-faqs"] });
    qc.invalidateQueries({ queryKey: ["faqs"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this FAQ?")) return;
    const { error } = await supabase.from("faqs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-faqs"] });
  };

  return (
    <div className="space-y-4">
      <Button onClick={() => setDraft({ is_published: true })}>
        <Plus className="mr-1 h-4 w-4" /> New FAQ
      </Button>

      {draft && (
        <Card>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Category">
              <Input value={draft.category ?? ""} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
            </Field>
            <Field label="Sort order">
              <Input
                type="number"
                value={String(draft.sort_order ?? 0)}
                onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="Question">
            <Input value={draft.question ?? ""} onChange={(e) => setDraft({ ...draft, question: e.target.value })} />
          </Field>
          <Field label="Answer">
            <Textarea rows={4} value={draft.answer ?? ""} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={draft.is_published ?? true} onCheckedChange={(v) => setDraft({ ...draft, is_published: v })} />
            Published
          </label>
          <div className="flex gap-2">
            <Button onClick={() => save(draft)}>
              <Save className="mr-1 h-4 w-4" /> Save
            </Button>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="divide-y rounded-xl border border-slate-200 bg-white">
          {(data ?? []).map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{f.question}</div>
                <div className="truncate text-xs text-slate-500">
                  {f.category} · {f.is_published ? "Published" : "Hidden"}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setDraft(f)}>
                Edit
              </Button>
              <Button size="sm" variant="outline" onClick={() => remove(f.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-500">{label}</Label>
      {children}
    </div>
  );
}
