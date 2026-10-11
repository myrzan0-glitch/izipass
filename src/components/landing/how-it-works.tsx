"use client"

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { Check, ReceiptText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type HowDemo = {
  event: string
  when: string
  paid: string
  price: string
  spots: string
  org: string
  post: string
  link: string
  register: string
  receipt: string
  autoPassed: string
  approve: string
  reject: string
  approved: string
  checkedIn: string
  reference: string
  countBefore: string
  countAfter: string
}

/** Each step plays for a while, then the next one takes over. */
const STEP_MS = 2800

const REDUCED = "(prefers-reduced-motion: reduce)"

function useReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED)
      query.addEventListener("change", onChange)
      return () => query.removeEventListener("change", onChange)
    },
    () => window.matchMedia(REDUCED).matches,
    () => false
  )
}

/** Something that pops in when its step starts playing. */
function Pop({ play, delay = 0, className, children }: { play: boolean; delay?: number; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(play && "animate-in fill-mode-both duration-300 fade-in zoom-in-75", className)}
      style={play ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </span>
  )
}

function Preview({ children }: { children: ReactNode }) {
  return <div className="flex h-38 flex-col justify-center gap-2 rounded-lg bg-muted p-3.5">{children}</div>
}

/** How it works: four steps with small product previews; the active step plays a short animation. */
export function HowItWorks({ steps, demo }: { steps: { title: string; body: string }[]; demo: HowDemo }) {
  const ref = useRef<HTMLOListElement>(null)
  const reduced = useReducedMotion()
  const [seen, setSeen] = useState(false)
  const [onScreen, setOnScreen] = useState(false)
  const [active, setActive] = useState(-1)
  // 0 when a step starts, then 1 and 2 as its little story moves on.
  const [progress, setProgress] = useState({ step: -1, phase: 0 })
  const phase = progress.step === active ? progress.phase : 0

  useEffect(() => {
    const list = ref.current
    if (!list) return
    const io = new IntersectionObserver(([entry]) => {
      setOnScreen(entry.isIntersecting)
      if (entry.isIntersecting) setSeen(true)
    }, { threshold: 0.35 })
    io.observe(list)
    return () => io.disconnect()
  }, [])

  // Move from step to step while the section is on screen.
  useEffect(() => {
    if (reduced || !onScreen) return
    const next = () => setActive((a) => (a + 1) % steps.length)
    const first = window.setTimeout(next, 600)
    const timer = window.setInterval(next, STEP_MS)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [reduced, onScreen, steps.length])

  useEffect(() => {
    const timers = [1, 2].map((n) => window.setTimeout(() => setProgress({ step: active, phase: n }), n === 1 ? 700 : 1300))
    return () => timers.forEach(window.clearTimeout)
  }, [active])

  const previews = [
    (play: boolean) => (
      <Preview>
        <div className="rounded-md border bg-card px-3 py-2">
          <p className="text-sm font-semibold">{demo.event}</p>
          <p className="text-xs text-muted-foreground">{demo.when}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Pop play={play} delay={150}>
            <Badge>{demo.paid}</Badge>
          </Pop>
          <Pop play={play} delay={350}>
            <Badge variant="outline" className="bg-card">
              {demo.price}
            </Badge>
          </Pop>
          <Pop play={play} delay={550}>
            <Badge variant="outline" className="bg-card">
              {demo.spots}
            </Badge>
          </Pop>
        </div>
      </Preview>
    ),
    (play: boolean) => (
      <Preview>
        <div
          className={cn("rounded-md border bg-card p-2.5 text-xs", play && "animate-in fill-mode-both duration-500 fade-in slide-in-from-bottom-3")}
        >
          <p className="font-semibold">{demo.org}</p>
          <p>{demo.post}</p>
          <Pop play={play} delay={500} className="mt-1.5 block border-l-2 border-chart-2 pl-2">
            <span className="block font-semibold">{demo.link}</span>
            <span className="block text-muted-foreground">
              {demo.event} · {demo.register}
            </span>
          </Pop>
        </div>
      </Preview>
    ),
    (play: boolean) => {
      const approved = play && phase === 2
      return (
        <Preview>
          <div className="flex items-center gap-2.5">
            <span className="flex h-13 w-10 items-center justify-center rounded-md border bg-card text-muted-foreground">
              <ReceiptText className="size-4" />
            </span>
            <div className="text-xs">
              <p className="text-sm font-semibold">{demo.receipt}</p>
              <p className="text-muted-foreground">{demo.autoPassed}</p>
            </div>
          </div>
          <div className="flex h-7 items-center gap-1.5">
            {approved ? (
              <Pop play>
                <Badge>
                  <Check />
                  {demo.approved}
                </Badge>
              </Pop>
            ) : (
              <>
                <Button
                  size="sm"
                  tabIndex={-1}
                  className={cn("pointer-events-none h-7 transition-transform", play && phase === 1 && "scale-90 ring-4 ring-ring/40")}
                >
                  {demo.approve}
                </Button>
                <Button size="sm" variant="outline" tabIndex={-1} className="pointer-events-none h-7">
                  {demo.reject}
                </Button>
              </>
            )}
          </div>
        </Preview>
      )
    },
    (play: boolean) => {
      const done = !play || phase >= 1
      return (
        <Preview>
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all duration-300",
                !done && "scale-50 opacity-0"
              )}
            >
              <Check className="size-4" />
            </span>
            <div className="text-xs">
              <p className="text-sm font-semibold">{demo.checkedIn}</p>
              <p className="font-mono text-muted-foreground">{demo.reference}</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-card tabular-nums">
            {play && phase >= 1 ? demo.countAfter : demo.countBefore}
          </Badge>
        </Preview>
      )
    },
  ]

  return (
    <ol ref={ref} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step, i) => {
        const play = active === i
        return (
          <li
            key={step.title}
            className={cn(!reduced && !seen && "opacity-0", !reduced && seen && "animate-in fill-mode-both duration-700 fade-in slide-in-from-bottom-6")}
            style={!reduced && seen ? { animationDelay: `${i * 120}ms` } : undefined}
          >
            <Card
              className={cn(
                "h-full gap-4 p-4 transition-[translate,box-shadow,border-color] duration-500",
                play && "-translate-y-1 border-foreground/20 shadow-md"
              )}
            >
              <div key={play ? `play-${i}` : `rest-${i}`}>{previews[i](play)}</div>
              <div className="flex gap-2.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <div className="flex flex-col gap-0.5">
                  <p className="font-semibold">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </div>
              </div>
            </Card>
          </li>
        )
      })}
    </ol>
  )
}
