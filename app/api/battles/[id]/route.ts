import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()

  const { data: battle } = await db.from("battles").select("*").eq("id", id).single()
  if (!battle) return NextResponse.json({ error: "Battle not found" }, { status: 404 })

  const userIds = [battle.creator_id, battle.joiner_id, battle.joiner2_id, battle.joiner3_id].filter(Boolean) as string[]
  const { data: users } = await db
    .from("users")
    .select("id, username, profile_picture, plus")
    .in("id", userIds)

  const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]))

  const { data: rolls } = await db
    .from("battle_rolls")
    .select("*, items(*)")
    .eq("battle_id", id)
    .order("roll_index", { ascending: true })

  return NextResponse.json({
    ...battle,
    creator: userMap[battle.creator_id] ?? null,
    joiner: battle.joiner_id ? (userMap[battle.joiner_id] ?? null) : null,
    joiner2: battle.joiner2_id ? (userMap[battle.joiner2_id] ?? null) : null,
    joiner3: battle.joiner3_id ? (userMap[battle.joiner3_id] ?? null) : null,
    rolls: rolls ?? [],
  })
}
