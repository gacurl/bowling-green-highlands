import { NextResponse } from "next/server";
import {
  isOperatorAvailabilityDate,
  isOperatorAvailabilityWindow,
  setOperatorDateAvailability,
  setOperatorDateAvailabilityWindow,
} from "../../../lib/operator-availability";

type AvailabilityUpdateRequest = {
  date?: unknown;
  durationMinutes?: unknown;
  mode?: unknown;
  startMinute?: unknown;
};

function invalidAvailabilityResponse() {
  return NextResponse.json(
    {
      error:
        "Availability could not be saved. No availability changes were saved.",
    },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  let body: AvailabilityUpdateRequest;

  try {
    body = (await request.json()) as AvailabilityUpdateRequest;
  } catch {
    return invalidAvailabilityResponse();
  }

  try {
    if (
      typeof body.date !== "string" ||
      !isOperatorAvailabilityDate(body.date) ||
      (body.mode !== "available" && body.mode !== "unavailable")
    ) {
      return invalidAvailabilityResponse();
    }

    if (body.mode === "available") {
      if (
        typeof body.startMinute !== "number" ||
        typeof body.durationMinutes !== "number" ||
        !isOperatorAvailabilityWindow(
          body.startMinute,
          body.durationMinutes,
        )
      ) {
        return invalidAvailabilityResponse();
      }

      const availability = await setOperatorDateAvailabilityWindow(
        body.date,
        body.startMinute,
        body.durationMinutes,
      );

      return NextResponse.json({ availability });
    }

    const availability = await setOperatorDateAvailability(
      body.date,
      "unavailable",
    );

    return NextResponse.json({ availability });
  } catch {
    return NextResponse.json(
      {
        error:
          "Availability could not be saved. No availability changes were saved.",
      },
      { status: 500 },
    );
  }
}
