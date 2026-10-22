import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Store, Users } from "lucide-react";

const ROOT = "/aurona-console-9f2x7k";

export const Route = createFileRoute('/aurona-console-9f2x7k/customers-legacy')({ component: CustomersEntry });

function CustomersEntry() {
  const sections = [
    {
      title: "Customer List",
      description: "Manage customer, retailer and distributor accounts, verification, blocking, account details and login activity.",
      to: `${ROOT}/customers`,
      icon: Users,
    },
    {
      title: "Retailer / Distributor Applications",
      description: "Review partner applications and onboarding status for wholesale buyer accounts.",
      to: `${ROOT}/applications`,
      icon: Store,
    },
    {
      title: "Security & Verification",
      description: "Customer verification, OTP reset, account access and security controls are available inside Customer List.",
      to: `${ROOT}/customers`,
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="border-b bg-white px-5 py-4 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-800">Customers</h1>
        <p className="mt-1 text-sm text-slate-500">Customer and wholesale partner administration.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {sections.map(({ title, description, to, icon: Icon }) => (
          <Link key={title} to={to} className="group rounded border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#25a36f] hover:shadow-md">
            <div className="mb-4 flex items-center justify-between">
              <div className="grid h-10 w-10 place-items-center rounded bg-emerald-50 text-[#25a36f]"><Icon className="h-5 w-5" /></div>
              <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#25a36f]" />
            </div>
            <div className="font-semibold text-slate-800">{title}</div>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
