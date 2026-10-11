import { Skeleton } from "@/components/ui/skeleton"

/** Placeholder for pages that stream in whole (dynamic params, session). */
export function PageSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-6 sm:py-12">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </main>
  )
}
