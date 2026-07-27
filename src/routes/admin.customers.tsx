import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useAdmin";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export const Route = createFileRoute("/admin/customers")({
  component: CustomersAdmin,
});

function CustomersAdmin() {
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["admin-customers", search],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, full_name, phone, business_name, account_type, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (search) query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,business_name.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
  useRealtime(["profiles"], () => q.refetch());

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Customers</h1>
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Phone</th>
              <th className="p-3 text-left">Business</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(q.data ?? []).map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="p-3 font-medium">{c.full_name || "—"}</td>
                <td className="p-3">{c.phone || "—"}</td>
                <td className="p-3">{c.business_name || "—"}</td>
                <td className="p-3"><span className="px-2 py-0.5 rounded bg-slate-100 text-xs">{c.account_type ?? "retail"}</span></td>
                <td className="p-3 text-xs text-slate-500">{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {q.isLoading && <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading…</td></tr>}
            {!q.isLoading && q.data?.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">No customers.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
