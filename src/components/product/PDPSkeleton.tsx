export function PDPSkeleton() {
  return (
    <div className="container-x py-8">
      <div className="mb-6 h-3 w-64 animate-pulse rounded bg-surface" />
      <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <div className="aspect-square w-full animate-pulse rounded-lg bg-surface" />
          <div className="mt-3 grid grid-cols-4 gap-3">
            {[0,1,2,3].map((i) => (
              <div key={i} className="aspect-square animate-pulse rounded-md bg-surface" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-3 w-24 animate-pulse rounded bg-surface" />
          <div className="h-8 w-3/4 animate-pulse rounded bg-surface" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-surface" />
          <div className="h-24 w-full animate-pulse rounded-lg bg-surface" />
          <div className="grid grid-cols-3 gap-2">
            {[0,1,2,3,4,5].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-surface" />
            ))}
          </div>
          <div className="h-52 w-full animate-pulse rounded bg-surface" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-12 animate-pulse rounded bg-surface" />
            <div className="h-12 animate-pulse rounded bg-surface" />
          </div>
        </div>
      </div>
    </div>
  );
}
