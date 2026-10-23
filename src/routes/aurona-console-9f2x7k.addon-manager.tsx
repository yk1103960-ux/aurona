import { createFileRoute, Link } from "@tanstack/react-router";
import { Plug, CreditCard, Truck, MessageSquare, Cloud, ShieldCheck } from "lucide-react";

const R = "/aurona-console-9f2x7k";

export const Route = createFileRoute("/aurona-console-9f2x7k/addon-manager")({
  component: IntegrationShortcuts,
});
const addons = [
  [
    "Payment Providers",
    "Gateway and payment-service integrations.",
    `${R}/payment-gateways`,
    CreditCard,
  ],
  [
    "Shipping & Logistics",
    "Shipping rules and logistics integrations including supported fulfilment services.",
    `${R}/shipping`,
    Truck,
  ],
  [
    "Messaging & Notifications",
    "Email, SMS and supported communication integrations.",
    `${R}/integrations`,
    MessageSquare,
  ],
  [
    "Storage & Services",
    "Supported storage and external service integrations.",
    `${R}/integrations`,
    Cloud,
  ],
  [
    "Security Integrations",
    "Authentication and security configuration.",
    `${R}/security`,
    ShieldCheck,
  ],
  ["All Integrations", "View the connected integration workspace.", `${R}/integrations`, Plug],
] as const;
function IntegrationShortcuts() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Integration Shortcuts</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Configure connected payment, shipping, messaging, storage, and security services in
          Aurona. Credentials stay in the server-side integration settings.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {addons.map(([name, desc, to, Icon]) => (
          <Link
            key={name}
            to={to}
            className="rounded-md border bg-white p-5 shadow-sm hover:border-emerald-300"
          >
            <Icon className="mb-3 h-5 w-5 text-emerald-700" />
            <div className="font-semibold">{name}</div>
            <p className="mt-1 text-sm text-slate-500">{desc}</p>
            <div className="mt-4 text-xs font-semibold text-emerald-700">Manage integrations</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
