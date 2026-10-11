"use client"

import { CalendarPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type Props = {
  googleUrl: string
  icsUrl: string
  dict: { addToCalendar: string; googleCalendar: string; icsCalendar: string }
  size?: "sm" | "default" | "lg"
  className?: string
}

export function AddToCalendar({ googleUrl, icsUrl, dict, size = "sm", className }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size={size} className={className}>
          <CalendarPlus />
          {dict.addToCalendar}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem asChild>
          <a href={googleUrl} target="_blank" rel="noopener">
            {dict.googleCalendar}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={icsUrl} download>
            {dict.icsCalendar}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
