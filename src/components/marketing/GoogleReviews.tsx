import { Star, Quote } from "lucide-react";
import { motion } from "framer-motion";

// Static seed of reviews shaped like a Google Business Profile response.
// Wire this to a live source later without changing the component.
export type GReview = {
  author: string;
  initials: string;
  rating: number;
  relativeTime: string;
  text: string;
};

const REVIEWS: GReview[] = [
  {
    author: "Rohit Sharma",
    initials: "RS",
    rating: 5,
    relativeTime: "2 weeks ago",
    text: "Genuine manufacturer pricing and the LED panels are noticeably brighter than what I was using earlier. Delivery to Jaipur was faster than promised.",
  },
  {
    author: "Aditi Verma",
    initials: "AV",
    rating: 5,
    relativeTime: "1 month ago",
    text: "Ordered ceiling fans for a builder project. Finish quality is honestly at par with the big brands but at a much better margin. Will reorder.",
  },
  {
    author: "Mohammed Irfan",
    initials: "MI",
    rating: 4,
    relativeTime: "3 weeks ago",
    text: "Good product range and the retailer onboarding was smooth. Support team actually picks up the phone which is rare these days.",
  },
  {
    author: "Priya Nair",
    initials: "PN",
    rating: 5,
    relativeTime: "5 days ago",
    text: "The gallery/track light selection is fantastic for interior projects. Warm 3000K matched perfectly with the mockup we shared. Very happy.",
  },
  {
    author: "Vikram Singh",
    initials: "VS",
    rating: 5,
    relativeTime: "2 months ago",
    text: "As a distributor I have tried many Indian brands – Aurona's after-sales and replacement policy is the cleanest I've dealt with.",
  },
  {
    author: "Kavya Reddy",
    initials: "KR",
    rating: 5,
    relativeTime: "1 week ago",
    text: "Bought the whole living room set – downlights, fan, table lamp. Everything arrived neatly packed with proper warranty cards.",
  },
];

const AGGREGATE = { rating: 4.8, count: 1247 };

export function GoogleReviews() {
  return (
    <section className="container-x py-16 lg:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <div className="text-eyebrow text-primary">06 · What customers say</div>
        <h2 className="text-display mt-3 text-4xl leading-tight sm:text-5xl">
          Rated <span className="italic text-primary">{AGGREGATE.rating}</span> on Google
        </h2>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <div className="flex" aria-label={`${AGGREGATE.rating} out of 5`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={
                  i < Math.round(AGGREGATE.rating)
                    ? "h-4 w-4 fill-amber-400 text-amber-400"
                    : "h-4 w-4 text-muted-foreground/40"
                }
              />
            ))}
          </div>
          <span>
            {AGGREGATE.count.toLocaleString("en-IN")} verified reviews across India
          </span>
        </div>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {REVIEWS.map((r, idx) => (
          <motion.article
            key={r.author}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: idx * 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="card-premium group relative flex h-full flex-col rounded-2xl border border-border/70 bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/40"
          >
            <Quote className="absolute right-5 top-5 h-6 w-6 text-primary/15" aria-hidden />
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-sm font-semibold text-primary">
                {r.initials}
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{r.author}</div>
                <div className="text-xs text-muted-foreground">{r.relativeTime}</div>
              </div>
            </div>
            <div className="mt-3 flex" aria-label={`${r.rating} stars`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={
                    i < r.rating
                      ? "h-3.5 w-3.5 fill-amber-400 text-amber-400"
                      : "h-3.5 w-3.5 text-muted-foreground/30"
                  }
                />
              ))}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{r.text}</p>
            <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <GoogleG className="h-3.5 w-3.5" />
              Posted on Google
            </div>
          </motion.article>
        ))}
      </div>

      <div className="mt-10 text-center">
        <a
          href="https://www.google.com/search?q=Aurona+Lighting+Industries+reviews"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-background px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary"
        >
          <GoogleG className="h-4 w-4" /> Read all reviews on Google
        </a>
      </div>
    </section>
  );
}

function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.3h6.4c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.7z"/>
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.3 7.4 24 12 24z"/>
      <path fill="#FBBC05" d="M5.4 14.4c-.2-.7-.4-1.4-.4-2.4s.1-1.7.4-2.4V6.5H1.4C.5 8.2 0 10 0 12s.5 3.8 1.4 5.5l4-3.1z"/>
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8L20 3.1C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/>
    </svg>
  );
}
