"use client"

import { useState, useEffect } from "react"

export const MUTE_SOUNDS_KEY = "omegacases_mute_sounds"

export function useMuteSounds() {
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    try {
      setMuted(localStorage.getItem(MUTE_SOUNDS_KEY) === "true")
    } catch {}
  }, [])

  const toggle = () =>
    setMuted((prev) => {
      const next = !prev
      try {
        localStorage.setItem(MUTE_SOUNDS_KEY, String(next))
      } catch {}
      return next
    })

  return { muted, toggle }
}
