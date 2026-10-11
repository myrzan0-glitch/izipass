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
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { useDesktop } from "@/lib/client/use-desktop"

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
 * A button that asks before doing something hard to undo: an alert dialog
 * on computers, a bottom sheet on phones. The form lives inside; it closes
 * on submit while the server action runs.
 */
export function ConfirmAction({ action, fields, trigger, triggerVariant = "outline", triggerSize = "sm", title, description, confirm, cancel, reason, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const reasonId = useId()
  const desktop = useDesktop()
  const button = (
    <Button type="button" variant={triggerVariant} size={triggerSize} disabled={disabled}>
      {trigger}
    </Button>
  )
  const body = (
    <>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {reason && (
        <Field>
          <FieldLabel htmlFor={reasonId}>{reason.label}</FieldLabel>
          <Textarea id={reasonId} name={reason.name} placeholder={reason.placeholder} maxLength={200} rows={2} />
        </Field>
      )}
    </>
  )

  if (!desktop) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{button}</DrawerTrigger>
        <DrawerContent>
          <form action={action} onSubmit={() => setOpen(false)} className="flex flex-col gap-4 px-4 pt-2 pb-6">
            <DrawerHeader className="p-0">
              <DrawerTitle className="text-lg">{title}</DrawerTitle>
              <DrawerDescription>{description}</DrawerDescription>
            </DrawerHeader>
            {body}
            <DrawerFooter className="p-0">
              <Button type="submit" size="lg" variant="destructive">
                {confirm}
              </Button>
              <DrawerClose asChild>
                <Button type="button" size="lg" variant="outline">
                  {cancel}
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{button}</AlertDialogTrigger>
      <AlertDialogContent>
        <form action={action} onSubmit={() => setOpen(false)} className="flex flex-col gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          {body}
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
