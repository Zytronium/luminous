import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ATLAS_DOMAIN = "@atlasstudents.com";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, secondaryEmail, displayName } = body;

    // --- Validate required fields ---
    if (!email || !password || !displayName) {
      return NextResponse.json(
        { error: "email, password, and displayName are required." },
        { status: 400 }
      );
    }

    // --- Enforce Atlas primary email ---
    if (!email.toLowerCase().endsWith(ATLAS_DOMAIN)) {
      return NextResponse.json(
        { error: `Primary email must be an ${ATLAS_DOMAIN} address.` },
        { status: 400 }
      );
    }

    // --- Validate secondary email if provided ---
    if (secondaryEmail !== undefined && secondaryEmail !== "") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(secondaryEmail)) {
        return NextResponse.json(
          { error: "Secondary email is not a valid email address." },
          { status: 400 }
        );
      }
      if (secondaryEmail.toLowerCase().endsWith(ATLAS_DOMAIN)) {
        return NextResponse.json(
          { error: "Secondary email must be a different domain than your Atlas email." },
          { status: 400 }
        );
      }
      if (secondaryEmail.toLowerCase() === email.toLowerCase()) {
        return NextResponse.json(
          { error: "Secondary email must be different from your primary email." },
          { status: 400 }
        );
      }
    }

    // --- Password strength ---
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // --- Create user and trigger confirmation email ---
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
        display_name: displayName,
        secondary_email: secondaryEmail || null,
        secondary_email_verified: false,
      },
      },
    });

    if (error) {
      // Surface duplicate email clearly
      if (error.message.toLowerCase().includes("already registered")) {
        return NextResponse.json(
          { error: "An account with this email already exists." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Supabase returns a session (but no email_confirmed_at) for an unverified
    // user — treat this as "pending verification", not "signed in".
    if (!data.user) {
      return NextResponse.json(
        { error: "Account creation failed. Please try again." },
        { status: 500 }
      );
    }

    // TODO: If secondaryEmail provided, send a separate verification email to it
    //      (implement once email service is wired up)

    return NextResponse.json(
      {
        message:
          "Account created. Please check your Atlas email to verify your account.",
        userId: data.user.id,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}