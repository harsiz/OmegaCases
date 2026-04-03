import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const { user_id, item_id, server_seed, server_seed_hash, client_seed, nonce, float } = await request.json()
  if (!user_id || !item_id) {
    return NextResponse.json({ error: "Missing user_id or item_id" }, { status: 400 })
  }
  const supabase = await createClient()
  const { data, error } = await supabase.from("rolls").insert({
    user_id,
    item_id,
    server_seed:      server_seed      ?? null,
    server_seed_hash: server_seed_hash ?? null,
    client_seed:      client_seed      ?? "omegacases",
    nonce:            nonce            ?? 0,
    float:            float            ?? null,
  }).select("id").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data?.id ?? null })
}
