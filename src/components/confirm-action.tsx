"use client"

import { useId, useState } from "react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

type Variant = "default" | "outline" | "destructive" | "ghost" | "secondary"

type Props = {
  /** Server action the form posts to. */
  action: (form: FormData) => void | Promise<void>
  /** Hidden form fields. */
  fields: Record<string, string>
  trigger: React.ReactNode
  triggerVariant?: Variant
  triggerSize?: "default" | "sm" | "lg"
  title: string
  description: string
  confirm: string
  cancel: string
  /** Optional free-text field (e.g. a rejection reason) sent with the form. */
  reason?: { name: string; label: string; placeholder: string }
  disabled?: boolean
}

/**
 * A button that asks before doing something hard to undo. The form lives in
 * the dialog; it closes on submit while the server action runs.
 */
export function ConfirmAction({ action, fields, trigger, triggerVariant = "outline", triggerSize = "sm", title, description, confirm, cancel, reason, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const reasonId = useId()
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant={triggerVariant} size={triggerSize} disabled={disabled}>
          {trigger}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={action} onSubmit={() => setOpen(false)} className="flex flex-col gap-4">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          {reason && (
            <Field>
              <FieldLabel htmlFor={reasonId}>{reason.label}</FieldLabel>
              <Textarea id={reasonId} name={reason.name} placeholder={reason.placeholder} maxLength={200} rows={2} />
            </Field>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{cancel}</AlertDialogCancel>
            <Button type="submit" variant="destructive">
              {confirm}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
