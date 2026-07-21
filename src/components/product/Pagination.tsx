import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const PER_PAGE_OPTIONS = [12, 24, 36, 48, 60] as const;

function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total, current, current - 1, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((n) => set.add(n));
  if (current >= total - 2) [total - 1, total - 2, total - 3].forEach((n) => set.add(n));
  const pages = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  for (let i = 0; i < pages.length; i++) {
    if (i > 0 && pages[i] - pages[i - 1] > 1) out.push("…");
    out.push(pages[i]);
  }
  return out;
}

export function Pagination({
  page,
  perPage,
  total,
  onPage,
  onPerPage,
}: {
  page: number;
  perPage: number;
  total: number;
  onPage: (p: number) => void;
  onPerPage: (n: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (current - 1) * perPage + 1;
  const to = Math.min(total, current * perPage);
  const [jump, setJump] = useState("");

  const go = (n: number) => onPage(Math.min(Math.max(1, n), totalPages));

  return (
    <div className="mt-10 flex flex-col items-center gap-4 border-t border-border pt-6">
      <div className="text-xs text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{from}</span>–
        <span className="font-semibold text-foreground">{to}</span> of{" "}
        <span className="font-semibold text-foreground">{total}</span> products
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1 px-3"
          disabled={current <= 1}
          onClick={() => go(current - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        {pageWindow(current, totalPages).map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1.5 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => go(p)}
              aria-current={p === current ? "page" : undefined}
              className={cn(
                "h-9 min-w-9 rounded-md border border-border px-3 text-sm transition hover:border-primary",
                p === current && "border-primary bg-primary text-primary-foreground",
              )}
            >
              {p}
            </button>
          ),
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1 px-3"
          disabled={current >= totalPages}
          onClick={() => go(current + 1)}
          aria-label="Next page"
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        <label className="flex items-center gap-2">
          Per page
          <select
            value={perPage}
            onChange={(e) => onPerPage(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(jump);
            if (Number.isFinite(n) && n > 0) go(n);
            setJump("");
          }}
          className="flex items-center gap-2"
        >
          Jump to
          <Input
            value={jump}
            onChange={(e) => setJump(e.target.value.replace(/[^\d]/g, ""))}
            placeholder={String(current)}
            className="h-8 w-16 text-sm"
            inputMode="numeric"
          />
          <Button type="submit" size="sm" variant="outline" className="h-8 px-3">Go</Button>
        </form>
      </div>
    </div>
  );
}
