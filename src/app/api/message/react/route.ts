import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user, messageId, emoji } = body;

    // validate user
    if (!user) {
      return NextResponse.json(
        { message: "user is required" },
        { status: 400 }
      );
    }
    // TODO: validate user is a valid ID
    // TODO: Authenticate user

    // validate messageId
    if (!messageId) {
      return NextResponse.json(
        { message: "messageId is required" },
        { status: 400 }
      );
    }
    // TODO: validate messageId is a valid ID

    // validate emoji
    if (!emoji) {
      return NextResponse.json(
        { message: "emoji is required" },
        { status: 400 }
      );
    }
    // TODO: Ensure emoji is a valid emoji ID

    return NextResponse.json(
      { message: "Not implemented yet." },
      { status: 501 }
    );
  } catch (_) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
