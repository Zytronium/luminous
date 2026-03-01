import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
)  {
  try {
    const { id } = await params; // channel id
    const { user } = await request.json();

    // validate user
    if (!user) {
      return NextResponse.json(
        { error: "user is required" },
        { status: 400 }
      );
    }
    // TODO: validate user is a valid ID
    // TODO: authenticate user
    // TODO: ensure user has permission to delete channels

    return NextResponse.json(
      { message: "Not implemented yet" },
      { status: 501 }
    );
  } catch (_) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}