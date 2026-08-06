import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Store, Building2, ShieldCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Aurona" }] }),
  component: AuthPage,
});

type Role = "customer" | "retailer" | "distributor";

const ROLES: { id: Role; title: string; icon: any; blurb: string; accent: string }[] = [
  { id: "customer", title: "Customer", icon: User, blurb: "Shop retail prices, add to cart & buy now.", accent: "from-primary/10 to-accent/20" },
  { id: "retailer", title: "Retailer", icon: Store, blurb: "Wholesale pricing, bulk orders, retailer catalogues.", accent: "from-accent/20 to-primary/10" },
  { id: "distributor", title: "Distributor", icon: Building2, blurb: "Enterprise pricing, direct sales channel.", accent: "from-primary/15 to-primary/5" },
];

function AuthPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && user) nav({ to: "/account" }); }, [user, loading, nav]);

  const [role, setRole] = useState<Role>("customer");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [business, setBusiness] = useState("");
  const [busy, setBusy] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 5;
  const OTP_TTL = 600; // 10 minutes

  // Expiry countdown
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const expired = otpSent && secondsLeft === 0;
  const locked = attempts >= MAX_ATTEMPTS;
  const mmss = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    setBusy(false);
    if (result.error) toast.error(result.error.message || "Google sign-in failed");
  };

  const startOtp = () => {
    setOtpSent(true);
    setOtp("");
    setAttempts(0);
    setSecondsLeft(OTP_TTL);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
      else {
        toast.success(`Welcome back — signing in as ${role}`);
        nav({ to: "/account" });
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: name, phone, business_name: business, intended_role: role },
        },
      });
      if (error) toast.error(error.message);
      else {
        startOtp();
        toast.success(`We sent a 6-digit verification code to ${email}`);
      }
    }
    setBusy(false);
  };

  const resend = async () => {
    setBusy(true);
    if (channel === "sms") {
      if (!phone.trim()) {
        setBusy(false);
        return toast.error("Add your mobile number above to receive an SMS code");
      }
      const { error } = await supabase.auth.signInWithOtp({ phone: phone.trim() });
      setBusy(false);
      if (error) return toast.error(error.message || "SMS delivery is unavailable right now");
      startOtp();
      return toast.success(`Code sent by SMS to ${phone}`);
    }
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setBusy(false);
    if (error) return toast.error(error.message);
    startOtp();
    toast.success(`New code sent to ${email}`);
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return toast.error("Too many attempts. Please resend a fresh code.");
    if (expired) return toast.error("This code has expired. Please resend a new one.");
    setBusy(true);
    const token = otp.trim();
    const res =
      channel === "sms"
        ? await supabase.auth.verifyOtp({ phone: phone.trim(), token, type: "sms" })
        : await supabase.auth.verifyOtp({ email, token, type: "email" });
    setBusy(false);
    if (res.error) {
      setAttempts((a) => a + 1);
      const left = MAX_ATTEMPTS - (attempts + 1);
      return toast.error(
        left > 0
          ? `${res.error.message || "Invalid code"} — ${left} attempt${left === 1 ? "" : "s"} left`
          : "Too many invalid attempts. Please resend a new code.",
      );
    }
    if (!res.data.session) {
      // Fall back to a password sign-in so the user lands verified & logged in.
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return toast.error("Verified — please sign in to continue");
    }
    setOtpSent(false);
    setSecondsLeft(0);
    if (role === "customer") toast.success("Email verified — welcome to Aurona!");
    else toast.success(`${role[0].toUpperCase() + role.slice(1)} application submitted — awaiting admin approval.`);
    nav({ to: "/account" });
  };


  const active = ROLES.find((r) => r.id === role)!;

  return (
    <div className="container-x flex min-h-[75vh] items-center justify-center py-10">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.05fr_1fr]">
        {/* Role selector */}
        <div className="space-y-3">
          <div className="text-eyebrow">Choose your account type</div>
          <h1 className="text-display text-3xl sm:text-4xl">Sign in to Aurona</h1>
          <p className="text-sm text-muted-foreground">
            Every role sees pricing tailored to it. Retailers & distributors unlock trade pricing after admin approval.
          </p>
          <div className="mt-4 space-y-3">
            {ROLES.map((r) => {
              const Icon = r.icon;
              const active = role === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  className={cn(
                    "group relative flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all",
                    active
                      ? "border-primary bg-gradient-to-br shadow-sky " + r.accent
                      : "border-border bg-card hover:border-primary/40 hover:shadow-soft",
                  )}
                >
                  <div className={cn(
                    "grid h-12 w-12 shrink-0 place-items-center rounded-full transition",
                    active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold">Sign in as {r.title}</span>
                      {active && <ShieldCheck className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{r.blurb}</div>
                    {r.id !== "customer" && (
                      <div className="mt-1 text-[11px] text-primary/80">Requires admin verification after sign-up</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Auth form */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
          <div className="flex items-center gap-2 rounded-full bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary">
            <active.icon className="h-3.5 w-3.5" /> {active.title} account
          </div>

          <Button onClick={google} disabled={busy} variant="outline" className="mt-5 h-11 w-full gap-2 rounded-full">
            <GoogleIcon /> Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
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
                <Button className="mt-2 h-11 w-full rounded-full" disabled={busy}>
                  {busy ? "Signing in…" : `Sign in as ${active.title}`}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="up" className="pt-4">
              <form onSubmit={submit} className="space-y-3">
                <Field label="Full name" value={name} onChange={setName} />
                <Field label="Phone" value={phone} onChange={setPhone} />
                {role !== "customer" && (
                  <Field label={role === "retailer" ? "Shop / Store name" : "Company / Distribution firm"} value={business} onChange={setBusiness} />
                )}
                <Field label="Email" value={email} onChange={setEmail} type="email" />
                <Field label="Password" value={password} onChange={setPassword} type="password" />
                {role !== "customer" && (
                  <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    Your {role} application will be reviewed by our team. Trade pricing unlocks after approval.
                  </div>
                )}
                <Button className="mt-2 h-11 w-full rounded-full" disabled={busy}>
                  {busy ? "Creating…" : `Create ${active.title} account`}
                </Button>
              </form>
              {otpSent && (
                <form onSubmit={verifyOtp} className="mt-5 space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Verify your email</div>
                  <p className="text-[11px] text-muted-foreground">
                    Enter the 6-digit code we emailed to {email} to activate your account.
                  </p>
                  <Input
                    value={otp}
                    onChange={(ev) => setOtp(ev.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    placeholder="••••••"
                    className="h-11 text-center text-lg tracking-[0.5em]"
                    required
                  />
                  <Button type="submit" className="h-11 w-full rounded-full" disabled={busy || otp.length < 6}>
                    {busy ? "Verifying…" : "Verify & continue"}
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to Aurona's <Link to="/policies/$slug" params={{ slug: "terms" }} className="underline">Terms</Link> and <Link to="/policies/$slug" params={{ slug: "privacy" }} className="underline">Privacy Policy</Link>.
          </p>
        </div>
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
