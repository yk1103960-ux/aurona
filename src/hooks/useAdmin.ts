import { useEffect, useId, useRef, useState } from "react";
import { subscribeAdminChanges, type AdminRealtimeStatus } from "@/lib/admin-realtime";
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
  const ownerId = useId();
  const latest = useRef(onChange);
  const [status, setStatus] = useState<AdminRealtimeStatus>("connecting");
  useEffect(() => {
    latest.current = onChange;
  }, [onChange]);
  const tableKey = [...new Set(tables)].sort().join(",");
  useEffect(() => {
    if (!tableKey) return;
    return subscribeAdminChanges(
      supabase,
      tableKey.split(","),
      () => latest.current(),
      setStatus,
      ownerId,
    );
  }, [tableKey, ownerId]);
  return status;
}
