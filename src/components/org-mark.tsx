import { cn } from "@/lib/utils"

/** An organization's logo, or its first letter on a dark square when it has none. */
export function OrgMark({ name, logoUrl, className }: { name: string; logoUrl: string | null; className?: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" className={cn("size-5 shrink-0 rounded-sm object-cover", className)} />
  }
  return (
    <span
      aria-hidden
      className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-sm bg-primary text-[0.625rem] font-medium text-primary-foreground", className)}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}
