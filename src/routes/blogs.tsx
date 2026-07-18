import { createFileRoute } from "@tanstack/react-router";

const POSTS = [
  { cat: "Lighting Guide", t: "Choosing the right concealed lights for your home", d: "A practical guide to wattage, colour temperature and beam angle for Indian interiors." },
  { cat: "Product Knowledge", t: "COB vs SMD LEDs: what's the real difference?", d: "Two dominant LED chip types — how each performs and where each shines." },
  { cat: "Home Improvement", t: "Layered lighting: the pro designer approach", d: "Ambient, task and accent lighting explained with examples for Indian homes." },
  { cat: "Industry News", t: "Why Make in India lighting is quietly leading exports", d: "How Indian manufacturing scale is reshaping the global lighting market." },
];

export const Route = createFileRoute("/blogs")({
  head: () => ({ meta: [{ title: "Aurona Blog — Lighting Guides & News" }] }),
  component: () => (
    <div className="container-x py-16">
      <div className="text-eyebrow">Blog</div>
      <h1 className="text-display mt-3 text-5xl">Guides, product knowledge and news.</h1>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {POSTS.map((p) => (
          <article key={p.t} className="group overflow-hidden rounded-2xl border border-border transition hover:shadow-lift">
            <div className="product-gradient-amber aspect-[16/9]" />
            <div className="p-6">
              <div className="text-eyebrow">{p.cat}</div>
              <h2 className="text-display mt-2 text-2xl group-hover:text-gold">{p.t}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{p.d}</p>
              <div className="mt-4 text-xs text-muted-foreground">Aurona Team · 5 min read</div>
            </div>
          </article>
        ))}
      </div>
    </div>
  ),
});
