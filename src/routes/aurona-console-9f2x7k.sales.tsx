import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingCart, CreditCard, Clock3, RotateCcw, ArrowRight } from "lucide-react";

const ROOT = "/aurona-console-9f2x7k";

export const Route = createFileRoute('/aurona-console-9f2x7k/sales')({ component: SalesPage });

const modules = [
  { title: "All Orders", description: "Search, review and manage customer, retailer and distributor orders.", to: `${ROOT}/orders`, icon: ShoppingCart },
  { title: "Pending Orders", description: "Open the order queue filtered to orders waiting for processing.", to: `${ROOT}/orders`, search: { status: "pending" }, icon: Clock3 },
  { title: "Payments", description: "Review payment transactions, payment state and order settlement records.", to: `${ROOT}/payments`, icon: CreditCard },
  { title: "Abandoned Carts", description: "Inspect carts that did not complete checkout and their recovery state.", to: `${ROOT}/carts`, icon: ShoppingCart },
  { title: "Refunds & Returns", description: "Process return requests and the inventory/refund workflow.", to: `${ROOT}/returns`, icon: RotateCcw },
];

function SalesPage() {
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-semibold text-slate-800">Sales</h1><p className="mt-1 text-sm text-slate-500">Active eCommerce sales control center. Every workspace below opens the live Aurona admin module.</p></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{modules.map(({ title, description, to, search, icon: Icon }) => (
      <Link key={title} to={to} search={search as never} className="group rounded border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#25b990] hover:shadow-md">
        <div className="flex items-start justify-between gap-3"><span className="rounded bg-emerald-50 p-2 text-[#25a36f]"><Icon className="h-5 w-5" /></span><ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-[#25a36f]" /></div>
        <h2 className="mt-4 font-semibold text-slate-800">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </Link>
    ))}</div>
  </div>;
}
