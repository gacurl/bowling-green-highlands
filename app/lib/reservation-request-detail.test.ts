import test from "node:test";
import assert from "node:assert/strict";
import { getCheckoutReadiness } from "./checkout-session";
import { toReservationRequestDetailItem } from "./reservation-request-detail";
import type { ReservationRequestRecord } from "./reservation-requests";

const requests: ReservationRequestRecord[] = [
  {
    createdAt: "2026-06-14T09:00:00.000Z",
    eventType: "farm_stay",
    guestEmail: "first@example.com",
    guestName: "First Guest",
    id: "first-id",
    requestNotes: "First note",
    requestedDates: "2026-06-14 09:00 to 09:30",
    sessionDate: "2026-06-14",
    sessionDurationMinutes: 30,
    sessionStartMinute: 540,
    status: "pending",
  },
];

function getHttpsCheckoutReadiness() {
  const checkoutReadiness = getCheckoutReadiness({
    appUrl: "https://example.com",
    hasStripeConfig: true,
  });

  assert.ok(checkoutReadiness);

  return checkoutReadiness;
}

test("returns a friendly request detail item for a known request id", () => {
  const requestDetailItem = toReservationRequestDetailItem(requests, "first-id");

  assert.ok(requestDetailItem);
  assert.equal(requestDetailItem.eventTypeLabel, "Farm stay");
  assert.equal(
    requestDetailItem.requestedSlotLabel,
    "Sunday, June 14, 2026 at 9:00 AM to 9:30 AM Eastern Time",
  );
  assert.equal(requestDetailItem.status, "pending");
  assert.equal(requestDetailItem.paymentStatusLabel, "Unpaid");
  assert.equal(requestDetailItem.statusUpdatedAtLabel, null);
  assert.equal(requestDetailItem.publicPaymentUrl, null);
  assert.equal(requestDetailItem.sessionDurationLabel, "30 minutes");
  assert.equal(requestDetailItem.canAccept, true);
  assert.equal(requestDetailItem.requiresDurationForAcceptance, false);
  assert.equal(requestDetailItem.maximumSessionDurationMinutes, 900);
});

test("returns null for an unknown request id", () => {
  const requestDetailItem = toReservationRequestDetailItem(requests, "missing-id");

  assert.equal(requestDetailItem, null);
});

test("formats preferred-time request details for Admin display", () => {
  const preferredTimeRequest: ReservationRequestRecord = {
    ...requests[0],
    requestedDates: "2026-11-19 16:45",
    sessionDate: "2026-11-19",
    sessionStartMinute: 1005,
  };
  const requestDetailItem = toReservationRequestDetailItem(
    [preferredTimeRequest],
    preferredTimeRequest.id,
  );

  assert.equal(
    requestDetailItem?.requestedSlotLabel,
    "Thursday, November 19, 2026 at 4:45 PM Eastern Time",
  );
});

test("requires an empty duration capture only for a pending reliable start", () => {
  const preferredTimeRequest: ReservationRequestRecord = {
    ...requests[0],
    requestedDates: "2026-11-19 16:45",
    sessionDate: "2026-11-19",
    sessionDurationMinutes: undefined,
    sessionStartMinute: 1005,
  };
  const requestDetailItem = toReservationRequestDetailItem(
    [preferredTimeRequest],
    preferredTimeRequest.id,
  );

  assert.ok(requestDetailItem);
  assert.equal(requestDetailItem.sessionDurationLabel, "Not recorded");
  assert.equal(requestDetailItem.canAccept, true);
  assert.equal(requestDetailItem.requiresDurationForAcceptance, true);
  assert.equal(requestDetailItem.maximumSessionDurationMinutes, 435);
});

test("prevents acceptance when the canonical date and start are unresolved", () => {
  const unresolvedRequest: ReservationRequestRecord = {
    ...requests[0],
    requestedDates: "Call to arrange a date",
    sessionDate: undefined,
    sessionDurationMinutes: undefined,
    sessionStartMinute: undefined,
  };
  const requestDetailItem = toReservationRequestDetailItem(
    [unresolvedRequest],
    unresolvedRequest.id,
  );

  assert.ok(requestDetailItem);
  assert.equal(requestDetailItem.sessionDurationLabel, "Not recorded");
  assert.equal(requestDetailItem.canAccept, false);
  assert.equal(requestDetailItem.requiresDurationForAcceptance, false);
  assert.equal(requestDetailItem.maximumSessionDurationMinutes, null);
});

test("reports incomplete historical records without offering acceptance", () => {
  for (const status of ["accepted", "declined"] as const) {
    const historicalRequest: ReservationRequestRecord = {
      ...requests[0],
      sessionDurationMinutes: undefined,
      status,
    };
    const requestDetailItem = toReservationRequestDetailItem(
      [historicalRequest],
      historicalRequest.id,
    );

    assert.ok(requestDetailItem);
    assert.equal(requestDetailItem.sessionDurationLabel, "Not recorded");
    assert.equal(requestDetailItem.canAccept, false);
    assert.equal(requestDetailItem.requiresDurationForAcceptance, false);
  }
});

test("returns a status-updated label when a timestamp is present", () => {
  const requestWithStatusUpdate: ReservationRequestRecord = {
    ...requests[0],
    id: "updated-id",
    status: "accepted",
    statusUpdatedAt: "2026-06-15T12:30:00.000Z",
  };
  const requestDetailItem = toReservationRequestDetailItem(
    [requestWithStatusUpdate],
    "updated-id",
    getHttpsCheckoutReadiness(),
  );

  assert.ok(requestDetailItem);
  assert.equal(requestDetailItem.status, "accepted");
  assert.equal(
    requestDetailItem.publicPaymentUrl,
    "https://example.com/pay/updated-id",
  );
  assert.ok(requestDetailItem.statusUpdatedAtLabel);
});

test("only accepted unpaid payment-ready requests expose a public payment URL", () => {
  const acceptedRequest: ReservationRequestRecord = {
    ...requests[0],
    id: "accepted id/with?characters#",
    status: "accepted",
  };
  const paidRequest: ReservationRequestRecord = {
    ...acceptedRequest,
    id: "paid-id",
    paymentStatus: "paid",
  };
  const declinedRequest: ReservationRequestRecord = {
    ...requests[0],
    id: "declined-id",
    status: "declined",
  };
  const httpsCheckoutReadiness = getHttpsCheckoutReadiness();
  const httpCheckoutReadiness = getCheckoutReadiness({
    appUrl: "http://127.0.0.1:3000",
    hasStripeConfig: true,
  });

  assert.ok(httpCheckoutReadiness);

  assert.equal(
    toReservationRequestDetailItem(
      [acceptedRequest],
      acceptedRequest.id,
      httpsCheckoutReadiness,
    )?.publicPaymentUrl,
    "https://example.com/pay/accepted%20id%2Fwith%3Fcharacters%23",
  );
  assert.equal(
    toReservationRequestDetailItem([acceptedRequest], acceptedRequest.id)
      ?.publicPaymentUrl,
    null,
  );
  assert.equal(
    toReservationRequestDetailItem(
      [acceptedRequest],
      acceptedRequest.id,
      httpCheckoutReadiness,
    )?.publicPaymentUrl,
    null,
  );
  assert.equal(
    toReservationRequestDetailItem(
      [paidRequest],
      paidRequest.id,
      httpsCheckoutReadiness,
    )?.publicPaymentUrl,
    null,
  );
  assert.equal(
    toReservationRequestDetailItem(
      [requests[0]],
      "first-id",
      httpsCheckoutReadiness,
    )?.publicPaymentUrl,
    null,
  );
  assert.equal(
    toReservationRequestDetailItem(
      [declinedRequest],
      "declined-id",
      httpsCheckoutReadiness,
    )?.publicPaymentUrl,
    null,
  );
});

test("labels paid request details as Paid", () => {
  const paidRequest: ReservationRequestRecord = {
    ...requests[0],
    id: "paid-id",
    paymentStatus: "paid",
    status: "accepted",
  };

  const requestDetailItem = toReservationRequestDetailItem(
    [paidRequest],
    "paid-id",
    getHttpsCheckoutReadiness(),
  );

  assert.equal(requestDetailItem?.paymentStatusLabel, "Paid");
  assert.equal(requestDetailItem?.publicPaymentUrl, null);
});
