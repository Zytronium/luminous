import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "email and password are required." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // Ensure primary Atlas email is verified
    if (!data.user.email_confirmed_at) {
      return NextResponse.json(
        { error: "Please verify your Atlas email before signing in." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        message: "Signed in successfully.",
        session: data.session,
        user: {
          id: data.user.id,
          email: data.user.email,
          displayName: data.user.user_metadata?.display_name,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
