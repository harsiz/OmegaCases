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
      .on("presence", { event: "sync" }, async () => {
        const state = channel.presenceState<{ user_id: string; username: string }>()
        const keys = Object.keys(state)
        setCount(keys.length)

        // Each key maps to an array of presence entries (multiple tabs); take first
        const list: OnlineUser[] = keys.map((key) => {
          const entry = (state[key] as any[])[0] ?? {}
          return {
            userId: entry.user_id ?? key,
            username: entry.username ?? "",
          }
        })

        // For any entries missing a username (old presence / pre-fix connections),
        // batch-fetch real usernames from the DB by user_id
        const missing = list.filter((u) => !u.username).map((u) => u.userId)
        if (missing.length > 0) {
          const { data } = await supabase
            .from("users")
            .select("id, username")
            .in("id", missing)
          if (data) {
            const nameMap = new Map(data.map((u: any) => [u.id, u.username as string]))
            list.forEach((u) => {
              if (!u.username) u.username = nameMap.get(u.userId) ?? u.userId.slice(0, 8)
            })
          }
        }

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
