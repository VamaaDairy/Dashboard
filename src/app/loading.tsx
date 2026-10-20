import { Skeleton } from "@/components/ui/skeleton";

/** Fallback while any page without its own loading.tsx streams in - same frame as the pages, so nothing jumps. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <span className="sr-only">Loading…</span>
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <div className="flex items-center gap-3 py-2">
          <span
            aria-hidden
            className="size-5 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
          />
          <div className="space-y-2">
            <Skeleton className="h-6 w-64 max-w-full" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    </div>
  );
}
