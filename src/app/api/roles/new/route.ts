import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { user, name, color } = await request.json();

    // validate user
    if (!user) {
      return NextResponse.json(
        { error: "user is required" },
        { status: 400 }
      );
    }
    // TODO: validate user is a valid ID
    // TODO: authenticate user
    // TODO: ensure user has permission to create roles

    // validate name
    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }
    // TODO: validate name length and format (see channel/new for reference)
    // TODO: ensure role name is not already taken

    return NextResponse.json({ message: "Not implemented yet" }, { status: 501 });
  } catch (_) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}