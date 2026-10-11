import { Globe, Send } from "lucide-react"

import { InstagramIcon, YoutubeIcon } from "@/components/brand-icons"
import { Button } from "@/components/ui/button"
import { describeLink, type LinkKind } from "@/lib/links"

const ICONS: Record<LinkKind, React.ComponentType<{ className?: string }>> = {
  telegram: Send,
  instagram: InstagramIcon,
  youtube: YoutubeIcon,
  web: Globe,
}

/** The organizer's links as icon + handle buttons. */
export function OrganizerLinks({ links }: { links: string[] }) {
  if (links.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => {
        const { kind, label } = describeLink(link)
        const Icon = ICONS[kind]
        return (
          <Button key={link} variant="outline" size="sm" asChild>
            <a href={link} target="_blank" rel="noopener noreferrer">
              <Icon className="size-4" />
              <span className="max-w-48 truncate">{label}</span>
            </a>
          </Button>
        )
      })}
    </div>
  )
}
