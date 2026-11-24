import { NextResponse } from "next/server";
import {
  isReservationRequestStatusUpdate,
  updateReservationRequestStatus,
} from "../../../../lib/reservation-requests";

type StatusRouteProps = {
  params: Promise<{ requestId: string }>;
};

type ParsedSessionDuration =
  | { kind: "omitted" }
  | { kind: "invalid" }
  | { kind: "valid"; value: number };

function parseSessionDuration(formData: FormData): ParsedSessionDuration {
  const rawDuration = formData.get("sessionDurationMinutes");

  if (rawDuration === null) {
    return { kind: "omitted" };
  }

  if (typeof rawDuration !== "string") {
    return { kind: "invalid" };
  }

  const normalizedDuration = rawDuration.trim();

  if (normalizedDuration === "") {
    return { kind: "omitted" };
  }

  if (!/^[1-9][0-9]*$/.test(normalizedDuration)) {
    return { kind: "invalid" };
  }

  const duration = Number(normalizedDuration);

  if (!Number.isSafeInteger(duration) || duration > 24 * 60) {
    return { kind: "invalid" };
  }

  return { kind: "valid", value: duration };
}

export async function POST(request: Request, { params }: StatusRouteProps) {
  const { requestId } = await params;
  const formData = await request.formData();
  const statusValue = formData.get("status");

  if (typeof statusValue !== "string") {
    return NextResponse.redirect(
      new URL(`/admin/requests/${requestId}?error=invalid_status`, request.url),
      303,
    );
  }

  if (!isReservationRequestStatusUpdate(statusValue)) {
    return NextResponse.redirect(
      new URL(`/admin/requests/${requestId}?error=invalid_status`, request.url),
      303,
    );
  }

  const parsedDuration =
    statusValue === "accepted"
      ? parseSessionDuration(formData)
      : { kind: "omitted" as const };

  if (parsedDuration.kind === "invalid") {
    return NextResponse.redirect(
      new URL(
        `/admin/requests/${requestId}?error=invalid_session_duration`,
        request.url,
      ),
      303,
    );
  }

  let updateResult: Awaited<ReturnType<typeof updateReservationRequestStatus>>;

  try {
    updateResult = await updateReservationRequestStatus(
      requestId,
      statusValue,
      undefined,
      parsedDuration.kind === "valid"
        ? { sessionDurationMinutes: parsedDuration.value }
        : undefined,
    );
  } catch {
    return NextResponse.redirect(
      new URL(`/admin/requests/${requestId}?error=action_failed`, request.url),
      303,
    );
  }

  if (updateResult === "not_found") {
    return NextResponse.redirect(
      new URL("/admin?error=request_not_found", request.url),
      303,
    );
  }

  if (updateResult === "invalid_transition") {
    return NextResponse.redirect(
      new URL(
        `/admin/requests/${requestId}?error=invalid_transition`,
        request.url,
      ),
      303,
    );
  }

  if (updateResult === "slot_conflict") {
    return NextResponse.redirect(
      new URL(`/admin/requests/${requestId}?error=slot_conflict`, request.url),
      303,
    );
  }

  if (
    updateResult === "session_duration_required" ||
    updateResult === "session_interval_unavailable" ||
    updateResult === "invalid_session_duration"
  ) {
    return NextResponse.redirect(
      new URL(
        `/admin/requests/${requestId}?error=${updateResult}`,
        request.url,
      ),
      303,
    );
  }

  return NextResponse.redirect(
    new URL(`/admin/requests/${requestId}`, request.url),
    303,
  );
}
