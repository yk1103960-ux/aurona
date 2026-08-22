import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const KEY = "aurona.compare";
export const COMPARE_MAX = 3;
const EVENT = "aurona:compare";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((s) => typeof s === "string").slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}

function write(next: string[]) {
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Compare tray. Only product slugs are stored locally — every spec shown on the
 * compare page is fetched live from the database, so nothing here is fabricated.
 */
export function useCompare() {
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => {
    setSlugs(read());
    const sync = () => setSlugs(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const has = useCallback((slug?: string | null) => !!slug && slugs.includes(slug), [slugs]);

  const toggle = useCallback(
    (slug?: string | null, name?: string) => {
      if (!slug) return;
      const current = read();
      if (current.includes(slug)) {
        write(current.filter((s) => s !== slug));
        toast.success(`${name ?? "Product"} removed from compare`);
        return;
      }
      if (current.length >= COMPARE_MAX) {
        toast.error(`You can compare up to ${COMPARE_MAX} products. Remove one first.`);
        return;
      }
      write([...current, slug]);
      toast.success(`${name ?? "Product"} added to compare`);
    },
    [],
  );

  const remove = useCallback((slug: string) => write(read().filter((s) => s !== slug)), []);
  const clear = useCallback(() => write([]), []);

  return { slugs, count: slugs.length, has, toggle, remove, clear, max: COMPARE_MAX };
}
