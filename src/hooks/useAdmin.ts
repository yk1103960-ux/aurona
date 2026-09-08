import { useEffect, useId, useRef, useState } from "react";
import { subscribeAdminChanges, type AdminRealtimeStatus } from "@/lib/admin-realtime";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<{ userId: string; allowed: boolean } | null>(null);
  // Auth emits a fresh User object on session refresh/window focus. Keep the
  // editor mounted while rechecking the same account, but never reuse another
  // account's role decision (including the render before the effect runs).
  const isAdmin = !user ? false : access?.userId === user.id ? access.allowed : null;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setAccess(null);
      return;
    }
    let cancel = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (!cancel) setAccess({ userId: user.id, allowed: !error && !!data });
      } catch {
        // Failed verification still denies access; it must not leave an initial
        // login stuck on the loading gate or produce an unhandled rejection.
        if (!cancel) setAccess({ userId: user.id, allowed: false });
      }
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
