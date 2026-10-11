"use client"

import { useState } from "react"

import { LoginForm } from "@/components/login-form"
import { RegisterForm } from "@/components/register-form"
import { Button } from "@/components/ui/button"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/responsive-dialog"
import type { ActionState } from "@/app/[lang]/dashboard/actions"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { cn } from "@/lib/utils"

type Props = {
  lang: Locale
  organizerSlug: string
  eventSlug: string
  /** "Thursday speaking club · Thu 5 Nov, 19:00" */
  summary: string
  /** Signed-in person's name and phone, to fill the form; null when signed out. */
  person: { name: string; phone: string } | null
  bot: string
  /** Opens by itself, e.g. right after signing in from this dialog. */
  defaultOpen?: boolean
  /** The page part holding the Register buttons (RegisterTrigger). */
  children: React.ReactNode
  action: (prev: ActionState, form: FormData) => Promise<ActionState>
  dict: Dictionary
}

/** A Register button anywhere inside RegisterDialog; all of them open the same dialog. */
export function RegisterTrigger({ label, className }: { label: string; className?: string }) {
  return (
    <ResponsiveDialogTrigger asChild>
      <Button size="lg" className={cn(className)}>
        {label}
      </Button>
    </ResponsiveDialogTrigger>
  )
}

/**
 * Register without leaving the event page: signed-out people sign in here
 * (and come back with the dialog open), signed-in people confirm name and phone.
 */
export function RegisterDialog({ lang, organizerSlug, eventSlug, summary, person, bot, defaultOpen = false, children, action, dict }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const back = `/${lang}/o/${organizerSlug}/${eventSlug}?register=1`
  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      {children}
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{dict.guest.signInTitle}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{summary}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {person ? (
          <>
            <p className="text-sm text-muted-foreground">{dict.guest.detailsHint}</p>
            <RegisterForm lang={lang} organizerSlug={organizerSlug} eventSlug={eventSlug} defaults={person} action={action} dict={dict} />
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{dict.guest.signInHint}</p>
            <LoginForm lang={lang} next={back} bot={bot} dict={dict.login} />
          </>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
