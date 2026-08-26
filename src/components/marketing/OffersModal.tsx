import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Sparkles, X, Copy, Check } from "lucide-react";

const STORAGE_KEY = "aurona.offers.seen.v1";
const INTRO_KEY = "aurona_intro_played";

export function OffersModal() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // The welcome offer belongs on the home page only, and never while the
  // cinematic intro is still on screen — otherwise its backdrop silently
  // swallows taps on the header, cart and bottom navigation.
  const onHome = pathname === "/";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!onHome) {
      setOpen(false);
      return;
    }
    let cancelled = false;
    const seen = () => {
      try {
        return Boolean(sessionStorage.getItem(STORAGE_KEY));
      } catch {
        return false;
      }
    };
    if (seen()) return;

    const show = () => {
      if (cancelled) return;
      // Mark it seen as soon as it is shown so it can never come back and
      // block a later page.
      try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch { /* noop */ }
      setOpen(true);
    };

    const introDone = () => {
      try {
        return Boolean(sessionStorage.getItem(INTRO_KEY));
      } catch {
        return true;
      }
    };

    if (introDone()) {
      const t = window.setTimeout(show, 900);
      return () => { cancelled = true; window.clearTimeout(t); };
    }

    // Poll until the intro finishes, then show shortly after.
    const poll = window.setInterval(() => {
      if (introDone()) {
        window.clearInterval(poll);
        window.setTimeout(show, 1200);
      }
    }, 400);
    return () => { cancelled = true; window.clearInterval(poll); };
  }, [onHome]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
    document.body.style.overflow = "";
    try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch { /* noop */ }
  }


  function copyCode() {
    try {
      void navigator.clipboard.writeText("AURONA10");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { /* noop */ }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="offers-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
    >
      <button
        aria-label="Close offers"
        onClick={close}
        className="offer-backdrop-enter absolute inset-0 h-full w-full cursor-default bg-[oklch(0.24_0.05_245/60%)] backdrop-blur-md"
      />
      <div
        className="offer-enter relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-border-strong bg-card shadow-sky"
      >
        {/* Sky gradient header band */}
        <div className="relative product-gradient-hero px-6 pt-9 pb-7 sm:px-8 text-center">
          <div className="pointer-events-none absolute inset-0 light-halo opacity-80" />
          <button
            onClick={close}
            aria-label="Close"
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/70 text-foreground/70 backdrop-blur transition hover:bg-white hover:text-foreground"
          >
            <X className="h-4 w-4" strokeWidth={1.6} />
          </button>

          <div className="relative mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary backdrop-blur">
            <Sparkles className="h-3 w-3" strokeWidth={1.8} />
            Welcome Offer
          </div>

          <h2
            id="offers-modal-title"
            className="text-display text-4xl sm:text-5xl text-foreground"
          >
            Flat <span className="text-primary">10% Off</span>
            <br />
            your first order.
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-foreground/70">
            Premium LED lighting, fans and home appliances — engineered for modern India.
            Free shipping over ₹999.
          </p>
        </div>

        {/* Code + CTA */}
        <div className="space-y-5 px-6 pt-6 pb-7 sm:px-8">
          <button
            onClick={copyCode}
            className="group relative flex w-full items-center justify-between overflow-hidden rounded-2xl border border-dashed border-primary/50 bg-surface px-5 py-4 text-left transition hover:border-primary hover:bg-white"
          >
            <span
              aria-hidden
              className="offer-shine pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/80 to-transparent"
            />
            <div className="relative">
              <div className="text-eyebrow">Use code</div>
              <div className="text-display mt-0.5 text-2xl tracking-[0.14em] text-foreground">
                AURONA10
              </div>
            </div>
            <div className="relative inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" strokeWidth={2} /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" strokeWidth={1.8} /> Copy
                </>
              )}
            </div>
          </button>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link
              to="/deals"
              onClick={close}
              className="press inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold tracking-wide text-primary-foreground shadow-sky transition hover:brightness-110"
            >
              Shop the offers
            </Link>
            <button
              onClick={close}
              className="press inline-flex h-12 items-center justify-center rounded-full border border-border-strong bg-white px-6 text-sm font-semibold tracking-wide text-foreground transition hover:bg-surface"
            >
              Maybe later
            </button>
          </div>

          <p className="text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Limited time · New customers · T&amp;C apply
          </p>
        </div>
      </div>
    </div>
  );
}
