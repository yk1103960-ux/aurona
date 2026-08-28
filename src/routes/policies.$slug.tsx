import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

type Section = { heading: string; body: string; bullets?: string[] };
type Policy = { title: string; intro?: string; sections: Section[] };

const POLICIES: Record<string, Policy> = {
  shipping: {
    title: "Shipping Policy",
    intro: "How we dispatch, ship and deliver Aurona orders across India.",
    sections: [
      { heading: "Coverage", body: "Aurona ships to all serviceable pincodes across India via Shiprocket and partner couriers (Delhivery, Bluedart, XpressBees, DTDC, India Post)." },
      { heading: "Dispatch Timelines", body: "Orders are dispatched within 24–48 business hours of confirmation. Bulk B2B orders may take 3–5 days for QC and palletisation." },
      { heading: "Delivery Timelines", body: "Metros: 2–4 business days. Tier‑2 cities: 3–6 business days. Remote pincodes: 5–10 business days from dispatch." },
      { heading: "Shipping Charges", body: "Free shipping on retail orders above ₹999. Below ₹999, standard charges apply based on weight, dimensions and destination. B2B / partner orders follow contracted freight terms." },
      { heading: "Order Tracking", body: "Once dispatched, tracking details are shared via email, SMS and WhatsApp. You can also track live status from your account dashboard." },
      { heading: "Undelivered / Failed Delivery", body: "If a courier is unable to deliver after 3 attempts, the order is returned to origin. Re‑dispatch charges may apply. Please keep your phone reachable during the delivery window." },
      { heading: "International Shipping", body: "We currently ship only within India. For export enquiries, please write to sales@auronalighting.com." },
    ],
  },
  return: {
    title: "Return & Replacement Policy",
    intro: "Aurona stands behind every product we manufacture. Here is exactly what you can return, replace, and how.",
    sections: [
      { heading: "Return Window", body: "Return requests must be raised within 7 days of delivery. Warranty claims are handled separately under the Warranty Policy." },
      { heading: "Return Eligibility", body: "You may return a product if:", bullets: [
        "It is damaged in transit",
        "It has a manufacturing defect",
        "The wrong product / SKU was delivered",
        "The product is materially different from what was described",
      ]},
      { heading: "Replacement Eligibility", body: "Replacements are offered for damaged, defective or wrong products, subject to stock availability. If the exact SKU is unavailable, a full refund is issued." },
      { heading: "Condition of Returned Items", body: "Products must be unused, in the original packaging, with all tags, cables, remotes, drivers, warranty cards and accessories intact." },
      { heading: "Non‑Returnable Products", body: "The following are not eligible for return:", bullets: [
        "Installed / wired products",
        "Customised or made‑to‑order SKUs",
        "Bulk B2B / project orders (unless defective)",
        "Clearance and last‑piece items",
        "Products damaged due to misuse, unauthorised modification or power surge",
      ]},
      { heading: "Reverse Pickup", body: "Once a return is approved, our team schedules a reverse pickup within 2 business days. In pincodes where reverse pickup is unavailable, you may self‑ship and we will reimburse standard courier charges against a receipt." },
      { heading: "Inspection Process", body: "Every returned product is inspected at our warehouse for tampering, missing parts and reported issue. Inspection typically takes 24–48 hours after receipt." },
      { heading: "Refund Timeline", body: "Approved refunds are initiated within 24–48 hours of inspection and reflect in the source account within 5–7 business days." },
      { heading: "How to Raise a Return", body: "Go to My Account → Orders → Return, or raise a ticket via Customer Service with your order ID and photos/video of the issue." },
    ],
  },
  refund: {
    title: "Refund Policy",
    intro: "How refunds are processed once a return, cancellation or warranty claim is approved.",
    sections: [
      { heading: "Refund Eligibility", body: "Refunds are issued for approved returns, cancelled orders, failed deliveries and warranty claims where a replacement is unavailable." },
      { heading: "Refund Timeline", body: "Refunds are initiated within 24–48 hours of approval. Reflection in your account depends on your bank / payment method (typically 5–7 business days)." },
      { heading: "Refund Method", body: "Prepaid orders are refunded to the original payment source. COD orders are refunded via UPI or NEFT bank transfer to the account details you provide." },
      { heading: "Deductions", body: "For non‑defective returns, reverse pickup charges (if applicable) and payment gateway fees may be deducted." },
      { heading: "Cancellation Refunds", body: "Orders cancelled before dispatch are refunded in full. Cancellations after dispatch are treated as returns." },
      { heading: "Failed / Delayed Refunds", body: "If you don't see the refund within 10 business days of initiation, please share your order ID and payment reference with support and we will trace it with the payment partner." },
    ],
  },
  warranty: {
    title: "Warranty Policy",
    intro: "Every Aurona product carries a manufacturer warranty against genuine manufacturing defects.",
    sections: [
      { heading: "Warranty Coverage", body: "Warranty period varies by product category (typically 1–3 years) and is printed on the product page and warranty card. Warranty covers manufacturing defects in materials and workmanship only." },
      { heading: "How to Claim", body: "Raise a support ticket with your order ID, product photos/video, invoice and a short description of the issue. Our team responds within 24–48 business hours." },
      { heading: "Resolution", body: "Approved claims are resolved via repair, replacement of parts, or full replacement — whichever is applicable. Turnaround is typically 5–10 business days after the unit reaches our service centre." },
      { heading: "Exclusions", body: "Warranty does NOT cover:", bullets: [
        "Damage from misuse, negligence or accident",
        "Unauthorised modification or repair",
        "Power surge, lightning or incorrect voltage",
        "Water, moisture or corrosion damage",
        "Normal wear and tear (yellowing of diffusers, driver aging beyond rated hours, etc.)",
        "Products without proof of purchase",
      ]},
      { heading: "Out‑of‑Warranty Service", body: "Paid repair service is available for out‑of‑warranty products at nominal charges. Please contact support for a quote." },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    intro: "Your privacy is important to us. This policy explains what we collect, why, and your rights.",
    sections: [
      { heading: "Information We Collect", body: "We collect information you provide directly (name, email, phone, shipping address, GST/PAN for partners) and information collected automatically (device, browser, IP, pages visited, cart events)." },
      { heading: "Cookies & Analytics", body: "We use first‑ and third‑party cookies for session management, cart persistence, analytics (page views, conversions) and — with your consent — marketing. You can disable cookies in your browser settings." },
      { heading: "How We Use Your Data", body: "To process orders and payments, provide customer support, prevent fraud, comply with tax/legal obligations, improve our website, and — with your consent — send marketing communications." },
      { heading: "Payment Security", body: "We do not store card / UPI credentials on our servers. All payments are processed by PCI‑DSS compliant gateway partners over encrypted (HTTPS/TLS) connections." },
      { heading: "Data Sharing", body: "Data is shared only with:", bullets: [
        "Courier partners (name, address, phone) for delivery",
        "Payment processors for transactions",
        "Tax authorities where legally required",
        "Authorised service providers under confidentiality agreements",
      ]},
      { heading: "Data Retention", body: "Order and invoice data is retained as required by Indian tax and company law (typically 8 years). Marketing data is retained until you unsubscribe." },
      { heading: "Your Rights", body: "You can request access, correction, export or deletion of your data by writing to privacy@auronalighting.com. Account deletion removes personal data but retains anonymised transaction records for legal compliance." },
      { heading: "Children's Privacy", body: "Aurona is not directed at children under 13 and we do not knowingly collect data from them." },
      { heading: "Policy Updates", body: "We may update this policy from time to time. Material changes will be notified via email or a website banner." },
      { heading: "Contact", body: "For privacy queries: privacy@auronalighting.com" },
    ],
  },
  terms: {
    title: "Terms & Conditions",
    intro: "Please read these terms carefully before using auronalighting.com. By accessing the site you agree to these terms.",
    sections: [
      { heading: "Acceptance of Terms", body: "By browsing, registering or purchasing, you agree to be bound by these Terms, our Privacy Policy and all applicable laws of India." },
      { heading: "Eligibility", body: "You must be at least 18 years of age (or have consent of a parent/guardian) to place an order. Partner (retailer/distributor) accounts require valid GST and business documents." },
      { heading: "User Accounts", body: "You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account. Notify us immediately of any unauthorised access." },
      { heading: "Product Information", body: "We strive for accurate product descriptions, specifications and images. Actual colour, finish and light output may vary slightly due to display, lighting and manufacturing tolerances." },
      { heading: "Pricing & Taxes", body: "Prices are in INR and inclusive of GST unless stated otherwise. Retailer and distributor pricing is unlocked only after partner account approval. We reserve the right to correct pricing errors before dispatch." },
      { heading: "Order Acceptance", body: "An order is confirmed only when we send an order confirmation email. We may cancel or refuse an order due to stock, pricing errors, suspected fraud or delivery restrictions." },
      { heading: "Cancellation", body: "Orders may be cancelled before dispatch from your account dashboard. Post‑dispatch cancellations are treated as returns and follow the Return Policy." },
      { heading: "Payment Methods", body: "We accept UPI, credit/debit cards, net banking, popular wallets and COD (within limits). Payment failures are automatically refunded to the source." },
      { heading: "Shipping & Delivery", body: "Governed by our Shipping Policy. Risk of loss passes to the customer once the courier hands over the shipment at the delivery address." },
      { heading: "Warranty, Returns & Refunds", body: "Governed by the Warranty, Return and Refund Policies respectively." },
      { heading: "Intellectual Property", body: "All content, product designs, photography, logos and trademarks on this website are the property of Aurona Lighting Industries or its licensors and may not be reproduced without written permission." },
      { heading: "User Responsibilities", body: "You agree not to misuse the site, attempt unauthorised access, upload malicious code, scrape data at scale, or use the site for any unlawful purpose." },
      { heading: "Third‑Party Links", body: "The site may link to third‑party websites. Aurona is not responsible for the content, policies or practices of any third party." },
      { heading: "Limitation of Liability", body: "To the maximum extent permitted by law, Aurona's liability is limited to the value of the specific product or order in question. We are not liable for indirect, consequential or incidental damages." },
      { heading: "Force Majeure", body: "We are not liable for failure or delay due to events beyond our reasonable control including natural disasters, strikes, pandemics, government action and courier disruptions." },
      { heading: "Governing Law & Jurisdiction", body: "These Terms are governed by the laws of India. Any disputes are subject to the exclusive jurisdiction of the courts of Jaipur, Rajasthan." },
      { heading: "Dispute Resolution", body: "Parties will attempt in good faith to resolve any dispute through discussion within 30 days before initiating legal proceedings." },
      { heading: "Contact", body: "For questions about these Terms: legal@auronalighting.com" },
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
      { name: "description", content: `${p.title} for Aurona Lighting Industries. ${p.intro ?? ""}`.trim() },
      { property: "og:title", content: `${p.title} — Aurona` },
      { property: "og:description", content: p.intro ?? p.title },
    ] };
  },
  notFoundComponent: () => (
    <div className="container-x py-24 text-center">
      <h1 className="text-display text-3xl">Policy not found</h1>
      <Button asChild className="mt-6"><Link to="/faq">Back to support</Link></Button>
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
        <Link to="/faq" className="hover:text-foreground">Customer Service</Link> /{" "}
        <span className="text-foreground">{policy.title}</span>
      </div>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-display text-4xl md:text-5xl">{policy.title}</h1>
        {policy.intro && <p className="mt-4 text-base leading-relaxed text-muted-foreground">{policy.intro}</p>}
        <div className="mt-2 text-xs text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" })}</div>
        <div className="mt-10 space-y-8">
          {policy.sections.map((s, i) => (
            <section key={s.heading} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">
                <span className="mr-2 text-primary">{String(i + 1).padStart(2, "0")}.</span>
                {s.heading}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              {s.bullets && (
                <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{b}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild variant="outline"><Link to="/faq">Back to Customer Service</Link></Button>
          <Button asChild><Link to="/contact">Contact Support</Link></Button>
        </div>
      </div>
    </div>
  );
}
