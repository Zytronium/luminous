import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // channel id
    // TODO: Validate that id matches an existing channel id

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
