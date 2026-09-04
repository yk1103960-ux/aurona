import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CareerProgram = {
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
  responsibilities: string | null;
  requirements: string | null;
  salary_range: string | null;
  experience: string | null;
  age_criteria: string | null;
  details: string | null;
};

/** Live career listings — the nav dropdown and the careers page share this cache. */
export const careersQuery = queryOptions({
  queryKey: ["career-programs"],
  staleTime: 5 * 60 * 1000,
  queryFn: async (): Promise<CareerProgram[]> => {
    const { data, error } = await supabase
      .from("career_programs")
      .select("id, title, department, location, employment_type, kind, description, eligibility, reward, apply_url, apply_email, closes_at, sort_order, responsibilities, requirements, salary_range, experience, age_criteria, details")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });
    if (error) return [];
    return (data ?? []) as CareerProgram[];
  },
});


export function jobAnchor(id: string) {
  return `job-${id}`;
}

/** A vacancy closes automatically once its last date to apply has passed. */
export function isClosed(job: { closes_at: string | null }): boolean {
  if (!job.closes_at) return false;
  return new Date(job.closes_at).getTime() < Date.now();
}

export function formatCloseDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export function applyHref(job: CareerProgram): string | null {
  if (isClosed(job)) return null;
  if (job.apply_url) return job.apply_url;
  if (job.apply_email) {
    return `mailto:${job.apply_email}?subject=${encodeURIComponent(`Application — ${job.title}`)}`;
  }
  return null;
}
