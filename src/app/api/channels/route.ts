import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error: authError } = await supabase.auth.getUser(token);
  if (authError)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("channels")
    .select("id, name, description")
    .order("name", { ascending: true });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
