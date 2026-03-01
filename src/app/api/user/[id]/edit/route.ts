import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // user id
    const { user } = await request.json();
    // TODO: add more body params (display name, avatar, about, etc.)

    // validate user
    if (!user) {
      return NextResponse.json(
        { error: "user is required" },
        { status: 400 }
      );
    }
    // TODO: validate user is a valid ID
    // TODO: authenticate user
    // TODO: ensure user is editing their own profile or is an app admin

    return NextResponse.json({ message: "Not implemented yet" }, { status: 501 });
  } catch (_) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
