"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface OnlineUser {
  userId: string
  username: string
}

interface OnlineUsersResult {
  count: number
  users: OnlineUser[]
}

export function useOnlineUsers(
  userId?: string | null,
  username?: string | null
): OnlineUsersResult {
  const [count, setCount] = useState(0)
  const [users, setUsers] = useState<OnlineUser[]>([])

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    const channel = supabase.channel("online-users", {
      config: { presence: { key: userId } },
    })

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ user_id: string; username: string }>()
        const keys = Object.keys(state)
        setCount(keys.length)
        // Each key maps to an array of presence entries (multiple tabs); take first
        const list: OnlineUser[] = keys.map((key) => {
          const entry = (state[key] as any[])[0] ?? {}
          return {
            userId: entry.user_id ?? key,
            username: entry.username ?? key.slice(0, 8),
          }
        })
        setUsers(list)
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId,
            username: username ?? userId.slice(0, 8),
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, username])

  return { count, users }
}
