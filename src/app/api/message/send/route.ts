import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { channelId, content, repliesTo } = await req.json();
  if (!channelId || !content?.trim())
    return NextResponse.json({ error: "channelId and content are required" }, { status: 400 });

  const { error } = await supabase.from("messages").insert({
    channel_id: channelId,
    user_id: user.id,
    content: content.trim(),
    replies_to: repliesTo ?? null,
  });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 201 });
}
