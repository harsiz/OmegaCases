import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/oauth/me?token=xxx — fetch authorized user info
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get("token")
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 })

  const db = await createClient()

  const { data: tok } = await db
    .from("oauth_tokens")
    .select("user_id, scopes")
    .eq("token", token)
    .single()

  if (!tok) return NextResponse.json({ error: "Invalid or revoked token" }, { status: 401 })

  const { data: user } = await db
    .from("users")
    .select("id, username, balance")
    .eq("id", tok.user_id)
    .single()

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  await db.from("oauth_tokens").update({ last_used_at: new Date().toISOString() }).eq("token", token)

  const result: any = {}
  if (tok.scopes.includes("read_id"))       result.user_id  = user.id
  if (tok.scopes.includes("read_username")) result.username = user.username
  if (tok.scopes.includes("read_balance"))  result.balance  = user.balance

  return NextResponse.json(result)
}
