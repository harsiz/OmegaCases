import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createNotification } from "@/lib/notifications"

// POST /api/oauth/spend
// Body: { client_id, client_secret, user_id, amount }
// Deducts `amount` from user balance. Amount must be positive (spending only).
export async function POST(req: Request) {
  const { client_id, client_secret, user_id, amount } = await req.json()

  if (!client_id || !client_secret || !user_id || amount === undefined) {
    return NextResponse.json({ error: "client_id, client_secret, user_id, and amount required" }, { status: 400 })
  }

  const spend = Number(amount)
  if (!isFinite(spend) || spend <= 0) {
    return NextResponse.json({ error: "amount must be a positive number (spend only)" }, { status: 400 })
  }

  const db = await createClient()

  // Verify app credentials and scope
  const { data: app } = await db
    .from("oauth_apps")
    .select("name, scopes")
    .eq("client_id", client_id)
    .eq("client_secret", client_secret)
    .single()

  if (!app) return NextResponse.json({ error: "Invalid client credentials" }, { status: 401 })
  if (!app.scopes.includes("spend_balance")) {
    return NextResponse.json({ error: "App does not have spend_balance scope" }, { status: 403 })
  }

  // Fetch user
  const { data: user } = await db
    .from("users")
    .select("id, balance")
    .eq("id", user_id)
    .single()

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const currentBalance = Number(user.balance)
  if (currentBalance < spend) {
    return NextResponse.json({ error: "Insufficient balance" }, { status: 402 })
  }

  const newBalance = parseFloat((currentBalance - spend).toFixed(2))

  const { error: updateErr } = await db
    .from("users")
    .update({ balance: newBalance })
    .eq("id", user_id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Notify user
  await createNotification({
    user_id,
    type: "oauth_spend",
    title: `${app.name} spent $${spend.toFixed(2)}`,
    body: `${app.name} has spent $${spend.toFixed(2)} from your balance.`,
  })

  return NextResponse.json({ ok: true, new_balance: newBalance, spent: spend })
}
