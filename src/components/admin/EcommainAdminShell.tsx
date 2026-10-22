import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { BarChart3, Boxes, ChevronDown, CreditCard, FileText, Headphones, LayoutDashboard, Megaphone, NotebookPen, Package, Plug, RotateCcw, Settings, Shield, ShoppingCart, Store, Upload, Users, WalletCards } from "lucide-react";
import { useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { AdminShell } from "@/components/admin/AdminShell";

const ROOT = "/aurona-console-9f2x7k";
type Item = { label: string; to: string };
type Group = { label: string; icon: typeof Package; to?: string; items: Item[] };

const groups: Group[] = [
 { label:"Products", icon:Package, items:[{label:"All Products",to:`${ROOT}/products`},{label:"Product Master",to:`${ROOT}/products/master`},{label:"Add New Product",to:`${ROOT}/products/new`},{label:"Categories",to:`${ROOT}/categories`},{label:"Bulk Import & Export",to:`${ROOT}/products/bulk`},{label:"Bulk Photo Upload",to:`${ROOT}/products/photos`},{label:"Product Reviews",to:`${ROOT}/reviews`}]},
 { label:"Notes", icon:NotebookPen, to:`${ROOT}/notes`, items:[{label:"All Notes",to:`${ROOT}/notes`}]},
 { label:"Wholesale Products", icon:Boxes, to:`${ROOT}/wholesale`, items:[{label:"Wholesale Products",to:`${ROOT}/wholesale`},{label:"SKU Inventory",to:`${ROOT}/inventory`},{label:"Partner Applications",to:`${ROOT}/applications`}]},
 { label:"Sales", icon:ShoppingCart, items:[{label:"All Orders",to:`${ROOT}/orders`},{label:"Payments",to:`${ROOT}/payments`},{label:"Abandoned Carts",to:`${ROOT}/carts`}]},
 { label:"Refunds", icon:RotateCcw, to:`${ROOT}/refunds`, items:[{label:"Refund Requests",to:`${ROOT}/returns`}]},
 { label:"Customers", icon:Users, items:[{label:"Customer List",to:`${ROOT}/customers`},{label:"Retailer / Distributor Applications",to:`${ROOT}/applications`}]},
 { label:"Uploaded Files", icon:Upload, to:`${ROOT}/uploaded-files`, items:[{label:"All Uploaded Files",to:`${ROOT}/uploaded-files`},{label:"Media / Uploads",to:`${ROOT}/media`},{label:"Product Photos",to:`${ROOT}/products/photos`}]},
 { label:"Reports", icon:BarChart3, items:[{label:"Business Reports",to:`${ROOT}/reports`},{label:"Audit Logs",to:`${ROOT}/audit`}]},
 { label:"Blog System", icon:FileText, to:`${ROOT}/blog-system`, items:[{label:"Blog System",to:`${ROOT}/blog-system`},{label:"Blogs & Editorial",to:`${ROOT}/editorial`}]},
 { label:"Marketing", icon:Megaphone, to:`${ROOT}/marketing`, items:[{label:"Marketing",to:`${ROOT}/marketing`},{label:"Coupons",to:`${ROOT}/coupons`},{label:"Campaigns",to:`${ROOT}/campaigns`},{label:"Homepage & Alerts",to:`${ROOT}/content`}]},
 { label:"Support", icon:Headphones, items:[{label:"Support Inbox",to:`${ROOT}/support`}]},
 { label:"Affiliate System", icon:WalletCards, to:`${ROOT}/affiliate-system`, items:[{label:"Affiliate Dashboard",to:`${ROOT}/affiliate-system`},{label:"Affiliate Users & Commissions",to:`${ROOT}/affiliates`}]},
 { label:"Payment Gateways", icon:CreditCard, to:`${ROOT}/payment-gateways`, items:[{label:"Payment Gateways",to:`${ROOT}/payment-gateways`},{label:"Payments",to:`${ROOT}/payments`},{label:"Integrations",to:`${ROOT}/integrations`}]},
 { label:"Website Setup", icon:Store, to:`${ROOT}/website-setup`, items:[{label:"Website Setup",to:`${ROOT}/website-setup`},{label:"Homepage & Content",to:`${ROOT}/content`},{label:"Shipping",to:`${ROOT}/shipping`}]},
 { label:"Setup & Configurations", icon:Settings, to:`${ROOT}/configurations`, items:[{label:"Setup & Configurations",to:`${ROOT}/configurations`},{label:"Settings",to:`${ROOT}/settings`},{label:"Shipping & Tax Rules",to:`${ROOT}/shipping-rules`},{label:"Integrations",to:`${ROOT}/integrations`}]},
 { label:"System", icon:Shield, to:`${ROOT}/system`, items:[{label:"System",to:`${ROOT}/system`},{label:"Roles & Permissions",to:`${ROOT}/roles`},{label:"Security & 2FA",to:`${ROOT}/security`},{label:"Audit Logs",to:`${ROOT}/audit`}]},
 { label:"Addon Manager", icon:Plug, to:`${ROOT}/addon-manager`, items:[{label:"Addon Manager",to:`${ROOT}/addon-manager`},{label:"Integrations / Addons",to:`${ROOT}/integrations`}]},
];

export function EcommainAdminShell(){
 const {user,isAdmin,loading}=useAdmin(); const location=useLocation(); const [open,setOpen]=useState<Set<string>>(()=>new Set(["Products"]));
 if(loading||!user||!isAdmin) return <AdminShell/>;
 return <div className="min-h-screen bg-[#f2f3f8] text-slate-800 lg:grid lg:grid-cols-[255px_1fr]">
  <aside className="border-r border-[#273444] bg-[#1c2b36] text-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
   <div className="border-b border-white/10 px-5 py-5"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded bg-[#25a36f] font-black">A</div><div><div className="font-bold tracking-wide">AURONA</div><div className="text-[10px] uppercase tracking-[.18em] text-white/45">Active eCommerce</div></div></div></div>
   <nav className="space-y-1 p-3"><Link to={ROOT} className={`flex items-center gap-3 rounded px-3 py-2.5 text-sm ${location.pathname===ROOT||location.pathname===`${ROOT}/`?"bg-[#25a36f]":"text-white/75 hover:bg-white/5"}`}><LayoutDashboard className="h-4 w-4"/>Dashboard</Link>
    {groups.map(g=>{const expanded=open.has(g.label),active=(g.to&&location.pathname===g.to)||g.items.some(i=>location.pathname.startsWith(i.to)),Icon=g.icon;return <div key={g.label}><div className="flex"><Link to={g.to ?? g.items[0].to} className={`flex flex-1 items-center gap-3 rounded-l px-3 py-2.5 text-sm ${active?"bg-white/10 text-white":"text-white/70 hover:bg-white/5 hover:text-white"}`}><Icon className="h-4 w-4"/><span className="flex-1 text-left">{g.label}</span></Link><button aria-label={`Toggle ${g.label}`} onClick={()=>setOpen(c=>{const n=new Set(c);n.has(g.label)?n.delete(g.label):n.add(g.label);return n})} className={`rounded-r px-2 ${active?"bg-white/10 text-white":"text-white/50 hover:bg-white/5 hover:text-white"}`}><ChevronDown className={`h-4 w-4 transition-transform ${expanded?"rotate-180":""}`}/></button></div>{expanded&&<div className="ml-5 border-l border-white/10 py-1 pl-3">{g.items.map(i=><Link key={`${g.label}-${i.label}`} to={i.to} className={`block rounded px-3 py-2 text-xs ${location.pathname===i.to?"bg-[#25a36f]/20 text-emerald-300":"text-white/50 hover:bg-white/5 hover:text-white"}`}>{i.label}</Link>)}</div>}</div>})}
   </nav>
  </aside>
  <section className="min-w-0"><header className="flex min-h-16 items-center justify-between border-b bg-white px-5 shadow-sm"><div><div className="text-sm font-semibold">Aurona Administration</div><div className="text-xs text-slate-400">Active eCommerce administration</div></div><Link to="/" className="text-sm font-medium text-[#25a36f] hover:underline">Browse Website</Link></header><main className="p-4 sm:p-6"><Outlet/></main></section>
 </div>;
}
