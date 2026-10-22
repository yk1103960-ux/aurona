import { createFileRoute, Link } from "@tanstack/react-router";
import { LegacyModulePage } from "@/components/admin/ecommain/LegacyModulePage";
const ROOT='/aurona-console-9f2x7k';
export const Route=createFileRoute('/aurona-console-9f2x7k/reports-legacy')({component:ReportsLegacy});
function ReportsLegacy(){return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{['Product Stock','Sales','Commission','Customer'].map(x=><div key={x} className="rounded border bg-white p-4 shadow-sm"><div className="text-xs uppercase text-slate-400">Report</div><div className="mt-1 font-semibold text-slate-800">{x}</div></div>)}</div><LegacyModulePage title="Reports" description="Recovered Ecommain reporting workspace for product, sales, stock and commission reporting." columns={["Report","Period","Records","Generated","Options"]} actions={["Export Report"]}/><Link to={`${ROOT}/audit`} className="text-sm font-medium text-[#25b990]">Open audit logs →</Link></div>}
