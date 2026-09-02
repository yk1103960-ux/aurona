import { Link } from "@tanstack/react-router";
import { GitCompare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompare } from "@/hooks/useCompare";

/**
 * Persistent compare tray. Appears as soon as one product is added so the
 * comparison feature is discoverable from anywhere on the storefront.
 */
export function CompareTray() {
  const { slugs, remove, clear, max } = useCompare();
  if (slugs.length === 0) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-40 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[420px]">
      <div className="rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <GitCompare className="h-4 w-4 text-primary" />
            Compare ({slugs.length}/{max})
          </div>
          <button
            type="button"
            onClick={clear}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Clear
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {slugs.map((s) => (
            <span
              key={s}
              className="inline-flex max-w-[160px] items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px]"
            >
              <span className="truncate">{s.replace(/-/g, " ")}</span>
              <button type="button" aria-label={`Remove ${s} from compare`} onClick={() => remove(s)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <Button asChild size="sm" className="mt-3 w-full rounded-full" disabled={slugs.length < 2}>
          <Link to="/compare">{slugs.length < 2 ? "Add one more to compare" : "Compare now"}</Link>
        </Button>
      </div>
    </div>
  );
}
