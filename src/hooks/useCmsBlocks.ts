import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCmsBlocks(type: string) {
  return useQuery({
    queryKey: ["cms-blocks", type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cms_blocks")
        .select("id, key, type, title, payload, sort_order, active, starts_at, ends_at")
        .eq("type", type)
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      const now = Date.now();
      return (data ?? []).filter((b) => {
        if (b.starts_at && new Date(b.starts_at).getTime() > now) return false;
        if (b.ends_at && new Date(b.ends_at).getTime() < now) return false;
        return true;
      });
    },
    staleTime: 60_000,
  });
}
