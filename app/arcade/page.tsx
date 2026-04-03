"use client"

import { Layers3, Hammer } from "lucide-react"

export default function ArcadePage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-24 flex flex-col items-center text-center gap-5">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Layers3 size={30} className="text-primary" />
      </div>
      <h1 className="text-3xl font-bold">Arcade</h1>
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5">
        <Hammer size={14} /> Coming Soon
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
        Provably fair games are on the way. Check back soon.
      </p>
    </div>
  )
}
