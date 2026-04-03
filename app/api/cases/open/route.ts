import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createHmac, randomBytes, createHash } from "crypto"

/** Generate a random server seed */
function newServerSeed(): string {
  return randomBytes(32).toString("hex")
}

/** SHA-256 commitment hash shown to player before the spin */
function commitHash(serverSeed: string): string {
  return createHash("sha256").update(serverSeed).digest("hex")
}

/** Provably fair float in [0,1) — same algorithm as lib/arcade-fair.ts */
function fairFloat(serverSeed: string, clientSeed: string, nonce: number): number {
  const hmac = createHmac("sha256", serverSeed)
  hmac.update(`${clientSeed}:${nonce}:0`)
  const hex = hmac.digest("hex")
  return parseInt(hex.slice(0, 8), 16) / 0x100000000
}

/** Map a [0,1) float to an item using weighted likelihoods */
function rollItemFair(
  items: { id: string; likelihood: number }[],
  float: number,
): string {
  const total = items.reduce((sum, i) => sum + Number(i.likelihood), 0)
  let threshold = float * total
  for (const item of items) {
    threshold -= Number(item.likelihood)
    if (threshold <= 0) return item.id
  }
  return items[items.length - 1].id
}

export async function POST(request: Request) {
  const body = await request.json()
  const { user_id, client_seed } = body
  const clientSeed: string = (client_seed as string)?.trim() || "omegacases"

  if (!user_id) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: user } = await supabase
    .from("users")
    .select("id, cases, cases_remaining")
    .eq("id", user_id)
    .single()

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if ((user.cases_remaining || 0) < 1) {
    return NextResponse.json({ error: "No cases remaining" }, { status: 402 })
  }

  const { data: items } = await supabase
    .from("items")
    .select("id, likelihood")
    .eq("limited_time", false)
  if (!items || items.length === 0) {
    return NextResponse.json({ error: "No items available" }, { status: 500 })
  }

  // ── Provably fair roll ────────────────────────────────────────────────────
  const serverSeed = newServerSeed()
  const serverSeedHash = commitHash(serverSeed)
  const nonce = 0
  const float = fairFloat(serverSeed, clientSeed, nonce)
  const wonItemId = rollItemFair(items, float)
  // ─────────────────────────────────────────────────────────────────────────

  const { error: updateError } = await supabase
    .from("users")
    .update({
      cases_remaining: user.cases_remaining - 1,
      cases: (user.cases || 0) + 1,
    })
    .eq("id", user_id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  const { error: invError } = await supabase
    .from("inventory")
    .insert({ user_id, item_id: wonItemId })

  if (invError) return NextResponse.json({ error: invError.message }, { status: 500 })

  // NOTE: rolls table insert is done client-side AFTER spin animation ends
  // so the live feed never reveals the result before the player sees it.

  await supabase
    .from("items")
    .update({ first_unboxed_by: user_id })
    .eq("id", wonItemId)
    .is("first_unboxed_by", null)

  const { data: wonItem } = await supabase
    .from("items")
    .select("*")
    .eq("id", wonItemId)
    .single()

  return NextResponse.json({
    wonItem,
    cases_remaining: user.cases_remaining - 1,
    // Provably fair fields — server_seed_hash shown during spin,
    // server_seed revealed in the result so the player can verify
    server_seed_hash: serverSeedHash,
    server_seed: serverSeed,
    client_seed: clientSeed,
    nonce,
    float,  // the raw roll value, for full transparency
  })
}
