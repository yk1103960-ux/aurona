import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, Zap, Clock, ChevronRight } from "lucide-react";
import { categoriesQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useState } from "react";

/** Sticky floating quick-access rail — expands on hover (desktop only). */
export function QuickAccessRail() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: cats = [] } = useQuery(categoriesQuery);
  const [openCats, setOpenCats] = useState(false);

  if (pathname.startsWith("/aurona-console")) return null;

  return (
    <div className="pointer-events-none fixed left-0 top-1/2 z-30 hidden -translate-y-1/2 xl:block">
      <div className="pointer-events-auto flex flex-col gap-2 pl-2">
        {/* All categories */}
        <div
          className="group relative"
          onMouseEnter={() => setOpenCats(true)}
          onMouseLeave={() => setOpenCats(false)}
        >
          <RailButton icon={LayoutGrid} label="All Categories" />
          <div
            className={cn(
              "absolute left-[calc(100%+10px)] top-1/2 max-h-[64vh] w-[260px] -translate-y-1/2 overflow-y-auto rounded-2xl border border-primary/12 bg-white p-2 shadow-[0_28px_60px_-28px_rgba(15,23,42,0.35)] transition-all duration-300",
              openCats ? "pointer-events-auto translate-x-0 opacity-100" : "pointer-events-none -translate-x-2 opacity-0",
            )}
          >
            {cats.map((c) => (
              <Link
                key={c.id}
                to="/category/$slug"
                params={{ slug: c.slug }}
                className="flex items-center justify-between rounded-xl px-3 py-2 text-[13px] font-semibold text-foreground/85 transition-colors hover:bg-primary/8 hover:text-primary"
              >
                <span className="truncate">{c.name}</span>
                <ChevronRight className="h-3.5 w-3.5 opacity-40" />
              </Link>
            ))}
          </div>
        </div>

        <RailLink to="/deals" icon={Zap} label="Flash Sale" />
        <RailLink to="/bestsellers" icon={Clock} label="Today’s Deal" />
      </div>
    </div>
  );
}

const shell =
  "flex h-12 items-center gap-0 overflow-hidden rounded-full border border-primary/15 bg-white/95 pl-3.5 pr-0 text-primary shadow-[0_12px_30px_-18px_rgba(10,132,209,0.6)] backdrop-blur transition-all duration-300 hover:border-primary/40 hover:bg-gradient-to-r hover:from-primary hover:to-[oklch(0.52_0.13_248)] hover:pr-4 hover:text-primary-foreground";
const labelCls =
  "max-w-0 whitespace-nowrap text-[12.5px] font-bold tracking-[0.02em] opacity-0 transition-all duration-300 group-hover:ml-2.5 group-hover:max-w-[160px] group-hover:opacity-100";

function RailButton({ icon: Icon, label }: { icon: typeof Zap; label: string }) {
  return (
    <button type="button" className={cn("group", shell)} aria-label={label}>
      <Icon className="h-[19px] w-[19px] shrink-0" strokeWidth={1.9} />
      <span className={labelCls}>{label}</span>
    </button>
  );
}

function RailLink({ to, icon: Icon, label }: { to: string; icon: typeof Zap; label: string }) {
  return (
    <Link to={to as never} className={cn("group", shell)} aria-label={label}>
      <Icon className="h-[19px] w-[19px] shrink-0" strokeWidth={1.9} />
      <span className={labelCls}>{label}</span>
    </Link>
  );
}
