import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

const JOBS = [
  { t: "Production Engineer", d: "Manufacturing", loc: "Delhi NCR", type: "Full-time" },
  { t: "Retail Sales Manager", d: "Sales", loc: "Mumbai", type: "Full-time" },
  { t: "Product Designer", d: "Design", loc: "Bangalore", type: "Full-time" },
  { t: "Warehouse Executive", d: "Operations", loc: "Chennai", type: "Full-time" },
];

export const Route = createFileRoute("/careers")({
  head: () => ({ meta: [{ title: "Careers — Aurona" }] }),
  component: () => (
    <div className="container-x py-16">
      <div className="text-eyebrow">Careers</div>
      <h1 className="text-display mt-3 max-w-3xl text-5xl">Build the future of lighting with us.</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        We're always looking for engineers, designers, and operators who want to build serious products for modern India.
      </p>
      <div className="mt-12 space-y-3">
        {JOBS.map((j) => (
          <div key={j.t} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-5">
            <div>
              <div className="font-semibold">{j.t}</div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{j.d}</span>
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {j.loc}</span>
                <span>{j.type}</span>
              </div>
            </div>
            <Button size="sm" className="rounded-full">Apply</Button>
          </div>
        ))}
      </div>
    </div>
  ),
});
