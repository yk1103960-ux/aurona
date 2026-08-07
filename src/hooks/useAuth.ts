import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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

  return { session, user, loading };
}
