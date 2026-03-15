import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const CONFIRMED_STATUSES = ["finished", "confirmed", "complete", "partially_paid"]

export async function POST(request: Request) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  console.log("[v0] NOWPayments webhook received:", JSON.stringify(body))

  const { payment_id, payment_status, price_amount, actually_paid, order_id } = body

  if (!CONFIRMED_STATUSES.includes(payment_status)) {
    console.log("[v0] Webhook status not confirmed:", payment_status)
    return NextResponse.json({ ok: true })
  }

  const supabase = createClient()

  let deposit: any = null

  // 1. Try by payment_id (most reliable)
  if (payment_id) {
    const { data } = await supabase
      .from("deposits")
      .select("*")
      .eq("payment_id", String(payment_id))
      .maybeSingle()
    deposit = data
    console.log("[v0] Lookup by payment_id:", payment_id, "->", deposit?.id ?? "not found")
  }

  // 2. Fallback: extract user_id from order_id (format: oc_{user_id}_{timestamp})
  if (!deposit && typeof order_id === "string" && order_id.startsWith("oc_")) {
    const parts = order_id.split("_")
    // order_id = "oc_<uuid>_<timestamp>" — uuid contains hyphens so rejoin middle parts
    // parts[0]="oc", parts[1..5]=uuid segments, last=timestamp
    const userId = parts.slice(1, -1).join("_")
    console.log("[v0] Fallback lookup by user_id from order_id:", userId)
    const { data } = await supabase
      .from("deposits")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    deposit = data
    console.log("[v0] Fallback by user_id ->", deposit?.id ?? "not found")
  }

  if (!deposit) {
    console.log("[v0] No matching deposit found, ignoring webhook")
    return NextResponse.json({ ok: true })
  }

  if (deposit.status === "confirmed") {
    console.log("[v0] Deposit already confirmed, skipping:", deposit.id)
    return NextResponse.json({ ok: true })
  }

  const creditAmount = Number(actually_paid || price_amount || deposit.amount_usd)
  console.log("[v0] Crediting user:", deposit.user_id, "amount:", creditAmount)

  const { data: user } = await supabase
    .from("users")
    .select("balance")
    .eq("id", deposit.user_id)
    .single()

  if (!user) {
    console.log("[v0] User not found:", deposit.user_id)
    return NextResponse.json({ ok: true })
  }

  const newBalance = Number(user.balance) + creditAmount
  console.log("[v0] Updating balance from", user.balance, "to", newBalance)

  const [userUpdate, depositUpdate] = await Promise.all([
    supabase
      .from("users")
      .update({ balance: newBalance })
      .eq("id", deposit.user_id),
    supabase
      .from("deposits")
      .update({ status: "confirmed", amount_usd: creditAmount })
      .eq("id", deposit.id),
  ])

  console.log("[v0] User update error:", userUpdate.error?.message ?? "none")
  console.log("[v0] Deposit update error:", depositUpdate.error?.message ?? "none")

  return NextResponse.json({ ok: true })
}
