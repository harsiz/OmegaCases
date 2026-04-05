"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import NextLink from "next/link"
import { Swords, Trophy, Copy, Loader2, Crown, ArrowLeft, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import { RARITY_COLORS } from "@/lib/types"

// ── Types ──────────────────────────────────────────────────────────────────────

interface BattleUser {
  id: string
  username: string
  profile_picture: string | null
  plus: boolean
}

interface RollItem {
  id: string
  name: string
  image_url: string
  rarity: string
  market_price: number
}

interface BattleRoll {
  id: string
  user_id: string
  item_id: string
  round: number
  roll_index: number
  rap: number
  items: RollItem
}

interface Battle {
  id: string
  creator_id: string
  joiner_id: string | null
  winner_id: string | null
  status: "waiting" | "in_progress" | "completed" | "cancelled"
  case_count: number
  created_at: string
  completed_at: string | null
  creator: BattleUser | null
  joiner: BattleUser | null
  rolls: BattleRoll[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildRounds(rolls: BattleRoll[], creatorId: string) {
  const byRound = new Map<number, { creator?: BattleRoll; joiner?: BattleRoll }>()
  for (const roll of rolls) {
    if (!byRound.has(roll.round)) byRound.set(roll.round, {})
    const entry = byRound.get(roll.round)!
    if (roll.user_id === creatorId) entry.creator = roll
    else entry.joiner = roll
  }
  return [...byRound.entries()]
    .map(([round, entry]) => ({ round, creatorRoll: entry.creator, joinerRoll: entry.joiner }))
    .sort((a, b) => a.round - b.round)
}

function runningRap(rolls: BattleRoll[], userId: string, upToRound: number) {
  return rolls
    .filter((r) => r.user_id === userId && r.round <= upToRound)
    .reduce((sum, r) => sum + Number(r.rap), 0)
}

// ── Item card ──────────────────────────────────────────────────────────────────

function ItemCard({ roll, revealed }: { roll?: BattleRoll; revealed: boolean }) {
  if (!revealed || !roll) {
    return (
      <div className="w-full aspect-square max-w-[130px] mx-auto rounded-xl bg-muted/40 border border-border/40 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full bg-muted/60 animate-pulse" />
      </div>
    )
  }
  const color = (RARITY_COLORS as Record<string, string>)[roll.items.rarity] ?? "#9e9e9e"
  return (
    <div
      className="w-full max-w-[130px] mx-auto rounded-xl border p-2.5 flex flex-col items-center gap-1.5 animate-in fade-in zoom-in-95 duration-300"
      style={{ borderColor: color + "60", background: color + "10" }}
    >
      <img src={roll.items.image_url} alt={roll.items.name} className="w-16 h-16 object-contain" />
      <p className="text-[0.65rem] font-semibold text-center leading-tight line-clamp-2">{roll.items.name}</p>
      <p className="text-xs font-bold" style={{ color }}>${Number(roll.rap).toFixed(2)}</p>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function BattleRoomPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [battle, setBattle] = useState<Battle | null>(null)
  const [pageStatus, setPageStatus] = useState<"loading" | "waiting" | "animating" | "done">("loading")
  const [revealedRound, setRevealedRound] = useState(-1)
  const [copied, setCopied] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const animStartedRef = useRef(false)

  const fetchBattle = useCallback(async () => {
    try {
      const res = await fetch(`/api/battles/${id}`)
      if (!res.ok) return
      const data: Battle = await res.json()
      setBattle(data)
      if (data.status === "completed") {
        setPageStatus("animating")
      } else if (data.status === "waiting" || data.status === "in_progress") {
        setPageStatus("waiting")
      } else {
        setPageStatus("done")
      }
    } catch {}
  }, [id])

  useEffect(() => {
    fetchBattle()
  }, [fetchBattle])

  // Realtime: watch for status change on this battle
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`battle-room-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "battles", filter: `id=eq.${id}` },
        async (payload) => {
          const newStatus = payload.new?.status
          if (newStatus === "completed" || newStatus === "cancelled") {
            await fetchBattle()
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id, fetchBattle])

  // Animation
  useEffect(() => {
    if (pageStatus !== "animating" || !battle || animStartedRef.current) return
    animStartedRef.current = true

    const rounds = buildRounds(battle.rolls, battle.creator_id)
    const total = rounds.length
    if (total === 0) { setPageStatus("done"); return }

    setRevealedRound(0)

    animTimerRef.current = setInterval(() => {
      setRevealedRound((prev) => {
        if (prev >= total - 1) {
          clearInterval(animTimerRef.current!)
          setTimeout(() => setPageStatus("done"), 600)
          return prev
        }
        return prev + 1
      })
    }, 1500)

    return () => {
      if (animTimerRef.current) clearInterval(animTimerRef.current)
    }
  }, [pageStatus, battle])

  const cancelBattle = async () => {
    if (!user || !battle || cancelling) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/battles/${battle.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      })
      if (res.ok) await fetchBattle()
    } finally {
      setCancelling(false)
    }
  }

  const copyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // ── Render: loading ──
  if (pageStatus === "loading") {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!battle) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <p className="text-muted-foreground">Battle not found.</p>
      </div>
    )
  }

  // ── Render: cancelled ──
  if (battle.status === "cancelled") {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] gap-4">
        <X size={32} className="text-destructive" />
        <p className="text-lg font-bold">Battle Cancelled</p>
        <p className="text-sm text-muted-foreground">Cases were refunded to the creator.</p>
        <Button variant="outline" asChild>
          <NextLink href="/battles"><ArrowLeft size={14} className="mr-2" />Back to Battles</NextLink>
        </Button>
      </div>
    )
  }

  // ── Render: waiting ──
  if (pageStatus === "waiting") {
    return (
      <div className="max-w-md mx-auto px-4 py-10 flex flex-col items-center gap-5">
        <div className="flex items-center gap-2">
          <Swords size={18} className="text-primary" />
          <h1 className="text-base font-bold">Battle #{battle.id.slice(0, 8)}</h1>
        </div>

        <div className="w-full bg-card border border-border/60 rounded-xl p-4 flex items-center gap-3">
          <Avatar className="w-10 h-10 shrink-0">
            {battle.creator?.profile_picture && <AvatarImage src={battle.creator.profile_picture} />}
            <AvatarFallback className="bg-primary/20 text-primary font-bold">
              {battle.creator?.username?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{battle.creator?.username}</p>
            <p className="text-xs text-muted-foreground">{battle.case_count} case{battle.case_count > 1 ? "s" : ""} ready</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold bg-amber-500/10 rounded-lg px-2.5 py-1.5 shrink-0">
            <Loader2 size={11} className="animate-spin" /> Waiting...
          </div>
        </div>

        <div className="w-full space-y-2">
          <p className="text-xs text-center text-muted-foreground">Share this link to invite an opponent</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-muted/60 border border-border/40 rounded-lg px-3 py-1.5 text-xs font-mono text-muted-foreground overflow-hidden">
              <span className="block truncate">
                {typeof window !== "undefined" ? window.location.href : ""}
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={copyLink} className="shrink-0 gap-1.5">
              <Copy size={12} />{copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>

        {user?.id === battle.creator_id && (
          <Button variant="destructive" size="sm" onClick={cancelBattle} disabled={cancelling}>
            {cancelling ? <Loader2 size={13} className="animate-spin mr-2" /> : <X size={13} className="mr-2" />}
            Cancel Battle
          </Button>
        )}

        <NextLink href="/battles" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft size={11} /> Back to lobby
        </NextLink>
      </div>
    )
  }

  // ── Render: animating / done ──

  const rounds = buildRounds(battle.rolls, battle.creator_id)
  const mainRounds = rounds.filter((r) => r.round < battle.case_count)
  const tieRounds = rounds.filter((r) => r.round >= battle.case_count)
  const isDone = pageStatus === "done"

  const creatorTotalRap = battle.rolls
    .filter((r) => r.user_id === battle.creator_id)
    .reduce((sum, r) => sum + Number(r.rap), 0)
  const joinerTotalRap = battle.rolls
    .filter((r) => r.user_id !== battle.creator_id)
    .reduce((sum, r) => sum + Number(r.rap), 0)

  const winner = battle.winner_id === battle.creator_id ? battle.creator : battle.joiner

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <NextLink href="/battles" className="text-muted-foreground hover:text-foreground transition-colors mr-1">
          <ArrowLeft size={15} />
        </NextLink>
        <Swords size={15} className="text-primary" />
        <span className="text-sm font-bold">Case Battle</span>
        <span className="text-xs text-muted-foreground font-mono">#{battle.id.slice(0, 8)}</span>
      </div>

      {/* Winner banner */}
      {isDone && winner && (
        <div className="flex items-center justify-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl py-3 px-4">
          <Trophy size={18} className="text-amber-400" />
          <div className="text-center">
            <p className="text-[0.65rem] text-muted-foreground uppercase tracking-wider font-bold">Winner</p>
            <p className="text-base font-bold">{winner.username}</p>
          </div>
          <Trophy size={18} className="text-amber-400" />
        </div>
      )}

      {/* Player headers with running RAP */}
      <div className="grid grid-cols-2 gap-3">
        {([battle.creator, battle.joiner] as (BattleUser | null)[]).map((player, idx) => {
          const isWinner = isDone && player?.id === battle.winner_id
          const visibleRound = revealedRound
          const rap = battle.rolls.length > 0
            ? runningRap(battle.rolls, idx === 0 ? battle.creator_id : (battle.joiner_id ?? ""), visibleRound)
            : 0
          return (
            <div
              key={idx}
              className={`flex items-center gap-2 bg-card border rounded-xl p-3 transition-colors ${
                isWinner ? "border-amber-500/50 bg-amber-500/5" : "border-border/60"
              }`}
            >
              <Avatar className="w-8 h-8 shrink-0">
                {player?.profile_picture && <AvatarImage src={player.profile_picture} />}
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                  {player?.username?.[0]?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <p className="text-xs font-bold truncate">{player?.username ?? (idx === 0 ? "Creator" : "Opponent")}</p>
                  {player?.plus && <Crown size={8} className="text-amber-400 shrink-0" />}
                  {isWinner && <Trophy size={10} className="text-amber-400 shrink-0" />}
                </div>
                <p className="text-xs font-bold text-primary tabular-nums">
                  ${isDone ? (idx === 0 ? creatorTotalRap : joinerTotalRap).toFixed(2) : rap.toFixed(2)}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Main rounds */}
      <div className="space-y-2">
        {mainRounds.map(({ round, creatorRoll, joinerRoll }) => {
          const revealed = isDone || round <= revealedRound
          return (
            <div key={round} className="grid grid-cols-2 gap-3 bg-card/50 border border-border/40 rounded-xl p-3">
              <ItemCard roll={creatorRoll} revealed={revealed} />
              <ItemCard roll={joinerRoll} revealed={revealed} />
            </div>
          )
        })}

        {/* Tiebreaker rounds */}
        {tieRounds.length > 0 && (
          <>
            <div className="flex items-center gap-3 py-0.5">
              <div className="flex-1 h-px bg-border/40" />
              <span className="text-[0.65rem] font-bold text-primary tracking-wider uppercase px-2">Tiebreaker</span>
              <div className="flex-1 h-px bg-border/40" />
            </div>
            {tieRounds.map(({ round, creatorRoll, joinerRoll }) => {
              const revealed = isDone || round <= revealedRound
              return (
                <div key={round} className="grid grid-cols-2 gap-3 bg-primary/5 border border-primary/20 rounded-xl p-3">
                  <ItemCard roll={creatorRoll} revealed={revealed} />
                  <ItemCard roll={joinerRoll} revealed={revealed} />
                </div>
              )
            })}
          </>
        )}

        {/* Waiting for animation */}
        {!isDone && (
          <div className="flex justify-center py-2">
            <Loader2 size={16} className="animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  )
}
