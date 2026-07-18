import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Aurona" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && user) nav({ to: "/account" });
  }, [user, loading, nav]);

  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    setBusy(false);
    if (result.error) toast.error(result.error.message || "Google sign-in failed");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
      else { toast.success("Welcome back"); nav({ to: "/" }); }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: name, phone },
        },
      });
      if (error) toast.error(error.message);
      else { toast.success("Account created"); nav({ to: "/" }); }
    }
    setBusy(false);
  };

  return (
    <div className="container-x flex min-h-[70vh] items-center justify-center py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <div className="text-center">
          <h1 className="text-display text-3xl">Welcome to Aurona</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in or create an account to continue.</p>
        </div>

        <Button onClick={google} disabled={busy} variant="outline" className="mt-6 h-11 w-full rounded-full gap-2">
          <GoogleIcon /> Continue with Google
        </Button>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="in">Sign in</TabsTrigger>
            <TabsTrigger value="up">Create account</TabsTrigger>
          </TabsList>
          <TabsContent value="in" className="pt-4">
            <form onSubmit={submit} className="space-y-3">
              <Field label="Email" value={email} onChange={setEmail} type="email" />
              <Field label="Password" value={password} onChange={setPassword} type="password" />
              <Button className="mt-2 h-11 w-full rounded-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
            </form>
          </TabsContent>
          <TabsContent value="up" className="pt-4">
            <form onSubmit={submit} className="space-y-3">
              <Field label="Full name" value={name} onChange={setName} />
              <Field label="Phone" value={phone} onChange={setPhone} />
              <Field label="Email" value={email} onChange={setEmail} type="email" />
              <Field label="Password" value={password} onChange={setPassword} type="password" />
              <Button className="mt-2 h-11 w-full rounded-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to Aurona's Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} required className="mt-1 h-11" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.5h5.9c-.3 1.4-1.1 2.6-2.4 3.4v2.8h3.9c2.3-2.1 3.6-5.2 3.6-8.4z"/>
      <path fill="#34A853" d="M12 23c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3 0-5.6-2-6.5-4.7H1.4v3C3.4 20.5 7.4 23 12 23z"/>
      <path fill="#FBBC05" d="M5.5 13.6C5.3 13 5.2 12.3 5.2 11.7s.1-1.3.3-2v-3H1.4C.5 8.4 0 10 0 11.7s.5 3.3 1.4 4.9l4.1-3z"/>
      <path fill="#EA4335" d="M12 4.6c1.7 0 3.3.6 4.5 1.7l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.5 1.4 6.7l4.1 3C6.4 6.6 9 4.6 12 4.6z"/>
    </svg>
  );
}
