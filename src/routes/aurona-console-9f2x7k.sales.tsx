import { createFileRoute, Link } from "@tanstack/react-router";
import { LegacyModulePage } from "@/components/admin/ecommain/LegacyModulePage";

const ROOT = "/aurona-console-9f2x7k";

export const Route = createFileRoute('/aurona-console-9f2x7k/sales')({
  component: SalesPage,
});

function SalesPage() {
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2 text-sm">
      <Link to={`${ROOT}/orders`} className="rounded bg-[#25b990] px-3 py-2 text-white">All Orders</Link>
      <Link to={`${ROOT}/orders`} search={{ status: 'pending' } as never} className="rounded border bg-white px-3 py-2">Pending Orders</Link>
      <Link to={`${ROOT}/payments`} className="rounded border bg-white px-3 py-2">Payments</Link>
    </div>
    <LegacyModulePage title="Sales" description="Original Ecommain order and sales management workspace." columns={["#","Order Code","Customer","Amount","Delivery Status","Payment Status","Date","Options"]} actions={[]}/>
  </div>;
}
