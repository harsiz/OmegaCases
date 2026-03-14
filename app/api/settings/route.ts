import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const formData = await req.formData()
  const userId = formData.get("userId") as string
  const username = formData.get("username") as string | null
  const avatarFile = formData.get("avatar") as File | null

  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  // Check new username isn't taken by someone else
  if (username) {
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .neq("id", userId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 400 })
    }
  }

  let profilePictureUrl: string | null = null

  if (avatarFile && avatarFile.size > 0) {
    // Delete old avatar files for this user first
    const { data: existingFiles } = await supabase.storage
      .from("avatars")
      .list(userId)

    if (existingFiles && existingFiles.length > 0) {
      const paths = existingFiles.map((f) => `${userId}/${f.name}`)
      await supabase.storage.from("avatars").remove(paths)
    }

    const ext = avatarFile.name.split(".").pop() ?? "jpg"
    const path = `${userId}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })

    if (uploadError) {
      return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 })
    }

    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path)
    profilePictureUrl = publicUrlData.publicUrl + `?t=${Date.now()}`
  }

  // Build update payload
  const updates: Record<string, unknown> = {}
  if (username) updates.username = username
  if (profilePictureUrl) updates.profile_picture = profilePictureUrl

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", userId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ user: data })
}
