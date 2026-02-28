import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // TODO: authenticate user
    // TODO: return list of channels

    return NextResponse.json({ message: "Not implemented yet" }, { status: 501 });
  } catch (_) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}