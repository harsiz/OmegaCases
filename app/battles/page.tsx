"use client"

import { useState, useEffect, useCallback } from "react"
import NextLink from "next/link"
import { useRouter } from "next/navigation"
import { Swords, Users, Plus, Loader2, ChevronRight, Crown, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"

interface BattleUser {
  id: string
  username: string
  profile_picture: string | null
  plus: boolean
}

interface Battle {
  id: string
  creator_id: string
  case_count: number
  status: string
  created_at: string
  creator: BattleUser | null
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}

export default function BattlesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [battles, setBattles] = useState<Battle[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState<string | null>(null)
  const [selectedCount, setSelectedCount] = useState(1)
  const [joinError, setJoinError] = useState<string | null>(null)

  const fetchBattles = useCallback(async () => {
    try {
      const res = await fetch("/api/battles")
      const data = res.ok ? await res.json() : {}
      setBattles(Array.isArray(data.battles) ? data.battles : [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchBattles()
  }, [fetchBattles])

  // Realtime: refresh lobby on any battles table change
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("battles-lobby")
      .on("postgres_changes", { event: "*", schema: "public", table: "battles" }, () => {
        fetchBattles()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchBattles])

  const createBattle = async () => {
    if (!user || creating) return
    setCreating(true)
    try {
      const res = await fetch("/api/battles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, case_count: selectedCount }),
      })
      const data = res.ok ? await res.json() : null
      if (data?.battle?.id) {
        router.push(`/battles/${data.battle.id}`)
      } else {
        setJoinError(data?.error ?? "Failed to create battle")
      }
    } finally {
      setCreating(false)
    }
  }

  const joinBattle = async (battleId: string) => {
    if (!user || joining) return
    setJoinError(null)
    setJoining(battleId)
    try {
      const res = await fetch(`/api/battles/${battleId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      })
      if (res.ok) {
        router.push(`/battles/${battleId}`)
      } else {
        const data = await res.json()
        setJoinError(data?.error ?? "Failed to join")
      }
    } finally {
      setJoining(null)
    }
  }

  const casesAvailable = user?.cases_remaining ?? 0
  const hasEnough = casesAvailable >= selectedCount

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
          <NextLink href="/open"><ArrowLeft size={15} /></NextLink>
        </Button>
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Swords size={18} className="text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight">Case Battles</h1>
          <p className="text-xs text-muted-foreground">Challenge opponents to head-to-head case duels</p>
        </div>
      </div>

      {joinError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-sm text-destructive">
          {joinError}
        </div>
      )}

      <div className="grid md:grid-cols-[280px_1fr] gap-4 items-start">
        {/* Create Battle Card */}
        <div className="bg-card border border-border/60 rounded-xl p-4 space-y-4">
          <h2 className="text-sm font-bold">Create Battle</h2>
          {user ? (
            <>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Cases per player</p>
                <div className="flex gap-2">
                  {[1, 3, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setSelectedCount(n)}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${
                        selectedCount === n
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border/60 hover:border-primary/40 text-muted-foreground"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-muted/40 rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Cases needed</span>
                  <span className="font-semibold">{selectedCount}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Your cases</span>
                  <span className={`font-semibold ${hasEnough ? "text-green-400" : "text-destructive"}`}>
                    {casesAvailable}
                  </span>
                </div>
              </div>

              <Button className="w-full" onClick={createBattle} disabled={!hasEnough || creating}>
                {creating
                  ? <Loader2 size={14} className="animate-spin mr-2" />
                  : <Plus size={14} className="mr-2" />
                }
                Create Battle
              </Button>

              {!hasEnough && (
                <p className="text-xs text-muted-foreground text-center">
                  Need {selectedCount} cases.{" "}
                  <NextLink href="/open" className="text-primary hover:underline">Get more</NextLink>
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              <NextLink href="/login" className="text-primary hover:underline">Sign in</NextLink> to create or join battles
            </p>
          )}
        </div>

        {/* Open Battles List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Open Battles</h2>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users size={11} />
              {battles.length} waiting
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : battles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 bg-muted/20 rounded-xl border border-border/40">
              <Swords size={28} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No open battles — be the first!</p>
            </div>
          ) : (
            battles.map((battle) => {
              const isOwn = user?.id === battle.creator_id
              const canJoin = user && !isOwn && casesAvailable >= battle.case_count
              return (
                <div
                  key={battle.id}
                  className="flex items-center gap-3 bg-card border border-border/60 rounded-xl px-4 py-3 hover:border-primary/30 transition-colors"
                >
                  <Avatar className="w-8 h-8 shrink-0">
                    {battle.creator?.profile_picture && <AvatarImage src={battle.creator.profile_picture} />}
                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                      {battle.creator?.username?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold truncate">{battle.creator?.username}</span>
                      {battle.creator?.plus && <Crown size={9} className="text-amber-400 shrink-0" />}
                      {isOwn && <span className="text-[0.6rem] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">You</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{timeAgo(battle.created_at)}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 bg-muted/60 rounded-lg px-2.5 py-1">
                      <Swords size={10} className="text-muted-foreground" />
                      <span className="text-xs font-bold">{battle.case_count}</span>
                    </div>
                    {isOwn ? (
                      <NextLink href={`/battles/${battle.id}`}>
                        <Button size="sm" variant="outline" className="h-7 px-3 text-xs">View</Button>
                      </NextLink>
                    ) : user ? (
                      <Button
                        size="sm"
                        className="h-7 px-3 text-xs"
                        onClick={() => joinBattle(battle.id)}
                        disabled={!canJoin || joining === battle.id}
                        title={!canJoin ? `Need ${battle.case_count} cases to join` : undefined}
                      >
                        {joining === battle.id
                          ? <Loader2 size={11} className="animate-spin" />
                          : <>Join <ChevronRight size={11} /></>
                        }
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
