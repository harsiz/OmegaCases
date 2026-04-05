import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { randomBytes } from "crypto"

// POST /api/oauth/authorize — handle user consent, generate token
export async function POST(req: Request) {
  const { user_id, client_id, redirect_uri, scope, state, accept } = await req.json()

  if (!user_id || !client_id || !redirect_uri) {
    return NextResponse.json({ error: "user_id, client_id, and redirect_uri required" }, { status: 400 })
  }

  if (!accept) {
    const p = new URLSearchParams({ error: "access_denied" })
    if (state) p.set("state", state)
    return NextResponse.json({ redirect_url: `${redirect_uri}?${p}` })
  }

  const db = await createClient()

  const { data: app } = await db
    .from("oauth_apps")
    .select("id, scopes")
    .eq("client_id", client_id)
    .single()

  if (!app) return NextResponse.json({ error: "App not found" }, { status: 404 })

  const { data: userData } = await db
    .from("users")
    .select("id, username, balance")
    .eq("id", user_id)
    .single()

  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const requestedScopes: string[] = scope
    ? scope.split(",").map((s: string) => s.trim()).filter(Boolean)
    : []

  // Generate persistent token
  const token = randomBytes(32).toString("hex")
  await db.from("oauth_tokens").insert({
    app_id:  app.id,
    user_id: user_id,
    token,
    scopes:  requestedScopes,
  })

  const params = new URLSearchParams({ token })
  if (state) params.set("state", state)
  if (requestedScopes.includes("read_id"))       params.set("user_id",  userData.id)
  if (requestedScopes.includes("read_username")) params.set("username", userData.username)
  if (requestedScopes.includes("read_balance"))  params.set("balance",  String(userData.balance))

  return NextResponse.json({ redirect_url: `${redirect_uri}?${params}` })
}
