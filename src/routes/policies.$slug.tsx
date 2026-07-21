import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

type Policy = { title: string; sections: { heading: string; body: string }[] };

const POLICIES: Record<string, Policy> = {
  shipping: {
    title: "Shipping Policy",
    sections: [
      { heading: "Coverage", body: "Aurona ships to all serviceable pincodes across India via Shiprocket and partner couriers." },
      { heading: "Timelines", body: "Orders are dispatched within 24–48 hours of confirmation. Metros receive within 2–4 business days; other cities within 3–7 business days." },
      { heading: "Charges", body: "Free shipping on orders above ₹999. Below ₹999, standard shipping charges apply based on weight and destination." },
      { heading: "Tracking", body: "Once dispatched, you'll receive tracking details via email and SMS. You can also track from your account dashboard." },
    ],
  },
  return: {
    title: "Return Policy",
    sections: [
      { heading: "Eligibility", body: "Products can be returned within 7 days of delivery if they are defective, damaged in transit, or not as described." },
      { heading: "Condition", body: "Products must be unused, in original packaging, with all tags and accessories intact." },
      { heading: "Process", body: "Raise a support ticket from Customer Service or your account. Our team will arrange a reverse pickup within 2 business days." },
      { heading: "Non-returnable items", body: "Installed products, customised orders, and clearance items are not eligible for return." },
    ],
  },
  refund: {
    title: "Refund Policy",
    sections: [
      { heading: "Timeline", body: "Refunds are processed within 5–7 business days after we receive and inspect the returned product." },
      { heading: "Mode", body: "Refunds are credited back to the original payment method. Prepaid orders refund to source; COD refunds via bank transfer." },
      { heading: "Deductions", body: "Reverse pickup charges (if applicable) will be deducted from the refund amount for non-defective returns." },
    ],
  },
  warranty: {
    title: "Warranty Policy",
    sections: [
      { heading: "Coverage", body: "All Aurona products carry a manufacturer warranty against manufacturing defects. Warranty period varies by product and is mentioned on the product page." },
      { heading: "Claim process", body: "Raise a support ticket with your order ID, product photos, and issue description. Approved claims are replaced or repaired within 5–10 business days." },
      { heading: "Exclusions", body: "Warranty does not cover damage from misuse, unauthorised modification, power surges, water damage, or normal wear and tear." },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      { heading: "Data we collect", body: "We collect name, contact, address, and order information necessary to process your purchases. Business documents (GST, PAN, etc.) are collected only from partners." },
      { heading: "How we use it", body: "To process orders, provide support, send transactional communications, and (with your consent) marketing updates." },
      { heading: "Sharing", body: "We share data only with courier partners, payment processors, and authorised service providers. We never sell your data." },
      { heading: "Security", body: "All data is encrypted in transit (HTTPS) and at rest. Access is restricted to authorised personnel." },
      { heading: "Your rights", body: "You can request access, correction, or deletion of your data by writing to support." },
    ],
  },
  terms: {
    title: "Terms & Conditions",
    sections: [
      { heading: "Acceptance", body: "By using this website you agree to these terms. If you disagree with any part, please do not use the site." },
      { heading: "Products", body: "We strive for accurate product descriptions and images. Colours may vary slightly due to display settings and lighting." },
      { heading: "Pricing", body: "Prices are in INR and inclusive of GST unless stated. Retailer/distributor pricing is unlocked only after approval." },
      { heading: "Orders", body: "We reserve the right to cancel any order due to stock, pricing errors, or suspected fraud." },
      { heading: "Governing law", body: "These terms are governed by the laws of India. Any disputes are subject to the exclusive jurisdiction of the courts of Jaipur, Rajasthan." },
    ],
  },
};

export const Route = createFileRoute("/policies/$slug")({
  loader: ({ params }) => { if (!(params.slug in POLICIES)) throw notFound(); },
  head: ({ params }) => {
    const p = POLICIES[params.slug];
    if (!p) return {};
    return { meta: [
      { title: `${p.title} — Aurona` },
      { name: "description", content: `${p.title} for Aurona Lighting Industries.` },
    ] };
  },
  notFoundComponent: () => (
    <div className="container-x py-24 text-center">
      <h1 className="text-display text-3xl">Policy not found</h1>
      <Button asChild className="mt-6"><Link to="/customer-service">Back to support</Link></Button>
    </div>
  ),
  component: PolicyPage,
});

function PolicyPage() {
  const { slug } = Route.useParams();
  const policy = POLICIES[slug];
  return (
    <div className="container-x py-12">
      <div className="mb-6 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link> /{" "}
        <Link to="/customer-service" className="hover:text-foreground">Customer Service</Link> /{" "}
        <span className="text-foreground">{policy.title}</span>
      </div>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-display text-4xl">{policy.title}</h1>
        <div className="mt-2 text-xs text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</div>
        <div className="mt-8 space-y-8">
          {policy.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-xl font-semibold">{s.heading}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
