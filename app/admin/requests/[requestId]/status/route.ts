import { redirect } from "next/navigation";
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
    redirect(`/admin/requests/${requestId}?error=invalid_status`);
  }

  if (!isReservationRequestStatusUpdate(statusValue)) {
    redirect(`/admin/requests/${requestId}?error=invalid_status`);
  }

  const updateResult = await updateReservationRequestStatus(requestId, statusValue);

  if (updateResult === "not_found") {
    redirect("/admin?error=request_not_found");
  }

  if (updateResult === "invalid_transition") {
    redirect(`/admin/requests/${requestId}?error=invalid_transition`);
  }

  redirect(`/admin/requests/${requestId}`);
}
