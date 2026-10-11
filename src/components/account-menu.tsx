"use client"

import Link from "next/link"
import { LayoutDashboard, LogOut } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"

type Props = {
  lang: Locale
  name: string
  /** @username or email, shown under the name. */
  detail: string | null
  dict: Dictionary["nav"]
}

function initials(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("")
  return letters || "?"
}

/** Header avatar for signed-in people: who you are, dashboard, sign out. */
export function AccountMenu({ lang, name, detail, dict }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={dict.account}>
          <Avatar className="size-8">
            <AvatarFallback className="text-xs font-medium">{initials(name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{name}</span>
          {detail && <span className="truncate text-xs font-normal text-muted-foreground">{detail}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/${lang}/dashboard`}>
            <LayoutDashboard />
            {dict.dashboard}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action="/api/auth/logout" method="post">
          <input type="hidden" name="lang" value={lang} />
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut />
              {dict.signOut}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
