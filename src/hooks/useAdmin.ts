import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    let cancel = false;
    setIsAdmin(null);
    (async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!cancel) setIsAdmin(!error && !!data);
    })();
    return () => {
      cancel = true;
    };
  }, [user, authLoading]);

  return { user, isAdmin, loading: authLoading || (!!user && isAdmin === null) };
}

/** Subscribe to realtime changes for one or more tables. */
export function useRealtime(tables: string[], onChange: () => void) {
  useEffect(() => {
    const channels = tables.map((t) =>
      supabase
        .channel(`admin-${t}`)
        .on("postgres_changes", { event: "*", schema: "public", table: t }, onChange)
        .subscribe(),
    );
    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(",")]);
}
