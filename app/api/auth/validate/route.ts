import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST /api/auth/validate — verifies user_id + session_token pair
export async function POST(request: Request) {
  const { user_id, session_token } = await request.json()

  if (!user_id || !session_token) {
    return NextResponse.json({ valid: false, error: "Missing credentials" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("id", user_id)
    .single()

  if (!user) {
    return NextResponse.json({ valid: false }, { status: 401 })
  }

  // If user has no session_token yet (legacy user), accept the login but don't validate token
  // This allows pre-migration users to stay logged in while we generate tokens going forward
  if (!user.session_token) {
    const { password: _pw, session_token: _st, ...safeUser } = user
    return NextResponse.json({ valid: true, user: safeUser, legacyUser: true })
  }

  // If user has a session_token, it must match
  if (user.session_token !== session_token) {
    return NextResponse.json({ valid: false }, { status: 401 })
  }

  const { password: _pw, session_token: _st, ...safeUser } = user
  return NextResponse.json({ valid: true, user: safeUser })
}
