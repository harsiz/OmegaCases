import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createHmac, createHash } from "crypto"

// GET /api/rolls/verify?id=<roll_id>
// Returns full provably fair verification data for a roll.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const supabase = await createClient()
  const { data: roll, error } = await supabase
    .from("rolls")
    .select(`
      id, created_at, user_id, item_id,
      server_seed, server_seed_hash, client_seed, nonce, float,
      users ( username ),
      items ( name, rarity, image_url, rap )
    `)
    .eq("id", id)
    .single()

  if (error || !roll) return NextResponse.json({ error: "Roll not found" }, { status: 404 })

  // Recompute to verify integrity
  let verified = false
  let recomputed_hash: string | null = null
  let recomputed_float: number | null = null

  if (roll.server_seed) {
    recomputed_hash = createHash("sha256").update(roll.server_seed).digest("hex")

    const hmac = createHmac("sha256", roll.server_seed)
    hmac.update(`${roll.client_seed}:${roll.nonce}:0`)
    const hex = hmac.digest("hex")
    recomputed_float = parseInt(hex.slice(0, 8), 16) / 0x100000000

    verified =
      recomputed_hash === roll.server_seed_hash &&
      (roll.float === null || Math.abs(recomputed_float - roll.float) < 1e-9)
  }

  return NextResponse.json({
    id: roll.id,
    created_at: roll.created_at,
    username: (roll as any).users?.username ?? "unknown",
    item: (roll as any).items,
    server_seed:      roll.server_seed,
    server_seed_hash: roll.server_seed_hash,
    client_seed:      roll.client_seed,
    nonce:            roll.nonce,
    float:            roll.float,
    recomputed_hash,
    recomputed_float,
    verified,
    preimage: roll.server_seed
      ? `${roll.client_seed}:${roll.nonce}:0`
      : null,
    algorithm: "HMAC-SHA256(serverSeed, clientSeed:nonce:0) → first 8 hex chars as uint32 / 0x100000000",
  })
}
