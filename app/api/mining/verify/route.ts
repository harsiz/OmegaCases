import { NextResponse } from "next/server"
import { createHash } from "crypto"

// GET /api/mining/verify?prev_hash=...&miner_id=...&nonce=...
// Returns the SHA-256 hash the server would compute for a given preimage.
// Use this to debug preimage format mismatches between your miner and the server.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const prev_hash = searchParams.get("prev_hash")
  const miner_id = searchParams.get("miner_id")
  const nonce = searchParams.get("nonce")

  if (!prev_hash || !miner_id || nonce === null) {
    return NextResponse.json({
      error: "prev_hash, miner_id, and nonce are all required",
      example: "/api/mining/verify?prev_hash=0000...&miner_id=uuid&nonce=12345",
    }, { status: 400 })
  }

  const preimage = `${prev_hash}${miner_id}${nonce}`
  const hash = createHash("sha256").update(preimage).digest("hex")

  return NextResponse.json({
    preimage,
    preimage_length: preimage.length,
    hash,
  })
}
