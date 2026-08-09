/**
 * Shared page-level loading state.
 *
 * Flow pages (cart, address, checkout, payment, orders, account) used to
 * render `null` while the session or their data was resolving, which showed
 * the customer a completely blank screen. Every one of them now renders this
 * skeleton instead, so there is always visible feedback.
 */
export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="container-x py-10" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-6 w-40 animate-pulse rounded-full bg-muted" />
        <div className="h-28 animate-pulse rounded-2xl bg-muted" />
        <div className="h-28 animate-pulse rounded-2xl bg-muted" />
        <div className="h-12 w-full animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
}
