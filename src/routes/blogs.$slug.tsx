import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CalendarDays, User, Share2, Facebook, Linkedin, Twitter, MessageCircle, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { POSTS, getPost, neighbours } from "@/lib/blog-data";

export const Route = createFileRoute("/blogs/$slug")({
  loader: ({ params }) => {
    const post = getPost(params.slug);
    if (!post) throw notFound();
    return post;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} — Aurona Blog` },
          { name: "description", content: loaderData.excerpt },
          { property: "og:title", content: loaderData.title },
          { property: "og:description", content: loaderData.excerpt },
          { property: "og:type", content: "article" },
          { name: "twitter:card", content: "summary_large_image" },
        ]
      : [],
  }),
  errorComponent: () => <Missing />,
  notFoundComponent: () => <Missing />,
  component: BlogPostPage,
});

function Missing() {
  return (
    <div className="container-x py-20 text-center">
      <div className="text-display text-3xl">Article not found</div>
      <Button asChild className="mt-6 rounded-full">
        <Link to="/blogs">Back to blog</Link>
      </Button>
    </div>
  );
}

function BlogPostPage() {
  const post = Route.useLoaderData();
  const { prev, next } = neighbours(post.slug);
  const url = typeof window !== "undefined" ? window.location.href : `https://aurona.in/blogs/${post.slug}`;
  const shareText = encodeURIComponent(post.title);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  return (
    <div className="container-x py-12">
      <Link to="/blogs" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> All articles
      </Link>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article>
          <div className="text-eyebrow">{post.cat}</div>
          <h1 className="text-display mt-3 text-4xl leading-tight sm:text-5xl">{post.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {post.author}</span>
            <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {post.date}</span>
            <span>{post.read}</span>
          </div>

          {/* Featured image */}
          <div className={`mt-8 aspect-[16/8] w-full rounded-2xl bg-gradient-to-br ${post.tone} ring-1 ring-border`} />

          <div className="mt-8 space-y-5">
            {post.body.map((b, i) => (
              <div key={i}>
                {b.h && <h2 className="text-display text-2xl">{b.h}</h2>}
                {b.p && <p className="text-[15px] leading-relaxed text-muted-foreground">{b.p}</p>}
                {b.li && (
                  <ul className="mt-2 space-y-2">
                    {b.li.map((l) => (
                      <li key={l} className="flex gap-2 text-[15px] leading-relaxed text-muted-foreground">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {l}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {/* Social sharing */}
          <div className="mt-10 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-5">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              <Share2 className="h-4 w-4" /> Share
            </span>
            <ShareLink href={`https://api.whatsapp.com/send?text=${shareText}%20${encodeURIComponent(url)}`} label="WhatsApp">
              <MessageCircle className="h-4 w-4" />
            </ShareLink>
            <ShareLink href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} label="Facebook">
              <Facebook className="h-4 w-4" />
            </ShareLink>
            <ShareLink href={`https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(url)}`} label="X">
              <Twitter className="h-4 w-4" />
            </ShareLink>
            <ShareLink href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} label="LinkedIn">
              <Linkedin className="h-4 w-4" />
            </ShareLink>
            <button onClick={copy} aria-label="Copy link" className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card transition hover:border-primary/40 hover:text-primary">
              <Link2 className="h-4 w-4" />
            </button>
          </div>

          {/* Prev / next navigation */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {prev ? (
              <Link to="/blogs/$slug" params={{ slug: prev.slug }} className="group rounded-2xl border border-border p-5 transition hover:border-primary/40">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Previous</div>
                <div className="mt-1 text-sm font-semibold group-hover:text-primary">{prev.title}</div>
              </Link>
            ) : <span />}
            {next && (
              <Link to="/blogs/$slug" params={{ slug: next.slug }} className="group rounded-2xl border border-border p-5 text-right transition hover:border-primary/40">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Next</div>
                <div className="mt-1 text-sm font-semibold group-hover:text-primary">{next.title}</div>
              </Link>
            )}
          </div>
        </article>

        <aside className="space-y-6 lg:sticky lg:top-[200px] lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Recent Posts</div>
            <ul className="mt-3 space-y-4">
              {POSTS.filter((p) => p.slug !== post.slug).slice(0, 5).map((p) => (
                <li key={p.slug}>
                  <Link to="/blogs/$slug" params={{ slug: p.slug }} className="group flex gap-3">
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
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Shop the guide</div>
            <p className="mt-2 text-sm text-muted-foreground">Browse Aurona LED lighting and appliances, manufacturer-direct.</p>
            <Button asChild className="mt-4 w-full rounded-full">
              <Link to="/products">Shop now <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ShareLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Share on ${label}`}
      className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card transition hover:border-primary/40 hover:text-primary"
    >
      {children}
    </a>
  );
}
