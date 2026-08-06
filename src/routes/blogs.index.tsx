import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, CalendarDays, User, ArrowRight } from "lucide-react";
import { POSTS, CATEGORIES } from "@/lib/blog-data";

export const Route = createFileRoute("/blogs/")({
  head: () => ({
    meta: [
      { title: "Aurona Blog — Lighting Guides, Appliances & Industry News" },
      {
        name: "description",
        content:
          "Lighting guides, LED product knowledge, home appliance buying advice and industry news from the Aurona Lighting team.",
      },
      { property: "og:title", content: "Aurona Blog — Lighting Guides & Industry News" },
      {
        property: "og:description",
        content: "Practical guides on LED lighting, fans, geysers and home appliances from Aurona.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BlogsPage,
});

function BlogsPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return POSTS.filter(
      (p) =>
        (!cat || p.cat === cat) &&
        (!term ||
          p.title.toLowerCase().includes(term) ||
          p.excerpt.toLowerCase().includes(term) ||
          p.cat.toLowerCase().includes(term)),
    );
  }, [q, cat]);

  return (
    <div className="container-x py-14">
      <div className="text-eyebrow">Blog</div>
      <h1 className="text-display mt-3 max-w-3xl text-5xl">Guides, product knowledge and news.</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Everything we learn building lighting and appliances in India — written for homeowners, retailers and electricians.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-12 text-center">
              <div className="text-display text-2xl">No posts found</div>
              <p className="mt-2 text-sm text-muted-foreground">Try a different keyword or category.</p>
              <Button className="mt-6 rounded-full" onClick={() => { setQ(""); setCat(""); }}>
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {filtered.map((p) => (
                <article
                  key={p.slug}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <Link to="/blogs/$slug" params={{ slug: p.slug }} className={`aspect-[16/9] bg-gradient-to-br ${p.tone}`} aria-label={p.title} />
                  <div className="flex flex-1 flex-col p-6">
                    <div className="text-eyebrow">{p.cat}</div>
                    <h2 className="text-display mt-2 text-2xl leading-snug group-hover:text-primary">
                      <Link to="/blogs/$slug" params={{ slug: p.slug }}>{p.title}</Link>
                    </h2>
                    <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.excerpt}</p>
                    <div className="mt-4 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> {p.author}</span>
                      <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {p.date}</span>
                      <span>{p.read}</span>
                    </div>
                    <Link
                      to="/blogs/$slug"
                      params={{ slug: p.slug }}
                      className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.2em] text-primary"
                    >
                      Read full blog <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-[200px] lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-5">
            <SideHeading>Search</SideHeading>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search articles…"
                className="h-11 rounded-full pl-9"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <SideHeading>Categories</SideHeading>
            <ul className="mt-3 space-y-1">
              <li>
                <button
                  onClick={() => setCat("")}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition hover:bg-primary/5 ${!cat ? "bg-primary/8 font-semibold text-primary" : "text-muted-foreground"}`}
                >
                  All Posts <span className="text-xs">{POSTS.length}</span>
                </button>
              </li>
              {CATEGORIES.map((c) => (
                <li key={c}>
                  <button
                    onClick={() => setCat(c)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition hover:bg-primary/5 ${cat === c ? "bg-primary/8 font-semibold text-primary" : "text-muted-foreground"}`}
                  >
                    {c} <span className="text-xs">{POSTS.filter((p) => p.cat === c).length}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <SideHeading>Recent Posts</SideHeading>
            <ul className="mt-3 space-y-4">
              {POSTS.slice(0, 4).map((p) => (
                <li key={p.slug}>
                  <Link to="/blogs/$slug" params={{ slug: p.slug }} className="flex gap-3 group">
                    <span className={`h-14 w-16 shrink-0 rounded-lg bg-gradient-to-br ${p.tone}`} />
                    <span className="min-w-0">
                      <span className="line-clamp-2 block text-[13px] font-semibold leading-snug group-hover:text-primary">{p.title}</span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">{p.date}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <SideHeading>Need help choosing?</SideHeading>
            <p className="mt-2 text-sm text-muted-foreground">
              Talk to our lighting experts for a free room-by-room recommendation.
            </p>
            <Button asChild className="mt-4 w-full rounded-full">
              <Link to="/contact">Contact us</Link>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SideHeading({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">{children}</div>;
}
