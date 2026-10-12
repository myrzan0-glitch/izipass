"use client"

import { useState } from "react"
import { CalendarIcon, X } from "lucide-react"
import { enGB, kk, ru, uz } from "react-day-picker/locale"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDesktop } from "@/lib/client/use-desktop"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { INTL_LOCALE } from "@/lib/time"
import { cn } from "@/lib/utils"

const CALENDAR_LOCALE = { en: enGB, ru, uz, kk }

/** Every 15 minutes, 00:00 to 23:45. */
const TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`)

const pad = (n: number) => String(n).padStart(2, "0")
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

type Props = {
  id: string
  name: string
  /** The row's label (Start, End): the bottom sheet's title on phones. */
  label: string
  lang: Locale
  /** A `datetime-local` value ("2026-10-15T19:00") or "". */
  defaultValue: string
  /** The time a newly picked date gets. */
  defaultTime: string
  invalid?: boolean
  /** The end time can be left empty, and removed again. */
  optional?: boolean
  dict: Dictionary["create"]
}

/**
 * shadcn date picker (Calendar in a Popover; a bottom sheet on phones) plus a time Select.
 * Submits one hidden `datetime-local` value, Tashkent time, like the native input did.
 */
export function DateTimeField({ id, name, label, lang, defaultValue, defaultTime, invalid, optional, dict }: Props) {
  const desktop = useDesktop()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(defaultValue.slice(0, 10))
  const [time, setTime] = useState(defaultValue.slice(11, 16) || defaultTime)

  // Noon, so the day never shifts with the browser's time zone.
  const selected = date ? new Date(`${date}T12:00:00`) : undefined
  const times = TIMES.includes(time) ? TIMES : [...TIMES, time].sort()
  const text = selected
    ? new Intl.DateTimeFormat(INTL_LOCALE[lang], { weekday: "short", day: "numeric", month: "long", year: "numeric" }).format(selected)
    : optional
      ? dict.optional
      : dict.pickDate

  const pick = (day?: Date) => {
    if (!day) return
    setDate(ymd(day))
    setOpen(false)
  }
  const calendar = (
    <Calendar
      mode="single"
      selected={selected}
      defaultMonth={selected}
      onSelect={pick}
      locale={CALENDAR_LOCALE[lang]}
      weekStartsOn={1}
      className={desktop ? undefined : "mx-auto [--cell-size:--spacing(11)]"}
    />
  )
  const trigger = (
    <Button
      id={id}
      type="button"
      variant="outline"
      aria-invalid={invalid}
      className={cn("min-w-0 flex-1 justify-start border-input bg-transparent font-normal dark:bg-input/30", !date && "text-muted-foreground")}
    >
      <CalendarIcon />
      <span className="truncate">{text}</span>
    </Button>
  )

  return (
    <div className="flex gap-2">
      <input type="hidden" name={name} value={date ? `${date}T${time}` : ""} />
      {desktop ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            {calendar}
          </PopoverContent>
        </Popover>
      ) : (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{label}</DrawerTitle>
            </DrawerHeader>
            <div className="pb-6">{calendar}</div>
          </DrawerContent>
        </Drawer>
      )}
      <Select value={time} onValueChange={setTime} disabled={!date}>
        <SelectTrigger aria-label={dict.time} className="w-24 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-72">
          {times.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {optional && date && (
        <Button type="button" variant="ghost" size="icon" aria-label={dict.clearEnd} onClick={() => setDate("")}>
          <X />
        </Button>
      )}
    </div>
  )
}
