import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user, name } = body;

    // validate user
    if (!user) {
      return NextResponse.json(
        { message: "user is required" }, // required for audit logs
        { status: 400 }
      );
    }
    // TODO: validate user is a valid ID
    // TODO: authenticate user
    // TODO: ensure user has permission to create channels

    // validate name
    const name_validation = validate_name(name);
    if (name_validation !== true) {
      return name_validation;
    }

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

  function validate_name(name: string) {
    if (!name) {
      return NextResponse.json(
        { message: "name is required" },
        { status: 400 }
      );
    }
    if (name.trim().length > 32) {
      return NextResponse.json(
        { message: "name cannot be longer than 32 bytes" },
        { status: 400 }
      );
    }
    if (name.trim().length <= 1) {
      return NextResponse.json(
        { message: "name must be at least 2 bytes" },
        { status: 400 }
      );
    }
    if (/\s/.test(name)) {
      return NextResponse.json(
        { message: "name cannot contain whitespaces" },
        { status: 400 }
      );
    }

    return true;
  }

}
