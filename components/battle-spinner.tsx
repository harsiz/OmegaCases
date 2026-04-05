"use client"

import { useEffect, useRef, useState } from "react"
import { RARITY_COLORS, RARITY_GLOW } from "@/lib/types"

// Compact spinner sized to fit in a half-width battle column (~300px max)
const ITEM_W = 88
const ITEM_GAP = 6
const TOTAL_ITEM = ITEM_W + ITEM_GAP
const VISIBLE = 3
const MAX_W = VISIBLE * TOTAL_ITEM - ITEM_GAP // 270px
const STRIP_LEN = 38
const TARGET_POS = 30

const TICK_SRC =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/case%20tick%20sound-XkLDyOzDrmlVl8p3DMaTwFZjDlwS2P.mp3"

function playTick() {
  try {
    const a = new Audio(TICK_SRC)
    a.volume = 0.3
    a.play().catch(() => {})
  } catch {}
}

export interface SpinItem {
  id: string
  image_url: string
  name: string
  rarity: string
  likelihood?: number
}

interface Props {
  items: SpinItem[]
  targetItem: SpinItem
  spinning: boolean
  onComplete: () => void
  muted?: boolean
}

export default function BattleSpinner({ items, targetItem, spinning, onComplete, muted = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const animRef = useRef(0)
  const rafSetupRef = useRef(0)
  const lastTickRef = useRef(-1)
  const [strip, setStrip] = useState<SpinItem[]>([])

  // Keep a stable ref so changing onComplete never re-triggers the animation
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (!spinning || items.length === 0) return

    const s: SpinItem[] = []
    for (let i = 0; i < STRIP_LEN; i++) {
      s.push(i === TARGET_POS ? targetItem : items[Math.floor(Math.random() * items.length)])
    }
    setStrip(s)

    rafSetupRef.current = requestAnimationFrame(() => {
      const cw = containerRef.current?.offsetWidth ?? MAX_W
      const center = Math.floor(cw / 2)
      const finalOffset = TARGET_POS * TOTAL_ITEM - center + ITEM_W / 2
      const duration = 4200

      const startTime = performance.now()
      lastTickRef.current = -1

      const animate = (now: number) => {
        const t = Math.min((now - startTime) / duration, 1)
        const eased = 1 - Math.pow(1 - t, 3)
        const offset = finalOffset * eased

        if (trackRef.current) {
          trackRef.current.style.transform = `translateX(-${offset}px)`
        }

        const idx = Math.floor(offset / TOTAL_ITEM)
        if (idx !== lastTickRef.current && t < 0.93) {
          lastTickRef.current = idx
          if (!muted) playTick()
        }

        if (t < 1) {
          animRef.current = requestAnimationFrame(animate)
        } else {
          if (trackRef.current) {
            trackRef.current.style.transform = `translateX(-${finalOffset}px)`
          }
          onCompleteRef.current()
        }
      }

      animRef.current = requestAnimationFrame(animate)
    })

    return () => {
      cancelAnimationFrame(rafSetupRef.current)
      cancelAnimationFrame(animRef.current)
    }
  // onComplete intentionally excluded — use ref to avoid restarting animation on re-render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, targetItem, items, muted])

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl border-2 border-primary/70 bg-blue-50 dark:bg-slate-800 mx-auto"
      style={{ maxWidth: MAX_W }}
    >
      {/* Center marker */}
      <div
        className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-primary z-10 -translate-x-1/2 pointer-events-none"
        style={{ boxShadow: "0 0 6px var(--color-primary)" }}
      />
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-7 bg-gradient-to-r from-blue-50 dark:from-slate-800 to-transparent z-[5] pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-7 bg-gradient-to-l from-blue-50 dark:from-slate-800 to-transparent z-[5] pointer-events-none" />

      <div ref={trackRef} className="flex py-2 px-1 will-change-transform" style={{ gap: ITEM_GAP }}>
        {strip.map((item, i) => {
          const color = (RARITY_COLORS as Record<string, string>)[item.rarity] ?? "#9e9e9e"
          const glow = (RARITY_GLOW as Record<string, string>)[item.rarity] ?? ""
          return (
            <div
              key={i}
              className="shrink-0 flex flex-col items-center gap-1 rounded-lg border-2 bg-white dark:bg-slate-900"
              style={{ width: ITEM_W, borderColor: color, boxShadow: glow, padding: "4px" }}
            >
              <img
                src={item.image_url}
                alt={item.name}
                style={{ width: 52, height: 52 }}
                className="object-contain"
              />
              <span
                className="font-semibold text-center leading-tight overflow-hidden text-ellipsis whitespace-nowrap block text-[0.52rem]"
                style={{ color, maxWidth: 80 }}
              >
                {item.name}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
