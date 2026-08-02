import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, Zap, Clock, ChevronRight, X } from "lucide-react";
import { categoriesQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

/** Sticky floating quick-access rail — click to pin the category flyout (desktop only). */
export function QuickAccessRail() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: cats = [] } = useQuery(categoriesQuery);
  const [openCats, setOpenCats] = useState(false);

  useEffect(() => {
    setOpenCats(false);
  }, [pathname]);

  useEffect(() => {
    if (!openCats) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenCats(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCats]);

  if (pathname.startsWith("/aurona-console")) return null;

  return (
    <div className="pointer-events-none fixed left-0 top-1/2 z-40 hidden -translate-y-1/2 xl:block">
      <div className="pointer-events-auto flex flex-col gap-2.5 pl-2">
        <div className="group relative">
          <RailButton
            icon={LayoutGrid}
            label="All Categories"
            active={openCats}
            onClick={() => setOpenCats((v) => !v)}
          />
          <div
            className={cn(
              "glass-panel absolute left-[calc(100%+12px)] top-1/2 max-h-[64vh] w-[280px] -translate-y-1/2 overflow-y-auto rounded-2xl p-2 transition-all duration-300",
              openCats
                ? "pointer-events-auto translate-x-0 opacity-100"
                : "pointer-events-none -translate-x-2 opacity-0",
            )}
          >
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-eyebrow text-[10px]">Browse</span>
              <button
                type="button"
                onClick={() => setOpenCats(false)}
                className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                aria-label="Close categories"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
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
            <Link
              to="/categories"
              className="mt-1 flex items-center justify-center gap-1.5 rounded-xl btn-gradient px-3 py-2 text-[12.5px] font-bold"
            >
              View all categories <ChevronRight className="h-3.5 w-3.5" />
            </Link>
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

function RailButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Zap;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={cn("group", shell, active && "btn-gradient border-transparent pr-4")}
      aria-label={label}
    >
      <Icon className="h-[19px] w-[19px] shrink-0" strokeWidth={1.9} />
      <span className={cn(labelCls, active && "ml-2.5 max-w-[160px] opacity-100")}>{label}</span>
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
