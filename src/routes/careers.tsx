import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Gift, Users, IndianRupee, Share2, BadgeCheck, Briefcase, Handshake, Store, Crown, Globe, Megaphone, Package, CalendarClock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { careersQuery, jobAnchor, isClosed, formatCloseDate, type CareerProgram } from "@/lib/careers";
import { referralProgramsQuery, commissionLabel, type ReferralProgram } from "@/lib/referral-programs";
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
  const [applyTarget, setApplyTarget] = useState<ApplyTarget>(null);
  const [detail, setDetail] = useState<CareerProgram | null>(null);
  const [refDetail, setRefDetail] = useState<ReferralProgram | null>(null);
  const openings = jobs.filter((j) => j.kind === "job");
  const programs = jobs.filter((j) => j.kind !== "job");
  return (
    <div className="container-x py-16">
      <div className="text-eyebrow">Careers</div>
      <h1 className="text-display mt-3 max-w-3xl text-5xl">Build the future of lighting with us.</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        We're always looking for engineers, designers, and operators who want to build serious products for modern India.
      </p>

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {isLoading && <div className="rounded-xl border border-border p-5 text-sm text-muted-foreground">Loading open roles…</div>}
        {!isLoading && openings.length === 0 && (
          <div className="rounded-xl border border-border p-5 text-sm text-muted-foreground">
            No open positions right now. Write to us and we'll keep your profile on file.
          </div>
        )}
        {openings.map((j) => {
          const closed = isClosed(j);
          const closeDate = formatCloseDate(j.closes_at);
          return (
            <div
              key={j.id}
              id={jobAnchor(j.id)}
              className={
                "flex scroll-mt-28 flex-col rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-lift" +
                (closed ? " opacity-60" : "")
              }
            >
              <div className="flex items-center gap-2 font-semibold">
                <Briefcase className="h-4 w-4 shrink-0 text-primary" /> {j.title}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {j.department && <span>{j.department}</span>}
                {j.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {j.location}</span>}
                {j.employment_type && <span>{j.employment_type}</span>}
                {j.experience && <span>{j.experience}</span>}
                {j.salary_range && <span>{j.salary_range}</span>}
                {closeDate && (
                  <span className="flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" /> {closed ? `Closed on ${closeDate}` : `Apply by ${closeDate}`}
                  </span>
                )}
              </div>
              <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{j.description}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => setDetail(j)}>
                  Read more
                </Button>
                {closed ? (
                  <span className="inline-block rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                    Applications closed
                  </span>
                ) : (
                  <Button size="sm" className="rounded-full" onClick={() => setApplyTarget({ id: j.id, title: j.title })}>
                    Apply now
                  </Button>
                )}
              </div>
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
            const closed = isClosed(r);
            return (
              <div key={r.id} id={jobAnchor(r.id)} className="flex scroll-mt-28 flex-col rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-lift">
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
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{r.description}</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  <Button asChild size="sm" variant="outline" className="rounded-full">
                    <Link to="/partner-program/$id" params={{ id: r.id }}>
                      Read more
                    </Link>
                  </Button>

                  {closed ? (
                    <span className="inline-block rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                      Applications closed
                    </span>
                  ) : (
                    <Button size="sm" className="rounded-full" onClick={() => setApplyTarget({ id: r.id, title: r.title })}>
                      Apply now
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>



        {referrals.length > 0 && (
          <div className="mt-12">
            <div className="text-eyebrow">Referral rewards</div>
            <h3 className="text-display mt-2 text-3xl">Current referral programs</h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {referrals.map((p) => (
                <div key={p.id} className="flex flex-col rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-gold/10 text-gold">
                      <Gift className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    <span className="rounded-full bg-primary/8 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                      {commissionLabel(p)}
                    </span>
                  </div>
                  <h4 className="mt-4 text-lg font-semibold">{p.name}</h4>
                  {p.description && <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">{p.description}</p>}
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {Number(p.min_order_value) > 0 && (
                      <li className="flex items-center gap-1.5">
                        <IndianRupee className="h-3 w-3" /> Minimum order ₹{Number(p.min_order_value)}
                      </li>
                    )}
                    {p.closes_at && (
                      <li className="flex items-center gap-1.5">
                        <CalendarClock className="h-3 w-3" /> Open till {formatCloseDate(p.closes_at)}
                      </li>
                    )}
                  </ul>
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => setRefDetail(p)}>
                      Read more
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-full"
                      onClick={() => setApplyTarget({ id: programs[0]?.id ?? openings[0]?.id ?? "", title: p.name })}
                    >
                      Apply now
                    </Button>
                  </div>
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
          <Button
            size="lg"
            className="rounded-full"
            onClick={() =>
              setApplyTarget({ id: programs[0]?.id ?? openings[0]?.id ?? "", title: "General application" })
            }
          >
            Apply / submit a referral
          </Button>
        </div>
      </section>

      <ApplyDialog target={applyTarget} onOpenChange={(open) => !open && setApplyTarget(null)} />

      {/* Full job / programme details */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {detail.department && <span>{detail.department}</span>}
                {detail.location && <span>{detail.location}</span>}
                {detail.employment_type && <span>{detail.employment_type}</span>}
                {formatCloseDate(detail.closes_at) && (
                  <span>
                    {isClosed(detail) ? "Closed on " : "Apply by "}
                    {formatCloseDate(detail.closes_at)}
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap text-muted-foreground">{detail.description}</p>
              {(
                [
                  ["Experience", detail.experience],
                  ["Salary / stipend", detail.salary_range],
                  ["Age criteria", detail.age_criteria],
                  ["Eligibility", detail.eligibility],
                  ["Reward", detail.reward],
                ] as const
              )
                .filter(([, v]) => !!v)
                .map(([k, v]) => (
                  <div key={k}>
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{k}</div>
                    <p className="mt-1 whitespace-pre-wrap">{v}</p>
                  </div>
                ))}
              {detail.responsibilities && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Responsibilities
                  </div>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {detail.responsibilities.split("\n").filter(Boolean).map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </div>
              )}
              {detail.requirements && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Requirements
                  </div>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {detail.requirements.split("\n").filter(Boolean).map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </div>
              )}
              {detail.details && <p className="whitespace-pre-wrap text-muted-foreground">{detail.details}</p>}
              {isClosed(detail) ? (
                <p className="text-xs font-semibold text-muted-foreground">Applications for this role are closed.</p>
              ) : (
                <Button
                  className="w-full rounded-full"
                  onClick={() => {
                    const target = { id: detail.id, title: detail.title };
                    setDetail(null);
                    setApplyTarget(target);
                  }}
                >
                  Apply now
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Full referral programme details */}
      <Dialog open={!!refDetail} onOpenChange={(o) => !o && setRefDetail(null)}>
        <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{refDetail?.name}</DialogTitle>
          </DialogHeader>
          {refDetail && (
            <div className="space-y-4 text-sm">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                {commissionLabel(refDetail)}
              </div>
              <p className="whitespace-pre-wrap text-muted-foreground">{refDetail.description}</p>
              {Number(refDetail.min_order_value) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Minimum order value ₹{Number(refDetail.min_order_value)}
                  {refDetail.max_commission ? ` · Maximum payout ₹${Number(refDetail.max_commission)}` : ""}
                </p>
              )}
              {refDetail.eligibility && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Who can join
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{refDetail.eligibility}</p>
                </div>
              )}
              {refDetail.closes_at && (
                <p className="text-xs text-muted-foreground">Open till {formatCloseDate(refDetail.closes_at)}</p>
              )}
              {refDetail.terms && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Terms</div>
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{refDetail.terms}</p>
                </div>
              )}
              <Button
                className="w-full rounded-full"
                onClick={() => {
                  const title = refDetail.name;
                  setRefDetail(null);
                  setApplyTarget({ id: programs[0]?.id ?? openings[0]?.id ?? "", title });
                }}
              >
                Apply now
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

