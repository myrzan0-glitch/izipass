import { Skeleton } from "@/components/ui/skeleton"

/** Placeholder for pages that stream in whole (dynamic params, session). */
export function PageSkeleton() {
  return (
    <>
      <div className="h-14 border-b" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-10 sm:px-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </main>
    </>
  )
}
