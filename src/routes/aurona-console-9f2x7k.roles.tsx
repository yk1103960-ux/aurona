import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminAssignAccessRole, adminListAccess } from "@/lib/access-admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/aurona-console-9f2x7k/roles")({ component: RolesAdmin });

function RolesAdmin() {
  const qc = useQueryClient();
  const listAccess = useServerFn(adminListAccess);
  const assignRole = useServerFn(adminAssignAccessRole);
  const q = useQuery({ queryKey: ["admin-access"], queryFn: () => listAccess() });
  const changeRole = async (userId: string, roleId: string) => {
    try { await assignRole({ data: { userId, roleId } }); toast.success("Access profile updated"); qc.invalidateQueries({ queryKey: ["admin-access"] }); }
    catch (error: any) { toast.error(error?.message || "Could not update access"); }
  };
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-semibold">Roles & Permissions</h1><p className="text-sm text-slate-500">Assign least-privilege access profiles to admin accounts. The final Super Admin is protected.</p></div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {(q.data?.roles ?? []).map((role: any) => <div key={role.id} className="rounded-xl border bg-white p-4"><h2 className="font-semibold">{role.name}</h2><p className="mt-1 text-sm text-slate-500">{role.description}</p><div className="mt-3 flex flex-wrap gap-1">{role.admin_role_permissions.map((p: any) => <span key={p.permission_key} className="rounded bg-slate-100 px-2 py-1 text-[11px]">{p.permission_key}</span>)}</div></div>)}
    </div>
    <div className="overflow-hidden rounded-xl border bg-white">
      <table className="w-full text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3 text-left">Admin</th><th className="p-3 text-left">Last sign-in</th><th className="p-3 text-left">Access profile</th></tr></thead><tbody className="divide-y">
        {(q.data?.users ?? []).map((user: any) => { const assignment = q.data?.assignments.find((a: any) => a.user_id === user.id); return <tr key={user.id}><td className="p-3"><div className="font-medium">{user.email}</div><div className="font-mono text-xs text-slate-400">{user.id}</div></td><td className="p-3 text-slate-500">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "Never"}</td><td className="p-3"><select className="h-9 rounded-md border bg-white px-2" value={assignment?.role_id ?? ""} onChange={(e) => changeRole(user.id, e.target.value)}><option value="" disabled>Select profile</option>{q.data?.roles.map((role: any) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></td></tr>; })}
        {q.isLoading && <tr><td colSpan={3} className="p-8 text-center text-slate-500">Loading access profiles…</td></tr>}
      </tbody></table>
    </div>
  </div>;
}
