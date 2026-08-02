import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { categoriesQuery } from "@/lib/queries";

const iconPointers = import.meta.glob<{ default: { url: string } }>(
  "../assets/category-icons/*.png.asset.json",
  { eager: true },
);
const categoryIcons: Record<string, string> = Object.fromEntries(
  Object.entries(iconPointers).map(([path, mod]) => [
    path.split("/").pop()!.replace(".png.asset.json", ""),
    mod.default.url,
  ]),
);

export const Route = createFileRoute("/categories")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(categoriesQuery);
  },
  component: CategoriesPage,
  errorComponent: ({ error }) => (
    <div className="container-x py-16" role="alert">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="container-x py-16">No categories found.</div>,
  head: () => ({
    meta: [
      { title: "Shop by Category — LED Lighting & Appliances | Aurona" },
      {
        name: "description",
        content:
          "Browse every Aurona category — LED bulbs, panel lights, street lights, ceiling fans, geysers, heaters and more, direct from the manufacturer.",
      },
      { property: "og:title", content: "Shop by Category — Aurona" },
      {
        property: "og:description",
        content: "All Aurona LED lighting and home appliance categories in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function CategoriesPage() {
  const cats = useSuspenseQuery(categoriesQuery).data;
  const groups = Array.from(new Set(cats.map((c) => c.parent_group)));

  return (
    <div className="section-tint">
      <div className="container-x py-10 lg:py-14">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-primary">
            Home
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-semibold text-foreground">Categories</span>
        </nav>

        <h1 className="text-display mt-4 text-3xl sm:text-4xl lg:text-5xl">Shop by category</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          {cats.length} categories across LED lighting and home appliances — engineered and shipped
          direct from our India facility.
        </p>

        {groups.map((g) => (
          <section key={g} className="mt-12">
            <div className="flex items-center gap-4">
              <h2 className="text-display text-xl sm:text-2xl">{g}</h2>
              <div className="hairline flex-1" />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {cats
                .filter((c) => c.parent_group === g)
                .map((c) => (
                  <Link
                    key={c.id}
                    to="/category/$slug"
                    params={{ slug: c.slug }}
                    className="group relative flex flex-col items-center gap-4 overflow-hidden rounded-3xl border border-primary/10 bg-white p-6 text-center shadow-[0_2px_10px_-6px_oklch(0.58_0.16_240/0.35)] transition-all duration-500 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-[0_28px_60px_-30px_oklch(0.58_0.16_240/0.55)]"
                  >
                    <span
                      className="pointer-events-none absolute inset-x-0 -top-16 h-32 bg-[radial-gradient(ellipse_at_center,oklch(0.79_0.13_235/0.35),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      aria-hidden
                    />
                    <span className="relative grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-[oklch(0.99_0.005_240)] to-[oklch(0.93_0.035_235)] shadow-[inset_0_1px_0_oklch(1_0_0/0.9),0_16px_30px_-20px_oklch(0.58_0.16_240/0.7)] transition-transform duration-500 group-hover:scale-105">
                      {categoryIcons[c.slug] ? (
                        <img
                          src={categoryIcons[c.slug]}
                          alt={`${c.name} icon`}
                          className="h-14 w-14 object-contain drop-shadow-[0_10px_16px_oklch(0.58_0.16_240/0.3)] transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:scale-110"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-display text-2xl text-primary">{c.name.charAt(0)}</span>
                      )}
                    </span>
                    <span className="relative text-[13px] font-bold leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary">
                      {c.name}
                    </span>
                  </Link>

                  </Link>
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
