import { createFileRoute, Link } from "@tanstack/react-router";
import { PanelsTopLeft, Truck, Settings, Newspaper } from "lucide-react";
const ROOT="/aurona-console-9f2x7k";
export const Route=createFileRoute('/aurona-console-9f2x7k/website-setup')({component:WebsiteSetup});
const sections=[
 {title:"Homepage & Storefront Content",desc:"Edit homepage merchandising, alerts and customer-facing content.",to:`${ROOT}/content`,icon:PanelsTopLeft},
 {title:"Blogs & Editorial",desc:"Manage published website articles, careers and FAQs.",to:`${ROOT}/editorial`,icon:Newspaper},
 {title:"Shipping",desc:"Manage shipping configuration used by the storefront.",to:`${ROOT}/shipping`,icon:Truck},
 {title:"General Settings",desc:"Open the connected Aurona administration settings.",to:`${ROOT}/settings`,icon:Settings},
];
function WebsiteSetup(){return <div className="space-y-5"><div><h1 className="text-2xl font-semibold">Website Setup</h1><p className="text-sm text-slate-500">Storefront configuration and content management.</p></div><div className="grid gap-4 md:grid-cols-2">{sections.map(({title,desc,to,icon:Icon})=><Link key={title} to={to} className="rounded-xl border bg-white p-5 shadow-sm hover:border-emerald-300"><div className="flex gap-4"><div className="h-fit rounded-lg bg-emerald-50 p-3 text-emerald-700"><Icon className="h-5 w-5"/></div><div><div className="font-semibold">{title}</div><p className="mt-1 text-sm text-slate-500">{desc}</p><div className="mt-3 text-xs font-semibold text-emerald-600">OPEN →</div></div></div></Link>)}</div></div>}
