import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params; // user id
    // TODO: validate id is a valid user ID
    // TODO: authenticate user

    return NextResponse.json({ message: "Not implemented yet" }, { status: 501 });
  } catch (_) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
