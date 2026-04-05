import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()

  let body: { user_id: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { user_id } = body
  if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 })

  const { data: battle } = await db.from("battles").select("*").eq("id", id).single()
  if (!battle) return NextResponse.json({ error: "Battle not found" }, { status: 404 })
  if (battle.creator_id !== user_id) {
    return NextResponse.json({ error: "Only the creator can cancel" }, { status: 403 })
  }
  if (battle.status !== "waiting") {
    return NextResponse.json({ error: "Battle cannot be cancelled" }, { status: 409 })
  }

  // Refund cases to creator
  const { data: creator } = await db.from("users").select("cases_remaining").eq("id", user_id).single()
  if (creator) {
    await db
      .from("users")
      .update({ cases_remaining: creator.cases_remaining + battle.case_count })
      .eq("id", user_id)
  }

  await db.from("battles").update({ status: "cancelled" }).eq("id", id)

  return NextResponse.json({ success: true })
}
