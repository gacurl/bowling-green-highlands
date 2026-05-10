import { NextResponse } from "next/server";
import {
  isOperatorAvailabilityDate,
  setOperatorDateAvailability,
} from "../../../lib/operator-availability";

type AvailabilityUpdateRequest = {
  date?: unknown;
  mode?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AvailabilityUpdateRequest;

    if (
      typeof body.date !== "string" ||
      !isOperatorAvailabilityDate(body.date) ||
      (body.mode !== "available" && body.mode !== "unavailable")
    ) {
      return NextResponse.json(
        { error: "Invalid availability update" },
        { status: 400 },
      );
    }

    const availability = await setOperatorDateAvailability(
      body.date,
      body.mode,
    );

    return NextResponse.json({ availability });
  } catch {
    return NextResponse.json(
      { error: "Availability could not be saved" },
      { status: 500 },
    );
  }
}
