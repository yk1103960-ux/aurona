import { createFileRoute, Link } from "@tanstack/react-router";
import { LegacyModulePage } from "@/components/admin/ecommain/LegacyModulePage";
const ROOT='/aurona-console-9f2x7k';
export const Route=createFileRoute('/aurona-console-9f2x7k/customers-legacy')({component:CustomersLegacy});
function CustomersLegacy(){return <div className="space-y-4"><div className="flex flex-wrap gap-2 text-sm"><Link to={`${ROOT}/customers`} className="rounded bg-[#25b990] px-3 py-2 text-white">Customer List</Link><Link to={`${ROOT}/applications`} className="rounded border bg-white px-3 py-2">Retailer / Distributor Applications</Link></div><LegacyModulePage title="Customers" description="Customer, retailer and distributor account administration." columns={["#","Name","Email / Phone","Customer Type","Status","Orders","Created","Options"]} actions={["Add Customer"]}/></div>}
