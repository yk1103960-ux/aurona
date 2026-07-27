import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, KeyRound, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { mfaStatus, mfaBegin, mfaConfirm, mfaDisable } from "@/lib/mfa.functions";

export const Route = createFileRoute("/aurona-console-9f2x7k/security")({
  component: SecurityAdmin,
});

function SecurityAdmin() {
  const qc = useQueryClient();
  const getStatus = useServerFn(mfaStatus);
  const begin = useServerFn(mfaBegin);
  const confirm = useServerFn(mfaConfirm);
  const disableFn = useServerFn(mfaDisable);

  const [enrolment, setEnrolment] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [token, setToken] = useState("");
  const [disableToken, setDisableToken] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: status } = useQuery({ queryKey: ["mfa-status"], queryFn: () => getStatus() });

  const startEnrolment = async () => {
    try {
      const r = await begin();
      setEnrolment({ qrDataUrl: r.qrDataUrl, secret: r.secret });
    } catch (e: any) { toast.error(e.message); }
  };

  const verify = async () => {
    try {
      const r = await confirm({ data: { token } });
      setBackupCodes(r.backupCodes);
      setEnrolment(null);
      setToken("");
      qc.invalidateQueries({ queryKey: ["mfa-status"] });
      toast.success("2FA enabled");
    } catch (e: any) { toast.error(e.message); }
  };

  const disable = async () => {
    if (!confirm) return;
    try {
      await disableFn({ data: { token: disableToken } });
      setDisableToken("");
      qc.invalidateQueries({ queryKey: ["mfa-status"] });
      toast.success("2FA disabled");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><ShieldCheck className="w-6 h-6" /> Security & 2FA</h1>
        <p className="text-sm text-slate-500">Two-factor authentication using TOTP (Google Authenticator, Authy, 1Password, etc.)</p>
      </div>

      {status?.enrolled ? (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
            <div className="font-semibold">Two-factor authentication is active</div>
          </div>
          <div className="text-xs text-slate-500">Last used {status.lastUsedAt ? new Date(status.lastUsedAt).toLocaleString() : "—"}</div>

          <div className="border-t pt-3">
            <Label>Disable 2FA</Label>
            <p className="text-xs text-slate-500 mb-2">Enter a current 6-digit code to remove 2FA from your account.</p>
            <div className="flex gap-2">
              <Input value={disableToken} onChange={(e) => setDisableToken(e.target.value)} placeholder="000000" className="max-w-[160px] font-mono" />
              <Button variant="destructive" onClick={disable} disabled={disableToken.length < 6}>Disable 2FA</Button>
            </div>
          </div>
        </div>
      ) : enrolment ? (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="font-semibold">Scan this QR in your authenticator app</div>
          <img src={enrolment.qrDataUrl} alt="MFA QR" className="w-56 h-56 border rounded" />
          <div className="text-xs text-slate-500">Or enter this secret manually:</div>
          <div className="flex items-center gap-2">
            <code className="font-mono text-sm bg-slate-100 px-3 py-1.5 rounded flex-1 select-all">{enrolment.secret}</code>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(enrolment.secret); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <div className="border-t pt-3">
            <Label>Verify with a 6-digit code</Label>
            <div className="flex gap-2 mt-1">
              <Input value={token} onChange={(e) => setToken(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000" className="max-w-[160px] font-mono text-center text-lg tracking-widest" />
              <Button onClick={verify} disabled={token.length !== 6}>Enable 2FA</Button>
              <Button variant="ghost" onClick={() => setEnrolment(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <Alert>
            <KeyRound className="w-4 h-4" />
            <AlertDescription>2FA is not yet enabled for your admin account. Enabling adds a second verification step after your password.</AlertDescription>
          </Alert>
          <Button onClick={startEnrolment}>Start setup</Button>
        </div>
      )}

      {backupCodes && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 space-y-3">
          <div className="font-semibold text-amber-900">Save these backup codes now</div>
          <p className="text-xs text-amber-800">Each code works once and can be used instead of your authenticator app. You will not see them again.</p>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm">
            {backupCodes.map(c => <code key={c} className="bg-white px-3 py-1.5 rounded border">{c}</code>)}
          </div>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(backupCodes.join("\n")); toast.success("Copied"); }}>
            <Copy className="w-4 h-4 mr-1" /> Copy all
          </Button>
        </div>
      )}
    </div>
  );
}
