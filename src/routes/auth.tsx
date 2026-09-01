import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Store, Building2, ShieldCheck, Info, Check, X, Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { assessPassword } from "@/lib/auth-security";
import { roleEmail } from "@/lib/role-identity";
import { useMyRole } from "@/lib/pricing";
import { dashboardPathFor, dashboardRoleOf, DASHBOARD_PATHS, roleLabel, useAccessState } from "@/lib/role-routing";
import { validateEmail } from "@/lib/email-validation";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  validateRegistration,
  loginGuard,
  recordLoginAttempt,
  registerSession,
  getAuthPolicy,
} from "@/lib/auth.functions";
import {
  sendSignupSmsOtp,
  verifySignupSmsOtp,
  sendLoginSmsOtp,
  verifyLoginSmsOtp,
} from "@/lib/otp.functions";


export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => {
    const r = search['role'];
    const role = r === "retailer" || r === "distributor" || r === "customer" ? r : undefined;
    return role ? { role } : {};
  },
  head: () => ({
    meta: [
      { title: "Sign in or create your Aurona account" },
      { name: "description", content: "Secure Aurona sign-in with OTP verification, verified-email checks and trade pricing for retailers and distributors." },
      { property: "og:title", content: "Sign in or create your Aurona account" },
      { property: "og:description", content: "Secure Aurona sign-in with OTP verification and role-based trade pricing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Role = "customer" | "retailer" | "distributor";

const ROLES: { id: Role; title: string; icon: any; blurb: string; accent: string }[] = [
  { id: "customer", title: "Customer", icon: User, blurb: "Shop retail prices, add to cart & buy now.", accent: "from-primary/10 to-accent/20" },
  { id: "retailer", title: "Retailer", icon: Store, blurb: "Wholesale pricing, bulk orders, retailer catalogues.", accent: "from-accent/20 to-primary/10" },
  { id: "distributor", title: "Distributor", icon: Building2, blurb: "Enterprise pricing, direct sales channel.", accent: "from-primary/15 to-primary/5" },
];

const REMEMBER_KEY = "aurona.remember";
const SESSION_MARK = "aurona.session";

function deviceLabel() {
  if (typeof navigator === "undefined") return "Unknown device";
  return navigator.userAgent.slice(0, 240);
}

function AuthPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const search = Route.useSearch() as { role?: Role };
  const sessionRole = useMyRole();
  const qc = useQueryClient();
  const [role, setRoleState] = useState<Role>(search.role ?? "customer");

  const setRole = (next: Role) => {
    setRoleState(next);
    setErrors({});
    nav({ to: "/auth", search: { role: next }, replace: true });
  };

  useEffect(() => {
    if (search.role && search.role !== role) setRoleState(search.role);
  }, [search.role]);

  // The account type the current session actually belongs to (server-verified).
  const access = useAccessState();
  const activeSessionRole = user ? access.activeRole : null;
  // Partner areas are never entered from a plain session — the application gate decides.
  const roleConflict = Boolean(role === "customer" && activeSessionRole && activeSessionRole !== "customer");

  // Hard gate: an unverified session can never reach the site. Retailer and
  // distributor selections always pass through the application/approval gate.
  useEffect(() => {
    if (loading || !user) return;
    const verified = Boolean((user as any).email_confirmed_at || (user as any).phone_confirmed_at);
    if (!verified) {
      supabase.auth.signOut();
      toast.error("Please verify the OTP sent to you before accessing your account.");
      return;
    }
    if (access.loading) return;
    if (role === "retailer" || role === "distributor") {
      const state = role === "retailer" ? access.retailer : access.distributor;
      if (state === "approved") nav({ to: DASHBOARD_PATHS[role], replace: true });
      else nav({ to: "/partner-access", search: { role }, replace: true });
      return;
    }
    if (activeSessionRole && activeSessionRole !== "customer") return; // show the switch-account panel
    nav({ to: DASHBOARD_PATHS.customer, replace: true });
  }, [user, loading, nav, access.loading, access.retailer, access.distributor, activeSessionRole, role]);


  const switchAccount = async () => {
    setBusy(true);
    try {
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      toast.success(`Signed out — sign in to your ${roleLabel(role)} account.`);
    } finally {
      setBusy(false);
    }
  };

  const [mode, setMode] = useState<"in" | "up">("in");
  // "password" = email + password, "otp" = mobile number + SMS OTP
  const [loginMode, setLoginMode] = useState<"password" | "otp">("password");
  

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [business, setBusiness] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [policy, setPolicy] = useState({ otpExpirySeconds: 300, otpMaxAttempts: 5, otpResendCooldown: 60, maxFailures: 5, lockMinutes: 15 });

  useEffect(() => {
    getAuthPolicy().then(setPolicy).catch(() => null);
    const stored = typeof window !== "undefined" ? localStorage.getItem(REMEMBER_KEY) : null;
    if (stored) { setEmail(stored); setRemember(true); }
  }, []);

  // Expiry + resend countdowns
  useEffect(() => {
    if (secondsLeft <= 0 && cooldown <= 0) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
      setCooldown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [secondsLeft, cooldown]);

  const expired = otpSent && secondsLeft === 0;
  const locked = attempts >= policy.otpMaxAttempts;
  const mmss = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const verdict = useMemo(() => assessPassword(password, { email, name, phone }), [password, email, name, phone]);

  const finishLogin = async (method: "password" | "otp" | "google") => {
    if (remember) localStorage.setItem(REMEMBER_KEY, email);
    else localStorage.removeItem(REMEMBER_KEY);
    sessionStorage.setItem(SESSION_MARK, "1");
    await recordLoginAttempt({ data: { identifier: email || phone, method, success: true, device: deviceLabel() } }).catch(() => null);
    const res = await registerSession({ data: { device: deviceLabel() } }).catch(() => null);
    if (res && res.blocked) {
      await supabase.auth.signOut();
      toast.error(res.reason || "Your account has been suspended.");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["my-role-status"] });
    await qc.invalidateQueries({ queryKey: ["partner-access-state"] });
    // Retailer/distributor always route through the application gate, which
    // forwards to the dashboard only when the admin has approved the request.
    if (role === "retailer" || role === "distributor") {
      nav({ to: "/partner-access", search: { role }, replace: true });
      return;
    }
    let landed: string = DASHBOARD_PATHS.customer;
    try {
      const { data, error } = await supabase.rpc("my_role_status");
      if (error) throw error;
      const resolvedRole = (data as { role?: string }[] | null)?.[0]?.role;
      if (resolvedRole) landed = dashboardPathFor(resolvedRole);
    } catch {
      /* customer dashboard is the safe fallback */
    }
    nav({ to: landed, replace: true });
  };

  const google = async () => {
    setBusy(true);
    // Return to this public auth page with the requested role preserved; the
    // effect above then forwards to the application gate or the dashboard.
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth?role=${role}`,
    });
    setBusy(false);
    if (result.error) toast.error(result.error.message || "Google sign-in failed");
  };


  const startOtp = (expirySeconds = 600) => {
    setOtpSent(true);
    setOtp("");
    setAttempts(0);
    setSecondsLeft(expirySeconds);
    setCooldown(policy.otpResendCooldown);
  };

  // ---------- Registration ----------
  /** Mobile OTP over MSG91 is the single production verification channel. */
  const deliverSignupOtp = async () => {
    const res = await sendSignupSmsOtp({ data: { email: roleEmail(email, role), phone } });
    if (!res.ok) { toast.error(res.message); return false; }
    startOtp(res.expirySeconds);
    toast.success(res.message);
    return true;
  };


  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const local: Record<string, string> = {};
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) local.email = emailCheck.reason ?? "Enter a valid email address.";
    if (phone.replace(/\D/g, "").length !== 10) local.phone = "Enter a valid 10-digit Indian mobile number.";
    if (!confirm) local.confirm = "Please re-enter your password.";
    else if (password !== confirm) local.confirm = "Passwords do not match.";
    if (role !== "customer" && business.trim().length < 3) local.business = "Enter your business name.";
    if (Object.keys(local).length) { setErrors(local); return; }

    setBusy(true);
    try {
      const check = await validateRegistration({ data: { fullName: name, email, phone, password, role } });
      if (!check.ok) {
        setErrors(Object.fromEntries(check.issues.map((i) => [i.field, i.message])));
        toast.error(check.issues[0]?.message ?? "Please correct the highlighted fields.");
        return;
      }
      // Each role gets its own Auth identity, so the same credentials work for
      // a customer, a retailer and a distributor account — but never twice per role.
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: roleEmail(email, role),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: name.trim(),
            phone: check.phoneE164 ?? phone,
            business_name: business,
            intended_role: role,
          },
        },
      });
      if (error) {
        setErrors({ email: error.message });
        toast.error(error.message);
        return;
      }
      // Never let an unverified account stay signed in, whatever the server returns.
      if (signUpData.session) await supabase.auth.signOut();

      await deliverSignupOtp();
    } catch (err: any) {
      toast.error(err?.message?.includes("fetch") ? "Network problem — please try again." : err?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return toast.error(`Please wait ${cooldown}s before requesting another code.`);
    setBusy(true);
    try {
      if (mode === "up") await deliverSignupOtp();
      else await requestLoginOtp();
    } finally {
      setBusy(false);
    }
  };

  /** Sign-in by mobile OTP — same MSG91 verified template as registration. */
  const requestLoginOtp = async () => {
    const res = await sendLoginSmsOtp({ data: { phone, role } });
    if (!res.ok) { toast.error(res.message); return false; }
    startOtp(res.expirySeconds);
    toast.success(res.message);
    return true;
  };

  const startLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { await requestLoginOtp(); } finally { setBusy(false); }
  };


  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return toast.error("Too many attempts. Please request a fresh code.");
    if (expired) return toast.error("This code has expired. Please request a new one.");
    setBusy(true);
    const token = otp.trim();

    try {
      if (mode === "up") {
        const res = await verifySignupSmsOtp({ data: { email: roleEmail(email, role), code: token } });
        if (!res.ok) {
          setAttempts((a) => a + 1);
          return toast.error(res.message);
        }
        const { error } = await supabase.auth.signInWithPassword({ email: roleEmail(email, role), password });
        if (error) return toast.error("Mobile verified — please sign in to continue.");
      } else {
        const res = await verifyLoginSmsOtp({ data: { phone, code: token, role } });
        if (!res.ok || !res.tokenHash) {
          setAttempts((a) => a + 1);
          return toast.error(res.message);
        }
        const { error } = await supabase.auth.verifyOtp({ token_hash: res.tokenHash, type: "magiclink" });
        if (error) return toast.error("Verified, but sign-in failed. Please use your password.");
      }


      setOtpSent(false);
      setSecondsLeft(0);
      if (mode === "up" && role !== "customer") {
        toast.success(`${role[0].toUpperCase() + role.slice(1)} application submitted — awaiting admin approval.`);
      } else {
        toast.success("Verified — welcome to Aurona!");
      }
      await finishLogin("otp");
    } finally {
      setBusy(false);
    }
  };

  // ---------- Login ----------
  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      const authEmail = roleEmail(email, role);
      const guard = await loginGuard({ data: { identifier: authEmail } }).catch(() => null);
      if (guard?.locked) {
        toast.error(`Too many failed attempts. Try again in ${guard.lockMinutes} minutes or reset your password.`);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
      if (error) {
        await recordLoginAttempt({ data: { identifier: authEmail, method: "password", success: false, reason: error.message, device: deviceLabel() } }).catch(() => null);
        const left = guard ? Math.max(0, guard.remaining - 1) : null;
        const msg = /email not confirmed/i.test(error.message)
          ? "Please verify your email with the OTP we sent before signing in."
          : /invalid login/i.test(error.message)
            ? `Incorrect email or password${left !== null ? ` — ${left} attempt${left === 1 ? "" : "s"} left before a temporary lock` : ""} — check you picked the right account type.`
            : error.message;
        setErrors({ password: msg });
        toast.error(msg);
        return;
      }
      toast.success("Welcome back to Aurona");
      await finishLogin("password");
    } catch {
      toast.error("Network problem — please check your connection and try again.");
    } finally {
      setBusy(false);
    }
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
              const isActive = role === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={cn(
                    "group relative flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all",
                    isActive
                      ? "border-primary bg-gradient-to-br shadow-sky " + r.accent
                      : "border-border bg-card hover:border-primary/40 hover:shadow-soft",
                  )}
                >
                  <div className={cn(
                    "grid h-12 w-12 shrink-0 place-items-center rounded-full transition",
                    isActive ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold">Sign in as {r.title}</span>
                      {isActive && <ShieldCheck className="h-4 w-4 text-primary" />}
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

          {roleConflict ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
                <div className="text-sm font-bold text-primary">
                  You’re signed in as {roleLabel(activeSessionRole)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {user?.email} — a {roleLabel(activeSessionRole).toLowerCase()} session can’t be used for your{" "}
                  {active.title.toLowerCase()} account. Sign out to sign in or register as a {active.title.toLowerCase()}.
                </div>
              </div>
              <Button onClick={switchAccount} disabled={busy} className="h-11 w-full rounded-full">
                {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing out…</> : `Continue as ${active.title}`}
              </Button>
              <Button
                variant="outline"
                className="h-11 w-full rounded-full"
                onClick={() => nav({ to: DASHBOARD_PATHS[activeSessionRole ?? "customer"] })}
              >
                Back to my {roleLabel(activeSessionRole).toLowerCase()} dashboard
              </Button>
            </div>
          ) : (
          <>


          <Button onClick={google} disabled={busy} variant="outline" className="mt-5 h-11 w-full gap-2 rounded-full">
            <GoogleIcon /> Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
          </div>

          <Tabs value={mode} onValueChange={(v) => { setMode(v as any); setErrors({}); }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="in">Sign in</TabsTrigger>
              <TabsTrigger value="up">Create account</TabsTrigger>
            </TabsList>

            {/* ---------------- SIGN IN ---------------- */}
            <TabsContent value="in" className="pt-4">
              <div className="mb-3 grid grid-cols-2 gap-2 rounded-full bg-muted/60 p-1 text-xs font-semibold">
                {(["password", "otp"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setLoginMode(m); setOtpSent(false); setErrors({}); }}
                    className={cn("h-8 rounded-full transition", loginMode === m ? "bg-card shadow-soft text-primary" : "text-muted-foreground")}
                  >
                    {m === "password" ? "Email & password" : "Mobile OTP"}
                  </button>
                ))}
              </div>
              {loginMode === "otp" ? (
                otpSent ? (
                  <OtpPanel {...{ otp, setOtp, verifyOtp, busy, expired, locked, mmss, attempts, maxAttempts: policy.otpMaxAttempts, resend, cooldown, target: phone }} />
                ) : (
                  <form onSubmit={startLoginOtp} className="space-y-3">
                    <PhoneField value={phone} onChange={setPhone} error={errors.phone} />
                    <p className="text-[11px] text-muted-foreground">
                      We’ll SMS a 6-digit code from <b>AURONA</b> to your registered mobile number.
                    </p>
                    <Button className="mt-2 h-11 w-full rounded-full" disabled={busy}>
                      {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending OTP…</> : "Send OTP"}
                    </Button>
                  </form>
                )
              ) : (
              <form onSubmit={signIn} className="space-y-3">
                <Field label="Email" value={email} onChange={setEmail} type="email" error={errors.email} />
                <Field
                  label="Password" value={password} onChange={setPassword}
                  type={showPw ? "text" : "password"} error={errors.password}
                  trailing={
                    <button type="button" onClick={() => setShowPw((s) => !s)} className="text-muted-foreground">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
                  Remember me on this device
                </label>
                <Button className="mt-2 h-11 w-full rounded-full" disabled={busy}>
                  {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</> : `Sign in as ${active.title}`}
                </Button>
              </form>
              )}
            </TabsContent>


            {/* ---------------- REGISTER ---------------- */}
            <TabsContent value="up" className="pt-4">
              {!otpSent ? (
                <form onSubmit={register} className="space-y-3">
                  <Field label="Full name" value={name} onChange={setName} error={errors.fullName} />
                  <Field
                    label="Email address"
                    value={email}
                    onChange={(value) => {
                      setEmail(value);
                      if (errors.email) setErrors((current) => ({ ...current, email: "" }));
                    }}
                    onBlur={() => {
                      const check = validateEmail(email);
                      setErrors((current) => ({ ...current, email: check.ok ? "" : check.reason ?? "Enter a valid email address." }));
                    }}
                    type="email"
                    error={errors.email}
                  />
                  <PhoneField value={phone} onChange={setPhone} error={errors.phone} />
                  {role !== "customer" && (
                    <Field
                      label={role === "retailer" ? "Shop / Store name" : "Company / Distribution firm"}
                      value={business} onChange={setBusiness} error={errors.business}
                    />
                  )}
                  <Field
                    label="Password" value={password} onChange={setPassword}
                    type={showPw ? "text" : "password"} error={errors.password}
                    trailing={
                      <button type="button" onClick={() => setShowPw((s) => !s)} className="text-muted-foreground">
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                  />
                  {password.length > 0 && <StrengthMeter verdict={verdict} />}
                  <Field label="Confirm password" value={confirm} onChange={setConfirm} type={showPw ? "text" : "password"} error={errors.confirm} />
                  {confirm.length > 0 && (
                    confirm === password ? (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-primary"><Check className="h-3 w-3" /> Passwords match</div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-destructive"><X className="h-3 w-3" /> Passwords do not match</div>
                    )
                  )}
                  {role !== "customer" && (
                    <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      Your {role} application will be reviewed by our team. Trade pricing unlocks after approval.
                    </div>
                  )}
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Mobile verification</div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      We’ll SMS a 6-digit code to <b>{phone || "your mobile number"}</b>. Verification is
                      mandatory — the account stays locked until the code is verified.
                    </p>
                  </div>
                  <Button className="mt-2 h-11 w-full rounded-full" disabled={busy || !verdict.ok || password !== confirm || phone.length !== 10}>
                    {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying details…</> : `Create ${active.title} account`}
                  </Button>
                  <p className="text-center text-[11px] text-muted-foreground">
                    We verify your email and mobile number are real before creating the account.
                  </p>
                </form>
              ) : (
                <OtpPanel {...{ otp, setOtp, verifyOtp, busy, expired, locked, mmss, attempts, maxAttempts: policy.otpMaxAttempts, resend, cooldown, target: phone }} />
              )}

            </TabsContent>
          </Tabs>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to Aurona's <Link to="/policies/$slug" params={{ slug: "terms" }} className="underline">Terms</Link> and <Link to="/policies/$slug" params={{ slug: "privacy" }} className="underline">Privacy Policy</Link>.
          </p>
          </>
          )}
        </div>

      </div>
    </div>
  );
}

function StrengthMeter({ verdict }: { verdict: ReturnType<typeof assessPassword> }) {
  const colors = ["bg-destructive", "bg-destructive", "bg-amber-500", "bg-emerald-500", "bg-emerald-600"];
  const rules: [keyof typeof verdict.checks, string][] = [
    ["length", "8+ characters"],
    ["upper", "Uppercase"],
    ["lower", "Lowercase"],
    ["number", "Number"],
    ["special", "Special character"],
  ];
  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
      <div className="flex items-center justify-between text-[11px] font-semibold">
        <span className="text-muted-foreground">Password strength</span>
        <span className={verdict.score >= 3 ? "text-emerald-600" : verdict.score === 2 ? "text-amber-600" : "text-destructive"}>
          {verdict.label}
        </span>
      </div>
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn("h-1.5 flex-1 rounded-full", i < verdict.score ? colors[verdict.score] : "bg-border")} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {rules.map(([k, label]) => (
          <div key={k} className={cn("flex items-center gap-1 text-[11px]", verdict.checks[k] ? "text-emerald-600" : "text-muted-foreground")}>
            {verdict.checks[k] ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {label}
          </div>
        ))}
      </div>
      {verdict.problems.length > 0 && (
        <div className="text-[11px] text-destructive">{verdict.problems[0]}</div>
      )}
    </div>
  );
}

function OtpPanel(props: {
  otp: string; setOtp: (v: string) => void; verifyOtp: (e: React.FormEvent) => void;
  busy: boolean; expired: boolean; locked: boolean; mmss: string; attempts: number; maxAttempts: number;
  resend: () => void; cooldown: number; target: string;
}) {
  const { otp, setOtp, verifyOtp, busy, expired, locked, mmss, attempts, maxAttempts, resend, cooldown, target } = props;
  return (
    <form onSubmit={verifyOtp} className="mt-1 space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Verify your account</div>
        <div className={cn("text-[11px] font-semibold", expired ? "text-destructive" : "text-muted-foreground")}>
          {expired ? "Code expired" : `Expires in ${mmss}`}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Enter the 6-digit code sent to {target || "your account"}. Verification is mandatory — you cannot sign in until it is complete.
      </p>

      <Input
        value={otp}
        onChange={(ev) => setOtp(ev.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric" placeholder="••••••"
        className="h-11 text-center text-lg tracking-[0.5em]" required
      />
      {attempts > 0 && !locked && (
        <div className="text-[11px] text-destructive">
          Invalid code — {maxAttempts - attempts} attempt{maxAttempts - attempts === 1 ? "" : "s"} left
        </div>
      )}
      {locked && <div className="text-[11px] text-destructive">Maximum attempts reached. Request a fresh code to continue.</div>}
      <Button type="submit" className="h-11 w-full rounded-full" disabled={busy || otp.length < 6 || expired || locked}>
        {busy ? "Verifying…" : "Verify & continue"}
      </Button>
      <button
        type="button" onClick={resend} disabled={busy || cooldown > 0}
        className="w-full text-center text-[11px] font-semibold text-primary underline disabled:opacity-50"
      >
        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
      </button>

    </form>
  );
}

function Field({ label, value, onChange, onBlur, type = "text", error, trailing }: {
  label: string; value: string; onChange: (v: string) => void; onBlur?: () => void; type?: string; error?: string; trailing?: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Input
          value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} type={type} required
          className={cn("mt-1 h-11", trailing && "pr-10", error && "border-destructive")}
        />
        {trailing && <span className="absolute right-3 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
      {error && <div className="mt-1 text-[11px] text-destructive">{error}</div>}
    </div>
  );
}

function PhoneField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const short = value.length > 0 && value.length < 10;
  return (
    <div>
      <Label className="text-xs">Mobile number</Label>
      <PhoneInput value={value} onChange={onChange} required invalid={Boolean(error) || short} autoComplete="tel-national" />
      {(error || short) && (
        <div className="mt-1 text-[11px] text-destructive">{error ?? "Mobile number must be exactly 10 digits."}</div>
      )}
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
