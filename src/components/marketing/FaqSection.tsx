import { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

export type Faq = { q: string; a: string };

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
