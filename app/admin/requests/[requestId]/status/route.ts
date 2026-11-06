import { NextResponse } from "next/server";
import {
  isReservationRequestStatusUpdate,
  updateReservationRequestStatus,
} from "../../../../lib/reservation-requests";

type StatusRouteProps = {
  params: Promise<{ requestId: string }>;
};

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

  let updateResult: Awaited<ReturnType<typeof updateReservationRequestStatus>>;

  try {
    updateResult = await updateReservationRequestStatus(requestId, statusValue);
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

  return NextResponse.redirect(
    new URL(`/admin/requests/${requestId}`, request.url),
    303,
  );
}
