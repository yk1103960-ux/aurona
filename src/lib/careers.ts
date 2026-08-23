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
  sort_order: number;
};

/** Live career listings — the nav dropdown and the careers page share this cache. */
export const careersQuery = queryOptions({
  queryKey: ["career-programs"],
  staleTime: 5 * 60 * 1000,
  queryFn: async (): Promise<CareerProgram[]> => {
    const { data, error } = await supabase
      .from("career_programs")
      .select("id, title, department, location, employment_type, kind, description, eligibility, reward, apply_url, apply_email, sort_order")
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

export function applyHref(job: CareerProgram): string | null {
  if (job.apply_url) return job.apply_url;
  if (job.apply_email) {
    return `mailto:${job.apply_email}?subject=${encodeURIComponent(`Application — ${job.title}`)}`;
  }
  return null;
}
