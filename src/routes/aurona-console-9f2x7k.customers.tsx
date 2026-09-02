import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Search, ShieldOff, ShieldCheck, RotateCcw, Save, Plus, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  adminListUsers,
  adminSetUserBlocked,
  adminResetVerification,
  adminLoginActivity,
  adminGetSecuritySettings,
  adminSaveSecuritySettings,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
} from "@/lib/user-admin.functions";

type EditDraft = {
  userId?: string;
  email: string;
  password: string;
  fullName: string;
  phone: string;
  businessName: string;
  accountType: "customer" | "retailer" | "distributor";
};

const EMPTY_DRAFT: EditDraft = {
  email: "",
  password: "",
  fullName: "",
  phone: "",
  businessName: "",
  accountType: "customer",
};

export const Route = createFileRoute("/aurona-console-9f2x7k/customers")({
  component: UsersAdmin,
});

const SETTINGS_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "otp_expiry_seconds", label: "OTP expiry (seconds)", hint: "Default 300 (5 minutes)" },
  { key: "otp_max_attempts", label: "Max OTP attempts", hint: "Default 5" },
  { key: "otp_resend_cooldown", label: "Resend cooldown (seconds)", hint: "Default 60" },
  { key: "login_max_failures", label: "Failed logins before lock", hint: "Default 5" },
  { key: "login_lock_minutes", label: "Lock duration (minutes)", hint: "Default 15" },
  { key: "block_fake_emails", label: "Block fake emails (true/false)", hint: "Fake/disposable email detection" },
];

function UsersAdmin() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"users" | "activity" | "rules">("users");
  const qc = useQueryClient();

  const users = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => adminListUsers({ data: { search } }),
    refetchInterval: 20_000,
  });

  const activity = useQuery({
    queryKey: ["admin-login-activity"],
    queryFn: () => adminLoginActivity({ data: { limit: 100 } }),
    enabled: tab === "activity",
    refetchInterval: 15_000,
  });

  const settings = useQuery({
    queryKey: ["admin-security-settings"],
    queryFn: () => adminGetSecuritySettings(),
    enabled: tab === "rules",
  });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<EditDraft | null>(null);

  const createUser = useMutation({
    mutationFn: (v: EditDraft) =>
      adminCreateUser({
        data: {
          email: v.email,
          password: v.password,
          fullName: v.fullName,
          phone: v.phone,
          businessName: v.businessName,
          accountType: v.accountType,
        },
      }),
    onSuccess: () => {
      toast.success("Account created");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not create the account"),
  });

  const updateUser = useMutation({
    mutationFn: (v: EditDraft) =>
      adminUpdateUser({
        data: {
          userId: v.userId!,
          email: v.email || "",
          password: v.password || "",
          fullName: v.fullName,
          phone: v.phone,
          businessName: v.businessName,
          accountType: v.accountType,
        },
      }),
    onSuccess: () => {
      toast.success("Account updated");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update the account"),
  });

  const removeUser = useMutation({
    mutationFn: (userId: string) => adminDeleteUser({ data: { userId } }),
    onSuccess: () => {
      toast.success("Account deleted");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not delete the account"),
  });

  const block = useMutation({
    mutationFn: (v: { userId: string; blocked: boolean; reason?: string }) => adminSetUserBlocked({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(v.blocked ? "User blocked" : "User unblocked");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Action failed"),
  });

  const reset = useMutation({
    mutationFn: (userId: string) => adminResetVerification({ data: { userId } }),
    onSuccess: () => {
      toast.success("Verification reset — user must verify by OTP again");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Action failed"),
  });

  const save = useMutation({
    mutationFn: (v: Record<string, string>) => adminSaveSecuritySettings({ data: v }),
    onSuccess: () => {
      toast.success("Security rules saved");
      qc.invalidateQueries({ queryKey: ["admin-security-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const values = { ...(settings.data ?? {}), ...draft } as Record<string, string>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Users & Security</h1>

      <div className="flex gap-2">
        {(["users", "activity", "rules"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize ${
              tab === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {t === "rules" ? "Security rules" : t === "activity" ? "Login activity" : "Users"}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Search name, email, phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button className="gap-2 rounded-full" onClick={() => setEditing({ ...EMPTY_DRAFT })}>
              <Plus className="h-4 w-4" /> Add account
            </Button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-3 text-left">User</th>
                  <th className="p-3 text-left">Contact</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-left">Verified</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Last login</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(users.data ?? []).map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-medium">{u.fullName || "—"}</div>
                      {u.businessName && <div className="text-xs text-slate-500">{u.businessName}</div>}
                    </td>
                    <td className="p-3 text-xs">
                      <div>{u.email || "—"}</div>
                      <div className="text-slate-500">{u.phone || "—"}</div>
                    </td>
                    <td className="p-3">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{u.accountType}</span>
                      {u.roles.includes("admin") && <span className="ml-1 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">admin</span>}
                    </td>
                    <td className="p-3 text-xs">
                      <span className={u.emailVerified ? "text-emerald-600" : "text-red-600"}>
                        {u.emailVerified ? "Email ✓" : "Email ✗"}
                      </span>
                    </td>
                    <td className="p-3 text-xs">
                      {u.blocked ? (
                        <span className="rounded bg-red-100 px-2 py-0.5 text-red-700">Blocked</span>
                      ) : (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">Active</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-slate-500">
                      {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString() : "Never"}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm" variant="outline" className="h-8 gap-1 text-xs"
                          onClick={() => reset.mutate(u.id)}
                        >
                          <RotateCcw className="h-3 w-3" /> Reset OTP
                        </Button>
                        <Button
                          size="sm" variant={u.blocked ? "outline" : "destructive"} className="h-8 gap-1 text-xs"
                          onClick={() => block.mutate({ userId: u.id, blocked: !u.blocked, reason: "Suspended by admin" })}
                        >
                          {u.blocked ? <><ShieldCheck className="h-3 w-3" /> Unblock</> : <><ShieldOff className="h-3 w-3" /> Block</>}
                        </Button>
                        <Button
                          size="sm" variant="outline" className="h-8 gap-1 text-xs"
                          onClick={() =>
                            setEditing({
                              userId: u.id,
                              email: u.email ?? "",
                              password: "",
                              fullName: u.fullName ?? "",
                              phone: (u.phone ?? "").replace(/^\+?91/, ""),
                              businessName: u.businessName ?? "",
                              accountType: (["retailer", "distributor"].includes(u.accountType) ? u.accountType : "customer") as EditDraft["accountType"],
                            })
                          }
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                        <Button
                          size="sm" variant="destructive" className="h-8 gap-1 text-xs"
                          disabled={u.roles.includes("admin")}
                          onClick={() => {
                            if (window.confirm(`Permanently delete ${u.email ?? u.fullName ?? "this account"}? This cannot be undone.`)) {
                              removeUser.mutate(u.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.isLoading && <tr><td colSpan={7} className="p-8 text-center text-slate-500">Loading…</td></tr>}
                {!users.isLoading && (users.data ?? []).length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-500">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "activity" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-3 text-left">When</th>
                <th className="p-3 text-left">Identifier</th>
                <th className="p-3 text-left">Method</th>
                <th className="p-3 text-left">Result</th>
                <th className="p-3 text-left">Device</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(activity.data ?? []).map((a: any) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="p-3 text-xs text-slate-500">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="p-3 text-xs">{a.identifier}</td>
                  <td className="p-3 text-xs capitalize">{a.method}</td>
                  <td className="p-3 text-xs">
                    {a.success
                      ? <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">Success</span>
                      : <span className="rounded bg-red-100 px-2 py-0.5 text-red-700">{a.reason || "Failed"}</span>}
                  </td>
                  <td className="max-w-[280px] truncate p-3 text-[11px] text-slate-500">{a.user_agent || "—"}</td>
                </tr>
              ))}
              {activity.isLoading && <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading…</td></tr>}
              {!activity.isLoading && (activity.data ?? []).length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">No login attempts recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "rules" && (
        <div className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          {SETTINGS_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-slate-600">{f.label}</label>
              <Input
                value={values[f.key] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                className="mt-1"
              />
              <div className="mt-1 text-[11px] text-slate-400">{f.hint}</div>
            </div>
          ))}
          <Button className="gap-2" disabled={save.isPending} onClick={() => save.mutate(values)}>
            <Save className="h-4 w-4" /> {save.isPending ? "Saving…" : "Save security rules"}
          </Button>
        </div>
      )}
    </div>
  );
}
