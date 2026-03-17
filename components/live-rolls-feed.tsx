"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Box, Typography, Chip } from "@mui/material"

const RARITY_COLORS: Record<string, string> = {
  Common: "#9e9e9e",
  Uncommon: "#4caf50",
  Rare: "#2196f3",
  Legendary: "#ff9800",
  Omega: "#e91e63",
}

type Roll = {
  id: string
  created_at: string
  user_id: string
  item_id: string
  username?: string
  item_name?: string
  image_url?: string
  rarity?: string
  rap?: number
}

const MAX_ROLLS = 30

async function fetchRollDetails(supabase: ReturnType<typeof createClient>, rollId: string): Promise<Roll | null> {
  const { data } = await supabase
    .from("rolls")
    .select("id, created_at, user_id, item_id")
    .eq("id", rollId)
    .single()
  if (!data) return null

  const [userRes, itemRes] = await Promise.all([
    supabase.from("users").select("username").eq("id", data.user_id).single(),
    supabase.from("items").select("name, image_url, rarity, rap").eq("id", data.item_id).single(),
  ])

  return {
    ...data,
    username: userRes.data?.username ?? "anon",
    item_name: itemRes.data?.name ?? "Unknown",
    image_url: itemRes.data?.image_url ?? null,
    rarity: itemRes.data?.rarity ?? "Common",
    rap: itemRes.data?.rap ?? 0,
  }
}

async function fetchRecentRolls(supabase: ReturnType<typeof createClient>): Promise<Roll[]> {
  const { data } = await supabase
    .from("rolls")
    .select("id, created_at, user_id, item_id")
    .order("created_at", { ascending: false })
    .limit(20)
  if (!data || data.length === 0) return []

  const enriched = await Promise.all(
    data.map(async (roll) => {
      const [userRes, itemRes] = await Promise.all([
        supabase.from("users").select("username").eq("id", roll.user_id).single(),
        supabase.from("items").select("name, image_url, rarity, rap").eq("id", roll.item_id).single(),
      ])
      return {
        ...roll,
        username: userRes.data?.username ?? "anon",
        item_name: itemRes.data?.name ?? "Unknown",
        image_url: itemRes.data?.image_url ?? null,
        rarity: itemRes.data?.rarity ?? "Common",
        rap: itemRes.data?.rap ?? 0,
      }
    })
  )
  return enriched.reverse()
}

export default function LiveRollsFeed() {
  const [rolls, setRolls] = useState<Roll[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const seenIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    const supabase = createClient()

    // Load initial rolls
    fetchRecentRolls(supabase).then((initial) => {
      initial.forEach((r) => seenIds.current.add(r.id))
      setRolls(initial)
    })

    // Realtime subscription
    const channel = supabase
      .channel("rolls-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rolls" },
        async (payload) => {
          const id = payload.new.id as string
          if (seenIds.current.has(id)) return
          seenIds.current.add(id)
          const roll = await fetchRollDetails(supabase, id)
          if (roll) {
            setRolls((prev) => {
              const next = [...prev, roll]
              return next.slice(-MAX_ROLLS)
            })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Auto-scroll to bottom when new roll arrives
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [rolls])

  return (
    <Box
      sx={{
        width: 220,
        flexShrink: 0,
        position: "sticky",
        top: 72,
        height: "calc(100vh - 80px)",
        display: { xs: "none", lg: "flex" },
        flexDirection: "column",
        bgcolor: "background.paper",
        borderLeft: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <Box sx={{ px: 1.5, py: 1, borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 8, height: 8, borderRadius: "50%", bgcolor: "#4caf50",
              boxShadow: "0 0 6px #4caf50",
              animation: "pulse 2s infinite",
              "@keyframes pulse": {
                "0%, 100%": { opacity: 1 },
                "50%": { opacity: 0.4 },
              },
            }}
          />
          <Typography variant="caption" fontWeight={700} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            Live Rolls
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
            {rolls.length}
          </Typography>
        </Box>
      </Box>

      {/* Roll list */}
      <Box
        ref={listRef}
        sx={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          "&::-webkit-scrollbar": { width: 3 },
          "&::-webkit-scrollbar-thumb": { bgcolor: "divider", borderRadius: 2 },
        }}
      >
        {rolls.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
            No rolls yet...
          </Typography>
        )}
        {rolls.map((roll) => {
          const rarity = roll.rarity ?? "Common"
          const color = RARITY_COLORS[rarity] ?? "#9e9e9e"
          return (
            <Box
              key={roll.id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 0.75,
                borderBottom: "1px solid",
                borderColor: "divider",
                borderLeft: `3px solid ${color}`,
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Box
                component="img"
                src={roll.image_url ?? "/placeholder.svg?width=32&height=32"}
                alt={roll.item_name ?? "item"}
                sx={{ width: 32, height: 32, objectFit: "contain", flexShrink: 0, borderRadius: 1 }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" fontWeight={700}
                  sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color }}>
                  {roll.item_name}
                </Typography>
                <Typography variant="caption" color="text.secondary"
                  sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.65rem" }}>
                  {roll.username}
                </Typography>
              </Box>
              {roll.rap != null && roll.rap > 0 && (
                <Chip label={`$${Number(roll.rap).toFixed(0)}`} size="small"
                  sx={{
                    height: 18, fontSize: "0.6rem", fontWeight: 700,
                    bgcolor: color + "22", color, flexShrink: 0,
                    "& .MuiChip-label": { px: 0.75 },
                  }}
                />
              )}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
