import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAccountStatus } from "@/lib/auth.functions";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Unverified accounts are never allowed to hold a session anywhere in the app.
    const gate = (s: Session | null) => {
      const u = s?.user;
      if (u && !u.email_confirmed_at && !u.phone_confirmed_at) {
        supabase.auth.signOut();
        setSession(null);
        setUser(null);
        return true;
      }
      return false;
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (gate(s)) return;
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!gate(data.session)) {
        setSession(data.session);
        setUser(data.session?.user ?? null);
      }
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Admin block / account deletion must end the session immediately.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const forceOut = async (reason: string) => {
      if (cancelled) return;
      await supabase.auth.signOut().catch(() => null);
      setSession(null);
      setUser(null);
      toast.error(reason);
    };

    const check = async () => {
      if (cancelled || typeof document === "undefined" || document.visibilityState === "hidden") return;
      try {
        const res = await getAccountStatus();
        if (!res.valid) await forceOut(res.reason ?? "Your access has been revoked.");
      } catch {
        // A rejected status call may simply be a network hiccup — only sign the
        // user out when Auth itself no longer recognises the session.
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) await forceOut("Your access has been revoked. Please contact Aurona support.");
      }
    };

    void check();
    const timer = window.setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [user?.id]);

  return { session, user, loading };
}
