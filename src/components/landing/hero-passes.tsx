"use client"

import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"

import { WalletPass, isLightTone, type PassData } from "@/components/landing/wallet-pass"
import type { QrPath } from "@/lib/qr-path"

/** Where one pass sits: its center in hero pixels (from the top left), tilt in degrees and width. */
/** `z` puts overlapping passes in front of each other. */
type Slot = { pass: number; x: number; y: number; rot: number; w: number; qr: boolean; z: number }

/** At 1280px and wider the passes float on both sides of the headline (the approved design, 1280 wide). */
const WIDE: Slot[] = [
  { pass: 0, x: 154, y: 190, rot: -9, w: 168, qr: true, z: 0 },
  { pass: 1, x: 225, y: 470, rot: 6, w: 150, qr: false, z: 0 },
  { pass: 2, x: 124, y: 680, rot: -4, w: 168, qr: true, z: 0 },
  { pass: 3, x: 1116, y: 170, rot: 8, w: 168, qr: true, z: 0 },
  { pass: 4, x: 1045, y: 460, rot: -7, w: 150, qr: false, z: 0 },
  { pass: 5, x: 1156, y: 660, rot: 5, w: 168, qr: true, z: 0 },
]
/** Narrower screens get a band of passes above the headline: three on phones (390 wide)... */
const PHONE: Slot[] = [
  { pass: 0, x: 86, y: 70, rot: -10, w: 136, qr: false, z: 0 },
  { pass: 3, x: 195, y: 118, rot: 2, w: 138, qr: true, z: 2 },
  { pass: 2, x: 310, y: 62, rot: 11, w: 128, qr: false, z: 1 },
]
/** ...and five on tablets and small laptops (x as a share of the width). */
const TABLET: Slot[] = [
  { pass: 0, x: 0.12, y: 105, rot: -10, w: 150, qr: false, z: 0 },
  { pass: 2, x: 0.31, y: 160, rot: 5, w: 150, qr: true, z: 1 },
  { pass: 3, x: 0.5, y: 130, rot: -2, w: 158, qr: true, z: 2 },
  { pass: 5, x: 0.69, y: 165, rot: -6, w: 150, qr: true, z: 1 },
  { pass: 4, x: 0.88, y: 100, rot: 9, w: 150, qr: false, z: 0 },
]

function layout(width: number): Slot[] {
  if (width >= 1280) {
    const k = Math.min(width / 1280, 1.25)
    return WIDE.map((s) => ({ ...s, x: width / 2 + (s.x - 640) * k }))
  }
  if (width >= 640) return TABLET.map((s) => ({ ...s, x: s.x * width }))
  const k = width / 390
  return PHONE.map((s) => ({ ...s, x: s.x * k }))
}

let measuring: CanvasRenderingContext2D | null = null
const measure = () => (measuring ??= document.createElement("canvas").getContext("2d")!)

/** Lays the pass out the way WalletPass does in HTML; returns its height in CSS pixels. */
function drawPass(
  ctx: CanvasRenderingContext2D | null,
  pass: PassData,
  slot: Slot,
  qr: QrPath,
  colors: { bg: string; text: string; qrBg: string; qrFg: string },
  font: string
) {
  const pad = 14
  const inner = slot.w - pad * 2
  const lines = (text: string, size: number, weight: number, max: number) => {
    const c = ctx ?? measure()
    c.font = `${weight} ${size}px ${font}`
    const out: string[] = []
    let line = ""
    for (const word of text.split(" ")) {
      const next = line ? `${line} ${word}` : word
      if (line && c.measureText(next).width > max) {
        out.push(line)
        line = word
      } else line = next
    }
    if (line) out.push(line)
    return out.slice(0, 2)
  }
  const org = lines(pass.org.toUpperCase(), 10, 600, inner)
  const title = lines(pass.title, 16, 600, inner)
  const meta = lines(pass.meta, 11, 400, inner)
  const height = pad * 2 + org.length * 13 + 6 + title.length * 19 + 6 + meta.length * 14 + (slot.qr ? 10 + 68 : 0)
  if (!ctx) return height

  ctx.save()
  ctx.shadowColor = "rgb(0 0 0 / 0.18)"
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 10
  ctx.fillStyle = colors.bg
  ctx.beginPath()
  ctx.roundRect(0, 0, slot.w, height, 16)
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = colors.text
  ctx.textBaseline = "top"
  let y = pad
  ctx.globalAlpha = 0.85
  ctx.font = `600 10px ${font}`
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0.8px"
  for (const l of org) {
    ctx.fillText(l, pad, y)
    y += 13
  }
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px"
  y += 6
  ctx.globalAlpha = 1
  ctx.font = `600 16px ${font}`
  for (const l of title) {
    ctx.fillText(l, pad, y)
    y += 19
  }
  y += 6
  ctx.globalAlpha = 0.85
  ctx.font = `400 11px ${font}`
  for (const l of meta) {
    ctx.fillText(l, pad, y)
    y += 14
  }
  ctx.globalAlpha = 1
  if (slot.qr) {
    y += 10
    ctx.fillStyle = colors.qrBg
    ctx.beginPath()
    ctx.roundRect(pad, y, 68, 68, 8)
    ctx.fill()
    ctx.save()
    ctx.translate(pad + 6, y + 6)
    ctx.scale(56 / qr.size, 56 / qr.size)
    ctx.fillStyle = colors.qrFg
    ctx.fill(new Path2D(qr.d))
    ctx.restore()
  }
  return height
}

/**
 * The hero's wallet passes, drawn with three.js: they fly in, float, and lean toward the pointer.
 * With reduced motion they stand still; without WebGL the same passes are plain HTML.
 */
export function HeroPasses({ passes, qr }: { passes: PassData[]; qr: QrPath }) {
  const ref = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const [fallback, setFallback] = useState<Slot[] | null>(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return
    let disposed = false
    let cleanup = () => {}

    ;(async () => {
      const THREE = await import("three")
      await document.fonts.ready
      if (disposed) return

      let renderer: import("three").WebGLRenderer
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" })
      } catch {
        setFallback(layout(container.clientWidth))
        return
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%"
      container.appendChild(renderer.domElement)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(35, 1, 1, 10000)
      const style = getComputedStyle(container)
      const font = style.fontFamily
      const dark = document.documentElement.classList.contains("dark")
      const token = (name: string) => style.getPropertyValue(name).trim()
      const light = token(dark ? "--foreground" : "--primary-foreground")
      const ink = token(dark ? "--background" : "--foreground")

      type Card = { mesh: import("three").Mesh; slot: Slot; phase: number }
      let cards: Card[] = []
      let width = 0
      let height = 0

      const build = () => {
        for (const c of cards) {
          scene.remove(c.mesh)
          c.mesh.geometry.dispose()
          const material = c.mesh.material as import("three").MeshBasicMaterial
          material.map?.dispose()
          material.dispose()
        }
        cards = layout(width).map((slot, i) => {
          const pass = passes[slot.pass]
          const colors = {
            bg: token(pass.tone === 0 ? "--primary" : `--chart-${pass.tone}`),
            text: pass.tone === 0 ? token("--primary-foreground") : isLightTone(pass.tone) ? ink : light,
            qrBg: light,
            qrFg: ink,
          }
          const h = drawPass(null, pass, slot, qr, colors, font)
          // Room around the card for its soft shadow, which is part of the texture.
          const margin = 32
          const scale = 3
          const canvas = document.createElement("canvas")
          canvas.width = (slot.w + margin * 2) * scale
          canvas.height = (h + margin * 2) * scale
          const ctx = canvas.getContext("2d")!
          ctx.scale(scale, scale)
          ctx.translate(margin, margin)
          drawPass(ctx, pass, slot, qr, colors, font)
          const texture = new THREE.CanvasTexture(canvas)
          texture.colorSpace = THREE.SRGBColorSpace
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
          const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false })
          const mesh = new THREE.Mesh(new THREE.PlaneGeometry(slot.w + margin * 2, h + margin * 2), material)
          mesh.renderOrder = slot.z
          scene.add(mesh)
          return { mesh, slot, phase: i * 1.7 }
        })
      }

      const resize = () => {
        const w = container.clientWidth
        const h = container.clientHeight
        if (!w || !h) return
        const rebuild = layout(w).length !== layout(width).length
        width = w
        height = h
        renderer.setSize(w, h, false)
        camera.aspect = w / h
        // At z = 0 one world unit is one CSS pixel.
        camera.position.z = h / 2 / Math.tan((camera.fov * Math.PI) / 360)
        camera.updateProjectionMatrix()
        if (rebuild || !cards.length) build()
        else cards = cards.map((c, i) => ({ ...c, slot: layout(w)[i] }))
        if (still) frame(performance.now())
      }

      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
      const onPointer = (e: PointerEvent) => {
        pointer.tx = (e.clientX / window.innerWidth) * 2 - 1
        pointer.ty = (e.clientY / window.innerHeight) * 2 - 1
      }
      const start = performance.now()
      const ease = (t: number) => 1 - Math.pow(1 - t, 3)

      const frame = (now: number) => {
        const t = still ? 100 : (now - start) / 1000
        pointer.x += (pointer.tx - pointer.x) * 0.05
        pointer.y += (pointer.ty - pointer.y) * 0.05
        cards.forEach(({ mesh, slot, phase }, i) => {
          const enter = ease(Math.min(Math.max((t - 0.15 - i * 0.09) / 1.1, 0), 1))
          const float = still ? 0 : 1
          mesh.position.set(
            slot.x - width / 2 + pointer.x * 10 * float,
            height / 2 - slot.y + Math.sin(t * 0.8 + phase) * 7 * float - pointer.y * 6 * float,
            (1 - enter) * -420
          )
          mesh.rotation.set(
            (Math.sin(t * 0.6 + phase) * 0.12 + pointer.y * 0.2) * float,
            (Math.cos(t * 0.55 + phase) * 0.16 + pointer.x * 0.3) * float + (1 - enter) * 0.7,
            (-slot.rot * Math.PI) / 180 + Math.sin(t * 0.5 + phase) * 0.035 * float
          )
          mesh.scale.setScalar(0.85 + 0.15 * enter)
          ;(mesh.material as import("three").MeshBasicMaterial).opacity = enter
        })
        renderer.render(scene, camera)
      }

      // Animate only while the hero is on screen and the tab is visible.
      let raf = 0
      let visible = true
      const loop = (now: number) => {
        frame(now)
        raf = requestAnimationFrame(loop)
      }
      const update = () => {
        cancelAnimationFrame(raf)
        if (!still && visible && !document.hidden) raf = requestAnimationFrame(loop)
      }
      const io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting
        update()
      })
      const ro = new ResizeObserver(resize)
      io.observe(container)
      ro.observe(container)
      document.addEventListener("visibilitychange", update)
      if (!still) window.addEventListener("pointermove", onPointer, { passive: true })
      resize()
      update()

      cleanup = () => {
        cancelAnimationFrame(raf)
        io.disconnect()
        ro.disconnect()
        document.removeEventListener("visibilitychange", update)
        window.removeEventListener("pointermove", onPointer)
        width = -1
        for (const c of cards) {
          c.mesh.geometry.dispose()
          const material = c.mesh.material as import("three").MeshBasicMaterial
          material.map?.dispose()
          material.dispose()
        }
        renderer.dispose()
        renderer.domElement.remove()
      }
    })()

    return () => {
      disposed = true
      cleanup()
    }
  }, [passes, qr, resolvedTheme])

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0">
      {fallback?.map((slot) => (
        <WalletPass
          key={slot.pass}
          pass={passes[slot.pass]}
          qr={slot.qr ? qr : undefined}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: slot.x, top: slot.y, width: slot.w, rotate: `${slot.rot}deg` }}
        />
      ))}
    </div>
  )
}
