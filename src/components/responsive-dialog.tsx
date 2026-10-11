"use client"

import { createContext, useContext } from "react"

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { useDesktop } from "@/lib/client/use-desktop"
import { cn } from "@/lib/utils"

const Desktop = createContext(true)

type RootProps = { open?: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode }

/** A dialog on computers, a bottom sheet on phones (shadcn's responsive dialog). */
export function ResponsiveDialog({ open, onOpenChange, children }: RootProps) {
  const desktop = useDesktop()
  const Root = desktop ? Dialog : Drawer
  return (
    <Desktop.Provider value={desktop}>
      <Root open={open} onOpenChange={onOpenChange}>
        {children}
      </Root>
    </Desktop.Provider>
  )
}

export function ResponsiveDialogTrigger(props: React.ComponentProps<typeof DialogTrigger>) {
  return useContext(Desktop) ? <DialogTrigger {...props} /> : <DrawerTrigger {...props} />
}

export function ResponsiveDialogClose(props: React.ComponentProps<typeof DialogClose>) {
  return useContext(Desktop) ? <DialogClose {...props} /> : <DrawerClose {...props} />
}

export function ResponsiveDialogContent({ className, children }: { className?: string; children: React.ReactNode }) {
  if (useContext(Desktop)) {
    return <DialogContent className={cn("max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md", className)}>{children}</DialogContent>
  }
  return (
    <DrawerContent>
      <div className={cn("flex max-h-[85dvh] flex-col gap-4 overflow-y-auto px-4 pt-2 pb-6", className)}>{children}</div>
    </DrawerContent>
  )
}

export function ResponsiveDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return useContext(Desktop) ? <DialogHeader className={className} {...props} /> : <DrawerHeader className={cn("p-0", className)} {...props} />
}

export function ResponsiveDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return useContext(Desktop) ? <DialogFooter className={className} {...props} /> : <DrawerFooter className={cn("p-0", className)} {...props} />
}

export function ResponsiveDialogTitle(props: React.ComponentProps<typeof DialogTitle>) {
  return useContext(Desktop) ? <DialogTitle {...props} /> : <DrawerTitle className="text-lg" {...props} />
}

export function ResponsiveDialogDescription(props: React.ComponentProps<typeof DialogDescription>) {
  return useContext(Desktop) ? <DialogDescription {...props} /> : <DrawerDescription {...props} />
}
