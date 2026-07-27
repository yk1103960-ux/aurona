import { createFileRoute, Link } from "@tanstack/react-router";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/aurona-console-9f2x7k/coupons")({
  component: () => <SoonPage title="Coupons & Offers" desc="Discount codes, seasonal offers, flash sales — arriving in Phase 2." />,
});

export function SoonPage({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <Construction className="w-10 h-10 mx-auto text-amber-500 mb-3" />
        <div className="font-semibold">Coming in Phase 2</div>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{desc}</p>
        <Link to="/aurona-console-9f2x7k" className="inline-block mt-4 text-sm text-sky-600 hover:underline">← Back to dashboard</Link>
      </div>
    </div>
  );
}
