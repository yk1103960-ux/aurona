import { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, HelpCircle } from "lucide-react";

export type Faq = { q: string; a: string };
export type FaqCategory = { title: string; items: Faq[] };

export const AURONA_FAQS: Faq[] = [
  {
    q: "Are Aurona products certified?",
    a: "Yes, Aurona Lighting products are manufactured with a strong focus on quality, reliability, and applicable industry standards.",
  },
  {
    q: "What products does Aurona Lighting Industries manufacture?",
    a: "Aurona Lighting Industries manufactures a wide range of LED lighting products and energy-efficient lighting solutions.",
  },
  {
    q: "Do you offer customized lighting solutions?",
    a: "Yes, we provide customized lighting solutions based on specific project requirements and customer needs.",
  },
  {
    q: "Are your products energy-efficient?",
    a: "Yes, our LED lighting solutions are designed to deliver excellent performance while helping reduce energy consumption.",
  },
  {
    q: "How can I purchase Aurona Lighting products?",
    a: "You can purchase our products through our authorized dealers, distributors, online store, or by contacting our sales team.",
  },
  {
    q: "Can I return an Aurona product?",
    a: "Returns are subject to our applicable return policy and product condition. Please contact our support team for assistance.",
  },
  {
    q: "What is the warranty period for Aurona products?",
    a: "Warranty coverage varies depending on the specific product category and model.",
  },
  {
    q: "How do I maintain my Aurona lighting and home appliances?",
    a: "Regular cleaning, proper installation, and following the product usage instructions will help maintain product performance and lifespan.",
  },
];

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    title: "Products & Services",
    items: [
      {
        q: "What products does Aurona Lighting Industries manufacture?",
        a: "Aurona Lighting Industries manufactures a wide range of LED lighting products, ceiling fans, exhaust fans, water heaters, room heaters, and other energy-efficient home appliances.",
      },
      {
        q: "Are Aurona products certified?",
        a: "Yes, Aurona products are manufactured in compliance with applicable Indian and international quality standards. Each product carries relevant certifications such as BEE star ratings, ISI marks, and safety approvals where applicable.",
      },
      {
        q: "Do you offer customized lighting solutions?",
        a: "Yes, we provide customized lighting solutions for homes, offices, showrooms, and large commercial projects. Contact our sales team with your requirements for a tailored proposal.",
      },
      {
        q: "Are your products energy-efficient?",
        a: "Yes, our LED lighting solutions and BEE-rated appliances are designed to deliver excellent performance while helping reduce energy consumption and electricity bills.",
      },
    ],
  },
  {
    title: "Purchasing & Returns",
    items: [
      {
        q: "How can I purchase Aurona lighting products?",
        a: "You can purchase our products through our authorized dealers, distributors, the Aurona online store, or by contacting our sales team directly for bulk or project orders.",
      },
      {
        q: "Can I return an Aurona product?",
        a: "Returns are accepted as per our return policy. Products must be unused, in original packaging, and returned within the specified window. Please contact support to initiate a return.",
      },
      {
        q: "What is Aurona's refund policy?",
        a: "Refunds are processed after the returned product is inspected and approved. The refund is credited to the original payment method within 5-10 business days, depending on your bank or payment provider.",
      },
    ],
  },
  {
    title: "Warranty & Maintenance",
    items: [
      {
        q: "What is the warranty period for Aurona products?",
        a: "Warranty coverage varies by product category and model. Standard warranty details are mentioned on the product packaging and invoice. For exact terms, please check the product page or contact support.",
      },
      {
        q: "What is covered under the warranty?",
        a: "Warranty covers manufacturing defects and workmanship issues under normal use. It does not cover physical damage, improper installation, unauthorized repairs, or wear and tear due to misuse.",
      },
      {
        q: "How do I maintain my Aurona products?",
        a: "Regular cleaning with a soft, dry cloth, proper installation, voltage protection, and following the product usage instructions will help maintain performance and extend product life.",
      },
    ],
  },
  {
    title: "Customer Support",
    items: [
      {
        q: "What should I do if I experience issues?",
        a: "If you face any issue with a product, first refer to the user manual. If the issue persists, raise a support ticket on our customer service page or contact us via WhatsApp, email, or phone.",
      },
      {
        q: "How can I contact Aurona Lighting Industries?",
        a: "You can reach us through phone, WhatsApp, email at auronalighting@gmail.com, or by submitting a support ticket on this page. Our team typically responds within 24 hours.",
      },
      {
        q: "Can I track my return or refund request?",
        a: "Yes, once a return or refund request is approved, you will receive a reference number. You can use this number to track status by contacting our support team or checking your account dashboard.",
      },
    ],
  },
  {
    title: "Careers & Partnerships",
    items: [
      {
        q: "How can I apply for a career?",
        a: "Visit our Careers page to view open positions and submit your application along with your resume. You can also reach out through our referral program.",
      },
      {
        q: "What benefits can I expect when working here?",
        a: "Aurona offers a supportive work environment, growth opportunities, competitive compensation, and a culture focused on innovation, quality, and teamwork.",
      },
      {
        q: "Does Aurona offer internships or part-time jobs?",
        a: "We periodically offer internships and part-time roles in sales, marketing, operations, and engineering. Check our Careers page for current openings.",
      },
      {
        q: "How can I become a distributor or partner?",
        a: "You can apply to become a retailer or distributor through the Partner Registration section on our website. After verification and approval, you will receive access to partner pricing and benefits.",
      },
      {
        q: "What career opportunities are available?",
        a: "We regularly hire across functions including sales, marketing, product management, engineering, operations, and customer support. Visit our Careers page for the latest listings.",
      },
    ],
  },
  {
    title: "Company Information",
    items: [
      {
        q: "Where is Aurona Lighting Industries located?",
        a: "Aurona Lighting Industries is based in Rajasthan, India, with our manufacturing and operations located in Neem Ka Thana, Sikar, Rajasthan.",
      },
      {
        q: "Does Aurona offer international shipping?",
        a: "Currently, our primary focus is serving customers across India through our dealer network and online store. For international or bulk export inquiries, please contact our sales team.",
      },
    ],
  },
];

/**
 * Frequently Asked Questions — centered heading with a blue underline and two
 * white accordion cards (4 questions each). Only one item stays open at a time.
 */
export function FaqSection({ faqs = AURONA_FAQS }: { faqs?: Faq[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const half = Math.ceil(faqs.length / 2);
  const groups = [faqs.slice(0, half), faqs.slice(half)].filter((g) => g.length > 0);

  return (
    <section className="border-t border-border bg-surface/40 py-14 sm:py-20">
      <div className="container-x">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-[34px] sm:leading-tight">
            Frequently Asked Questions
          </h2>
          <span className="mx-auto mt-4 block h-[3px] w-16 rounded-full bg-primary" aria-hidden />
        </div>

        <div className="mx-auto mt-10 grid max-w-6xl gap-6 lg:grid-cols-2 lg:gap-8">
          {groups.map((group, gi) => (
            <div
              key={gi}
              className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]"
            >
              {group.map((f, i) => {
                const idx = gi * half + i;
                const open = openIdx === idx;
                return (
                  <div key={f.q} className={cn(i > 0 && "border-t border-border")}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenIdx(open ? null : idx)}
                      className={cn(
                        "flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors sm:px-6 sm:py-5",
                        open ? "text-primary" : "text-foreground hover:text-primary",
                      )}
                    >
                      <span className="text-[14.5px] font-semibold leading-snug sm:text-[15.5px]">{f.q}</span>
                      <Plus
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform duration-300",
                          open ? "rotate-45 text-primary" : "text-muted-foreground",
                        )}
                        strokeWidth={2.2}
                      />
                    </button>
                    <div
                      className={cn(
                        "grid transition-all duration-300 ease-out",
                        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                      )}
                    >
                      <div className="overflow-hidden">
                        <p className="px-5 pb-5 text-[13.5px] leading-relaxed text-muted-foreground sm:px-6 sm:pb-6 sm:text-sm">
                          {f.a}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Full FAQ directory page layout with category cards, search, and accordions.
 * Matches the reference: breadcrumb, hero heading, category grid.
 */
export function FaqDirectory({ categories = FAQ_CATEGORIES }: { categories?: FaqCategory[] }) {
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const filtered = categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (f) =>
          f.q.toLowerCase().includes(query.toLowerCase()) ||
          f.a.toLowerCase().includes(query.toLowerCase()),
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  const allCount = categories.reduce((acc, cat) => acc + cat.items.length, 0);

  return (
    <section className="bg-background py-12 sm:py-16">
      <div className="container-x">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-muted-foreground">
            <li>
              <a href="/" className="hover:text-foreground transition-colors">Home</a>
            </li>
            <li aria-hidden>/</li>
            <li className="text-foreground font-medium">FAQ</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Frequently Asked Questions
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            Find answers to common questions about Aurona Lighting Industries
          </p>
        </div>

        {/* Search hero */}
        <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
          <div className="flex items-center justify-center gap-3">
            <HelpCircle className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold text-foreground sm:text-2xl">How can we help you?</h2>
          </div>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Browse through our comprehensive FAQ section to find quick answers to your questions about our products, services, and company.
          </p>
          <div className="relative mt-5">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for answers..."
              className="h-12 w-full rounded-xl border border-input bg-background pl-4 pr-12 text-sm outline-none ring-primary transition focus:ring-2"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {query ? `${filtered.reduce((acc, c) => acc + c.items.length, 0)} results` : `${allCount} articles across ${categories.length} topics`}
          </p>
        </div>

        {/* Categories */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((cat) => (
            <div
              key={cat.title}
              className="rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:shadow-lift sm:p-6"
            >
              <h3 className="text-lg font-semibold text-foreground">{cat.title}</h3>
              <span className="mt-1 block text-xs text-muted-foreground">{cat.items.length} questions</span>
              <div className="mt-4 space-y-2">
                {cat.items.map((f) => {
                  const key = `${cat.title}::${f.q}`;
                  const open = openKey === key;
                  return (
                    <div key={key} className="rounded-xl border border-border bg-background overflow-hidden">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setOpenKey(open ? null : key)}
                        className={cn(
                          "flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm font-medium transition-colors",
                          open ? "text-primary bg-primary/5" : "text-foreground hover:text-primary hover:bg-surface/50"
                        )}
                      >
                        <span className="leading-snug">{f.q}</span>
                        <Plus
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0 transition-transform duration-300",
                            open ? "rotate-45 text-primary" : "text-muted-foreground"
                          )}
                          strokeWidth={2.2}
                        />
                      </button>
                      <div
                        className={cn(
                          "grid transition-all duration-300 ease-out",
                          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                        )}
                      >
                        <div className="overflow-hidden">
                          <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
                            {f.a}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-12 text-center text-muted-foreground">
            No questions found for "{query}". Try a different keyword or contact support.
          </div>
        )}
      </div>
    </section>
  );
}
