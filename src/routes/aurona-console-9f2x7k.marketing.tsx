import { createFileRoute, Link } from "@tanstack/react-router";
import { Megaphone, TicketPercent, PanelsTopLeft, BellRing } from "lucide-react";

const ROOT = "/aurona-console-9f2x7k";
export const Route = createFileRoute("/aurona-console-9f2x7k/marketing")({ component: MarketingHub });

const tools = [
  { title: "Campaigns & Flash Deals", detail: "Create, schedule, edit and archive promotional campaigns and flash deals.", to: `${ROOT}/campaigns`, icon: Megaphone },
  { title: "Coupons", detail: "Manage coupon codes, eligibility and promotional discounts.", to: `${ROOT}/coupons`, icon: TicketPercent },
  { title: "Homepage Promotions", detail: "Control promotional homepage content and merchandising blocks.", to: `${ROOT}/content`, icon: PanelsTopLeft },
  { title: "Alerts & Announcements", detail: "Manage customer-facing promotional and operational notices.", to: `${ROOT}/content`, icon: BellRing },
];

function MarketingHub() {
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-semibold">Marketing</h1><p className="text-sm text-slate-500">Active eCommerce promotional tools connected to Aurona's live administration workflows.</p></div>
    <div className="grid gap-4 md:grid-cols-2">{tools.map(({title,detail,to,icon:Icon}) => <Link key={title} to={to} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"><div className="flex items-start gap-4"><div className="rounded-lg bg-emerald-50 p-3 text-emerald-700"><Icon className="h-5 w-5"/></div><div><div className="font-semibold text-slate-900 group-hover:text-emerald-700">{title}</div><p className="mt-1 text-sm text-slate-500">{detail}</p><div className="mt-3 text-xs font-semibold uppercase tracking-wide text-emerald-600">Open management →</div></div></div></Link>)}</div>
  </div>;
}
