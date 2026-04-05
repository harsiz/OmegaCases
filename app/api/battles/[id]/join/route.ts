import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createHmac, randomBytes } from "crypto"

function fairFloat(serverSeed: string, clientSeed: string, nonce: number): number {
  const hmac = createHmac("sha256", serverSeed)
  hmac.update(`${clientSeed}:${nonce}:0`)
  return parseInt(hmac.digest("hex").slice(0, 8), 16) / 0x100000000
}

function rollItem(items: { id: string; likelihood: number }[], float: number): string {
  const total = items.reduce((sum, i) => sum + Number(i.likelihood), 0)
  let threshold = float * total
  for (const item of items) {
    threshold -= Number(item.likelihood)
    if (threshold <= 0) return item.id
  }
  return items[items.length - 1].id
}

type RollInsert = {
  battle_id: string
  user_id: string
  item_id: string
  round: number
  roll_index: number
  rap: number
  float: number
  server_seed: string
  client_seed: string
  nonce: number
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()

  let body: { user_id: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { user_id: newJoinerId } = body
  if (!newJoinerId) return NextResponse.json({ error: "user_id required" }, { status: 400 })

  // Read battle state to decide which slot to fill
  const { data: existing } = await db.from("battles").select("*").eq("id", id).single()
  if (!existing || existing.status !== "waiting") {
    return NextResponse.json({ error: "Battle is no longer available" }, { status: 409 })
  }
  if (existing.creator_id === newJoinerId) {
    return NextResponse.json({ error: "Cannot join your own battle" }, { status: 400 })
  }
  if (existing.joiner_id === newJoinerId) {
    return NextResponse.json({ error: "Already in this battle" }, { status: 400 })
  }

  const maxPlayers: number = existing.max_players ?? 2
  const isThreeWay = maxPlayers === 3

  // Determine if this is the first or second (final) joiner
  const isFirstJoinerSlot = !existing.joiner_id
  const isSecondJoinerSlot = isThreeWay && existing.joiner_id && !existing.joiner2_id
  const isLastJoiner = !isThreeWay || isSecondJoinerSlot

  if (!isFirstJoinerSlot && !isSecondJoinerSlot) {
    return NextResponse.json({ error: "Battle is full" }, { status: 409 })
  }

  // Validate new joiner has enough cases
  const caseCost = existing.case_count * (existing.exclusive ? 100 : 1)
  const { data: joinerUser } = await db.from("users").select("cases_remaining").eq("id", newJoinerId).single()
  if (!joinerUser) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if ((joinerUser.cases_remaining ?? 0) < caseCost) {
    return NextResponse.json({ error: "Not enough cases" }, { status: 402 })
  }

  // Atomically claim the appropriate slot
  let battle: typeof existing | null = null

  if (isFirstJoinerSlot) {
    // First slot — for 2-way this starts "in_progress", for 3-way stays "waiting"
    const nextStatus = isThreeWay ? "waiting" : "in_progress"
    const { data: claimed } = await db
      .from("battles")
      .update({ joiner_id: newJoinerId, status: nextStatus })
      .eq("id", id)
      .eq("status", "waiting")
      .is("joiner_id", null)
      .select()
      .single()

    if (!claimed) return NextResponse.json({ error: "Battle is no longer available" }, { status: 409 })
    battle = claimed
  } else {
    // Second slot (3-way only) — starts rolling
    const { data: claimed } = await db
      .from("battles")
      .update({ joiner2_id: newJoinerId, status: "in_progress" })
      .eq("id", id)
      .eq("status", "waiting")
      .not("joiner_id", "is", null)
      .is("joiner2_id", null)
      .select()
      .single()

    if (!claimed) return NextResponse.json({ error: "Battle is no longer available" }, { status: 409 })
    battle = claimed
  }

  // Deduct cases from new joiner
  await db.from("users")
    .update({ cases_remaining: joinerUser.cases_remaining - caseCost })
    .eq("id", newJoinerId)

  // If not the last joiner, stop here — waiting for more players
  if (!isLastJoiner) {
    return NextResponse.json({ success: true, waiting_for_more: true })
  }

  // ── All players joined — roll everything ─────────────────────────────────

  // Build player list (creator first, then joiners in order)
  const playerIds: string[] = [
    battle.creator_id,
    battle.joiner_id!,
    ...(isThreeWay ? [newJoinerId] : []),
  ]

  // Fetch item pool
  const itemsQuery = db.from("items").select("id, likelihood, market_price").eq("limited_time", false)
  const { data: items } = battle.exclusive
    ? await itemsQuery.in("rarity", ["Legendary", "Omega"])
    : await itemsQuery

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "No items available" }, { status: 500 })
  }

  const itemsMap = Object.fromEntries(items.map((i) => [i.id, i]))

  // Per-player RAP tracker
  const playerRaps: Record<string, number> = Object.fromEntries(playerIds.map((pid) => [pid, 0]))
  const allRolls: RollInsert[] = []

  // Main rounds — every player rolls once per round
  for (let r = 0; r < battle.case_count; r++) {
    for (const pid of playerIds) {
      const seed = randomBytes(32).toString("hex")
      const float = fairFloat(seed, "battle", 0)
      const itemId = rollItem(items, float)
      const rap = Number(itemsMap[itemId].market_price)
      allRolls.push({ battle_id: id, user_id: pid, item_id: itemId, round: r, roll_index: allRolls.length, rap, float, server_seed: seed, client_seed: "battle", nonce: 0 })
      playerRaps[pid] += rap
    }
  }

  // Tiebreakers — only tied-for-first players re-roll (max 10 extra rounds)
  let tieRound = battle.case_count
  while (tieRound - battle.case_count < 10) {
    const maxRap = Math.max(...Object.values(playerRaps))
    const tied = playerIds.filter((pid) => Math.abs(playerRaps[pid] - maxRap) < 1e-9)
    if (tied.length === 1) break

    for (const pid of tied) {
      const seed = randomBytes(32).toString("hex")
      const float = fairFloat(seed, "battle", 0)
      const itemId = rollItem(items, float)
      const rap = Number(itemsMap[itemId].market_price)
      allRolls.push({ battle_id: id, user_id: pid, item_id: itemId, round: tieRound, roll_index: allRolls.length, rap, float, server_seed: seed, client_seed: "battle", nonce: 0 })
      playerRaps[pid] += rap
    }
    tieRound++
  }

  // Winner = highest RAP (creator wins on perfect tie)
  const maxRap = Math.max(...Object.values(playerRaps))
  const winnerId = playerIds.find((pid) => Math.abs(playerRaps[pid] - maxRap) < 1e-9) ?? battle.creator_id

  // Insert rolls + award all items to winner + complete battle
  await db.from("battle_rolls").insert(allRolls)
  await db.from("inventory").insert(allRolls.map((r) => ({ user_id: winnerId, item_id: r.item_id })))
  await db.from("battles").update({
    joiner2_id: isThreeWay ? newJoinerId : null,
    winner_id: winnerId,
    status: "completed",
    completed_at: new Date().toISOString(),
  }).eq("id", id)

  return NextResponse.json({ success: true, winner_id: winnerId })
}
