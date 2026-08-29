import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, Zap, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Slim icon-only quick-access dock pinned to the left edge (desktop only).
 * Labels appear as a tooltip to the right so nothing ever overlaps page content.
 */
export function QuickAccessRail() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.startsWith("/aurona-console")) return null;

  return (
    <div className="pointer-events-none fixed left-0 top-1/2 z-30 hidden -translate-y-1/2 2xl:block">
      <div className="pointer-events-auto flex flex-col gap-2 rounded-r-3xl border border-l-0 border-primary/12 bg-white/80 p-2 shadow-[0_18px_50px_-30px_oklch(0.58_0.16_240/0.55)] backdrop-blur-xl">
        <RailLink to="/categories" icon={LayoutGrid} label="All Categories" />
        <RailLink to="/deals" icon={Zap} label="Flash Sale" />
        <RailLink to="/bestsellers" icon={Clock} label="Today’s Deal" />
      </div>
    </div>
  );
}

function RailLink({ to, icon: Icon, label }: { to: string; icon: typeof Zap; label: string }) {
  return (
    <Link
      to={to as never}
      aria-label={label}
      className={cn(
        "group relative grid h-11 w-11 place-items-center rounded-2xl text-primary transition-all duration-300",
        "hover:bg-gradient-to-br hover:from-[oklch(0.79_0.13_235)] hover:to-primary hover:text-primary-foreground hover:shadow-[0_10px_24px_-12px_oklch(0.58_0.16_240/0.7)]",
      )}
    >
      <Icon className="h-[19px] w-[19px]" strokeWidth={1.8} />
      <span className="pointer-events-none absolute left-[calc(100%+10px)] whitespace-nowrap rounded-xl bg-foreground px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-background opacity-0 shadow-lift transition-all duration-200 group-hover:opacity-100">
        {label}
      </span>
    </Link>
  );
}
