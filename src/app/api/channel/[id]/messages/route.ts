import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error: authError } = await supabase.auth.getUser(token);
  if (authError)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch messages
  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select("id, user_id, content, created_at, replies_to")
    .eq("channel_id", id)
    .order("created_at", { ascending: true })
    .limit(100);

  if (msgError)
    return NextResponse.json({ error: msgError.message }, { status: 500 });
  if (!messages?.length)
    return NextResponse.json([]);

  // Fetch profiles for all unique user_ids in this batch
  const userIds = [...new Set(messages.map((m) => m.user_id))];
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);

  if (profileError)
    return NextResponse.json({ error: profileError.message }, { status: 500 });

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p.display_name])
  );

  const result = messages.map((m) => ({
    ...m,
    profiles: { display_name: profileMap[m.user_id] ?? "Unknown" },
  }));

  return NextResponse.json(result);
}
