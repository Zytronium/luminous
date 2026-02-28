import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user, message, channelId, replyTo, replyPing } = body;

    // validate user
    if (!user) {
      return NextResponse.json(
        { error: "user is required" },
        { status: 400 }
      )
    }
    // TODO: validate user is a valid ID
    // TODO: Authenticate user

    // validate message
    const message_validation = validate_message(message);
    if (message_validation !== true) {
      return message_validation;
    }

    // validate channelId
    if (!channelId) {
      return NextResponse.json(
        { error: "channelId is required" },
        { status: 400 }
      )
    }
    // TODO: validate channelId is a valid ID

    // TODO: validate replyTo by making sure it's a valid message id in the same channel

    // validate replyPing
    if (replyTo && !replyPing) {
      return NextResponse.json(
        { error: "replyPing is required when replyTo is specified"},
        { status: 400 }
      )
    }

    return NextResponse.json(
      { message: "Valid request; Route not fully implemented yet" },
      { status: 501 }
    );
  } catch (_) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }

  function validate_message(message: string) {
    if (!message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      )
    }

    if (message.trim().length > 4096) {
      return NextResponse.json(
        { error: "message cannot be longer than 4096 bytes" },
        { status: 400 }
      )
    }

    if (message.trim().length == 0) {
      return NextResponse.json(
        { error: "message cannot be empty" },
        { status: 400 }
      )
    }

    return true;
  }

}
