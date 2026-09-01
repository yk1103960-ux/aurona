import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Gift, Users, IndianRupee, Share2, BadgeCheck, Briefcase, Handshake, Store, Crown, Globe, Megaphone, Package, CalendarClock } from "lucide-react";
import { careersQuery, jobAnchor, isClosed, formatCloseDate } from "@/lib/careers";
import { referralProgramsQuery, commissionLabel } from "@/lib/referral-programs";
import { ApplyDialog, type ApplyTarget } from "@/components/careers/ApplyDialog";

const PROGRAM_ICONS = [Handshake, Store, Share2, Crown, Globe, Megaphone, Package];


const STEPS = [
  "Pick a program and submit your application or profile",
  "Our partnerships team verifies your details and gets in touch",
  "Start earning through margins, commissions or rewards",
];

export const Route = createFileRoute("/careers")({
  head: () => ({
    meta: [
      { title: "Careers & Referral Programs — Aurona Lighting" },
      {
        name: "description",
        content:
          "Join Aurona Lighting or earn through our referral programs — candidate, retailer, customer and distributor referrals with cash and credit rewards.",
      },
      { property: "og:title", content: "Careers & Referral Programs — Aurona Lighting" },
      {
        property: "og:description",
        content: "Open roles across manufacturing, sales and design, plus four ways to earn through Aurona referrals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CareersPage,
});

function CareersPage() {
  const { data: jobs = [], isLoading } = useQuery(careersQuery);
  const { data: referrals = [] } = useQuery(referralProgramsQuery);
  const openings = jobs.filter((j) => j.kind === "job");
  const programs = jobs.filter((j) => j.kind !== "job");
  return (
    <div className="container-x py-16">
      <div className="text-eyebrow">Careers</div>
      <h1 className="text-display mt-3 max-w-3xl text-5xl">Build the future of lighting with us.</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        We're always looking for engineers, designers, and operators who want to build serious products for modern India.
      </p>

      <div className="mt-12 space-y-3">
        {isLoading && <div className="rounded-xl border border-border p-5 text-sm text-muted-foreground">Loading open roles…</div>}
        {!isLoading && openings.length === 0 && (
          <div className="rounded-xl border border-border p-5 text-sm text-muted-foreground">
            No open positions right now. Write to us and we'll keep your profile on file.
          </div>
        )}
        {openings.map((j) => {
          const href = applyHref(j);
          const closed = isClosed(j);
          const closeDate = formatCloseDate(j.closes_at);
          return (
            <div
              key={j.id}
              id={jobAnchor(j.id)}
              className={"scroll-mt-28 rounded-xl border border-border p-5 transition hover:shadow-lift" + (closed ? " opacity-60" : "")}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold">
                    <Briefcase className="h-4 w-4 shrink-0 text-primary" /> {j.title}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {j.department && <span>{j.department}</span>}
                    {j.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {j.location}</span>}
                    {j.employment_type && <span>{j.employment_type}</span>}
                    {closeDate && (
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" /> {closed ? `Closed on ${closeDate}` : `Apply by ${closeDate}`}
                      </span>
                    )}
                  </div>
                </div>
                {closed ? (
                  <span className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                    Applications closed
                  </span>
                ) : href ? (
                  <Button asChild size="sm" className="rounded-full">
                    <a href={href} target={j.apply_url ? "_blank" : undefined} rel="noopener noreferrer">Apply</a>
                  </Button>
                ) : (
                  <Button asChild size="sm" className="rounded-full">
                    <a href="/contact">Apply</a>
                  </Button>
                )}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{j.description}</p>
              {j.eligibility && <p className="mt-2 text-xs text-muted-foreground"><b>Eligibility:</b> {j.eligibility}</p>}
            </div>
          );
        })}
      </div>

      {/* Partner programs */}
      <section className="mt-20">
        <div className="text-eyebrow">Partner Programs</div>
        <h2 className="text-display mt-3 max-w-3xl text-4xl">Grow with Aurona — seven ways to partner.</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Sales, reselling, referrals, loyalty, online distribution, affiliate marketing and custom solutions — pick the
          program that fits you and start earning with Aurona.
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {programs.map((r, i) => {
            const Icon = PROGRAM_ICONS[i % PROGRAM_ICONS.length];
            return (
              <div key={r.id} id={jobAnchor(r.id)} className="scroll-mt-28 rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex items-start justify-between gap-4">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  {r.reward && (
                    <span className="rounded-full bg-primary/8 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                      {r.reward}
                    </span>
                  )}
                </div>
                <h3 className="text-display mt-5 text-2xl">{r.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>
                {r.eligibility && <p className="mt-2 text-xs text-muted-foreground"><b>Who can join:</b> {r.eligibility}</p>}
              </div>
            );
          })}
        </div>

        {referrals.length > 0 && (
          <div className="mt-12">
            <div className="text-eyebrow">Referral rewards</div>
            <h3 className="text-display mt-2 text-3xl">Current referral programs</h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {referrals.map((p) => (
                <div key={p.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-gold/10 text-gold">
                      <Gift className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    <span className="rounded-full bg-primary/8 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                      {commissionLabel(p)}
                    </span>
                  </div>
                  <h4 className="mt-4 text-lg font-semibold">{p.name}</h4>
                  {p.description && <p className="mt-1.5 text-sm text-muted-foreground">{p.description}</p>}
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {Number(p.min_order_value) > 0 && (
                      <li className="flex items-center gap-1.5">
                        <IndianRupee className="h-3 w-3" /> Minimum order ₹{Number(p.min_order_value)}
                      </li>
                    )}
                    {p.eligibility && (
                      <li className="flex items-start gap-1.5">
                        <Users className="mt-0.5 h-3 w-3 shrink-0" /> {p.eligibility}
                      </li>
                    )}
                    {p.closes_at && (
                      <li className="flex items-center gap-1.5">
                        <CalendarClock className="h-3 w-3" /> Open till {formatCloseDate(p.closes_at)}
                      </li>
                    )}
                  </ul>
                  {p.terms && <p className="mt-3 text-[11px] text-muted-foreground">{p.terms}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 grid gap-6 rounded-2xl border border-primary/15 bg-primary/5 p-7 lg:grid-cols-[1.2fr_auto] lg:items-center">
          <div>
            <div className="text-eyebrow">How it works</div>
            <ol className="mt-4 space-y-3">
              {STEPS.map((s, i) => (
                <li key={s} className="flex items-start gap-3 text-sm">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{s}</span>
                </li>
              ))}
            </ol>
            <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <BadgeCheck className="h-4 w-4 text-primary" /> Rewards are paid after verification. Terms apply.
            </p>
          </div>
          <Button size="lg" className="rounded-full">Submit a referral</Button>
        </div>
      </section>
    </div>
  );
}
