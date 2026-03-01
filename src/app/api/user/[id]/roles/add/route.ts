import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // user id
    const { user, roleId } = await request.json();

    // validate user
    if (!user) {
      return NextResponse.json(
        { error: "user is required" },
        { status: 400 }
      );
    }
    // TODO: validate user is a valid ID
    // TODO: authenticate user
    // TODO: ensure user has permission to assign roles

    // validate roleId
    if (!roleId) {
      return NextResponse.json(
        { error: "roleId is required" },
        { status: 400 }
      );
    }
    // TODO: validate roleId is a valid ID
    // TODO: validate id is a valid user ID
    // TODO: ensure role is not already assigned to user

    return NextResponse.json({ message: "Not implemented yet" }, { status: 501 });
  } catch (_) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
