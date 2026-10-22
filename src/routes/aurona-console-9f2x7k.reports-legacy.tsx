import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, ClipboardList, PackageSearch } from "lucide-react";

const ROOT = "/aurona-console-9f2x7k";
export const Route = createFileRoute('/aurona-console-9f2x7k/reports-legacy')({ component: ReportsEntry });

function ReportsEntry() {
  const reports = [
    { title: "Business Reports", description: "Open the live reporting workspace for sales, product and operational reporting.", to: `${ROOT}/reports`, icon: BarChart3 },
    { title: "Product Master Export", description: "Use Product Master for category-wise variant exports with buyer pricing, stock, MOQ, dimensions and product metadata.", to: `${ROOT}/products/master`, icon: PackageSearch },
    { title: "Audit Logs", description: "Review administrative activity and operational audit history.", to: `${ROOT}/audit`, icon: ClipboardList },
  ];
  return <div className="space-y-5">
    <div className="border-b bg-white px-5 py-4 shadow-sm"><h1 className="text-xl font-semibold">Reports</h1><p className="mt-1 text-sm text-slate-500">Sales, product, stock and administration reporting.</p></div>
    <div className="grid gap-4 md:grid-cols-3">{reports.map(({title,description,to,icon:Icon})=><Link key={title} to={to} className="group rounded border bg-white p-5 shadow-sm hover:border-[#25a36f]"><div className="mb-4 flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded bg-emerald-50 text-[#25a36f]"><Icon className="h-5 w-5"/></div><ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#25a36f]"/></div><div className="font-semibold">{title}</div><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p></Link>)}</div>
  </div>;
}
