import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Users, ScrollText, UserCog, LockKeyhole, Plug } from "lucide-react";
const R="/aurona-console-9f2x7k";
export const Route=createFileRoute('/aurona-console-9f2x7k/system')({component:SystemAdmin});
const modules=[
 {label:'Roles & Permissions',desc:'Control administrative roles and permission assignments.',to:`${R}/roles`,icon:ShieldCheck},
 {label:'Staff & Accounts',desc:'Manage customer, retailer, distributor and administrative accounts.',to:`${R}/customers`,icon:Users},
 {label:'Security & 2FA',desc:'Authentication, OTP, lockout and security rules.',to:`${R}/security`,icon:LockKeyhole},
 {label:'Audit Logs',desc:'Review administrative actions and system activity.',to:`${R}/audit`,icon:ScrollText},
 {label:'Partner Applications',desc:'Review retailer and distributor account applications.',to:`${R}/applications`,icon:UserCog},
 {label:'Integrations',desc:'Inspect configured external services and commerce integrations.',to:`${R}/integrations`,icon:Plug},
];
function SystemAdmin(){return <div className="space-y-5"><div><h1 className="text-2xl font-semibold">System</h1><p className="mt-1 text-sm text-slate-500">Administration, permissions, security and system governance.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{modules.map(({label,desc,to,icon:Icon})=><Link key={label} to={to} className="rounded-xl border bg-white p-5 shadow-sm hover:border-emerald-300"><Icon className="mb-3 h-5 w-5 text-emerald-700"/><div className="font-semibold">{label}</div><div className="mt-1 text-sm text-slate-500">{desc}</div><div className="mt-4 text-xs font-semibold text-emerald-700">Open →</div></Link>)}</div></div>}
