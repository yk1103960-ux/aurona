import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings, Truck, Plug, Shield, CreditCard, Users, FileText, Store } from "lucide-react";

const R = "/aurona-console-9f2x7k";
export const Route = createFileRoute('/aurona-console-9f2x7k/configurations')({ component: Configurations });

const sections = [
  { title: "General Settings", description: "Store identity, business configuration and operational defaults.", to: `${R}/settings`, icon: Settings },
  { title: "Shipping & Tax Rules", description: "Shipping rules, delivery configuration and tax behaviour.", to: `${R}/shipping-rules`, icon: Truck },
  { title: "Payment Gateways", description: "Payment operations and secure gateway integration status.", to: `${R}/payment-gateways`, icon: CreditCard },
  { title: "Integrations", description: "External services, commerce integrations and supported addons.", to: `${R}/integrations`, icon: Plug },
  { title: "Security", description: "Authentication, OTP, access and security configuration.", to: `${R}/security`, icon: Shield },
  { title: "Roles & Permissions", description: "Staff access and administrative permissions.", to: `${R}/roles`, icon: Users },
  { title: "Website Setup", description: "Storefront content, homepage and appearance management.", to: `${R}/website-setup`, icon: Store },
  { title: "Audit Logs", description: "Administrative and system activity history.", to: `${R}/audit`, icon: FileText },
];

function Configurations() {
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-semibold">Setup & Configurations</h1><p className="mt-1 text-sm text-slate-500">Central configuration workspace for the restored Aurona commerce administration.</p></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{sections.map(({title,description,to,icon:Icon}) => <Link key={title} to={to} className="group rounded-xl border bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5"/></div><div className="font-semibold">{title}</div><div className="mt-1 text-sm text-slate-500">{description}</div><div className="mt-4 text-xs font-semibold text-emerald-700">Manage →</div></Link>)}</div>
  </div>;
}
