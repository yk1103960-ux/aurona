import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Factory, MapPin, Phone, Mail, Clock, ShieldCheck, Award } from "lucide-react";

export const Route = createFileRoute("/company-information")({
  head: () => ({ meta: [
    { title: "Company Information — Aurona Lighting Industries" },
    { name: "description", content: "Registered office, manufacturing unit, GST, contact and business details of Aurona Lighting Industries." },
    { property: "og:title", content: "Company Information — Aurona" },
    { property: "og:description", content: "Official corporate, manufacturing and contact information for Aurona Lighting Industries." },
  ] }),
  component: CompanyInfoPage,
});

const KV = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
    <div className="text-sm font-medium text-foreground">{value}</div>
  </div>
);

function CompanyInfoPage() {
  return (
    <div className="container-x py-14">
      <div className="mb-6 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link> /{" "}
        <Link to="/about" className="hover:text-foreground">About</Link> /{" "}
        <span className="text-foreground">Company Information</span>
      </div>

      <header className="mx-auto max-w-3xl text-center">
        <div className="text-eyebrow text-primary">Corporate</div>
        <h1 className="text-display mt-3 text-4xl md:text-5xl">Company Information</h1>
        <p className="mt-4 text-muted-foreground">
          Official details of Aurona Lighting Industries — registered entity, manufacturing, certifications and how to reach us.
        </p>
      </header>

      <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KV label="Company Name" value="Aurona Lighting Industries" />
        <KV label="Establishment Year" value="2007" />
        <KV label="Business Type" value="Manufacturer, Wholesaler, OEM Supplier" />
        <KV label="GST Number" value="—" />
        <KV label="CIN" value="—" />
        <KV label="PAN" value="—" />
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <Building2 className="h-6 w-6 text-primary" />
          <h2 className="mt-3 text-xl font-semibold">Registered / Corporate Office</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Aurona Lighting Industries<br />
            Jaipur, Rajasthan, India
          </p>
          <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> +91 96025 70026</div>
            <div className="flex items-center gap-2"><Mail className="h-4 w-4" /> support@auronalighting.com</div>
            <div className="flex items-center gap-2"><Clock className="h-4 w-4" /> Mon – Sat, 10:00 AM – 7:00 PM IST</div>
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <Factory className="h-6 w-6 text-primary" />
          <h2 className="mt-3 text-xl font-semibold">Manufacturing Unit</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Aurona operates an in‑house manufacturing facility in Rajasthan producing LED lighting, ceiling fans and home‑appliance categories under strict quality control.
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" /> Rajasthan, India
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h2 className="mt-3 text-xl font-semibold">Certifications & Compliance</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <li>• BIS / ISI compliant components</li>
            <li>• ISO manufacturing practices</li>
            <li>• RoHS compliant LED drivers</li>
            <li>• GST registered supplier</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <Award className="h-6 w-6 text-primary" />
          <h2 className="mt-3 text-xl font-semibold">Network & Services</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <li>• 1000+ retailers across India</li>
            <li>• Distributor network in 20+ states</li>
            <li>• OEM & private label services</li>
            <li>• Project & institutional supply</li>
          </ul>
        </article>
      </section>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link to="/partner" className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90">Become a Partner</Link>
        <Link to="/contact" className="rounded-full border border-border px-6 py-3 text-sm font-medium hover:bg-card">Contact Us</Link>
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Statutory details (GSTIN / CIN / PAN) will be published once officially confirmed.
      </p>
    </div>
  );
}
