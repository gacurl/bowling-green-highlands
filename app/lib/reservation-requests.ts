import { randomUUID } from "node:crypto";
import {
  getDatabase,
  type DatabaseAccess,
  type DatabaseQueryable,
} from "../../lib/server/database";
import type { EventTypeValue } from "./event-type";

export type ReservationRequestStatus = "pending" | "accepted" | "declined";
export type ReservationRequestStatusUpdate = "accepted" | "declined";
export type ReservationPaymentStatus = "unpaid" | "paid";

export type MarkReservationRequestPaidResult =
  | "updated"
  | "already_paid"
  | "not_found"
  | "not_accepted";

export type ReservationRequestRecord = {
  createdAt: string;
  eventType: EventTypeValue;
  guestEmail: string;
  guestName: string;
  id: string;
  paymentStatus?: ReservationPaymentStatus;
  requestNotes: string;
  requestedDates: string;
  status: ReservationRequestStatus;
  statusUpdatedAt?: string;
};

type ReservationRequestRow = {
  created_at: string;
  event_type: EventTypeValue;
  guest_email: string;
  guest_name: string;
  id: string;
  payment_status: ReservationPaymentStatus;
  request_notes: string;
  requested_dates: string;
  status: ReservationRequestStatus;
  status_updated_at: string | null;
};

type CreateReservationRequestInput = {
  eventType: EventTypeValue;
  guestEmail: string;
  guestName: string;
  requestNotes: string;
  requestedDates: string;
};

const RESERVATION_REQUEST_COLUMNS = `
  id,
  created_at,
  event_type,
  guest_email,
  guest_name,
  payment_status,
  request_notes,
  requested_dates,
  status,
  status_updated_at
`;

export function isReservationRequestStatusUpdate(
  value: string,
): value is ReservationRequestStatusUpdate {
  return value === "accepted" || value === "declined";
}

function toReservationRequestRecord(
  row: ReservationRequestRow,
): ReservationRequestRecord {
  return {
    createdAt: row.created_at,
    eventType: row.event_type,
    guestEmail: row.guest_email,
    guestName: row.guest_name,
    id: row.id,
    paymentStatus: row.payment_status,
    requestNotes: row.request_notes,
    requestedDates: row.requested_dates,
    status: row.status,
    statusUpdatedAt: row.status_updated_at ?? undefined,
  };
}

async function readReservationRequestRows(database: DatabaseQueryable) {
  const result = await database.query<ReservationRequestRow>(`
    SELECT ${RESERVATION_REQUEST_COLUMNS}
    FROM reservation_requests
    ORDER BY sequence_id ASC
  `);

  return result.rows.map(toReservationRequestRecord);
}

function isAcceptedSlotConstraintError(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === "reservation_requests_one_accepted_exact_slot"
  );
}

export async function readReservationRequests(
  database?: DatabaseAccess,
): Promise<ReservationRequestRecord[]> {
  return readReservationRequestRows(getDatabase(database));
}

export async function writeReservationRequests(
  requests: ReservationRequestRecord[],
  database?: DatabaseAccess,
) {
  await getDatabase(database).transaction(async (client) => {
    await client.query("DELETE FROM reservation_requests");

    for (const request of requests) {
      await client.query(
        `
          INSERT INTO reservation_requests (
            id,
            created_at,
            event_type,
            guest_email,
            guest_name,
            payment_status,
            request_notes,
            requested_dates,
            status,
            status_updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          request.id,
          request.createdAt,
          request.eventType,
          request.guestEmail,
          request.guestName,
          request.paymentStatus ?? "unpaid",
          request.requestNotes,
          request.requestedDates,
          request.status,
          request.statusUpdatedAt ?? null,
        ],
      );
    }
  });
}

export async function createReservationRequestRecord(
  {
    eventType,
    guestEmail,
    guestName,
    requestNotes,
    requestedDates,
  }: CreateReservationRequestInput,
  database?: DatabaseAccess,
) {
  const requestRecord: ReservationRequestRecord = {
    createdAt: new Date().toISOString(),
    eventType,
    guestEmail,
    guestName,
    id: randomUUID(),
    paymentStatus: "unpaid",
    requestNotes,
    requestedDates,
    status: "pending",
  };

  await getDatabase(database).query(
    `
      INSERT INTO reservation_requests (
        id,
        created_at,
        event_type,
        guest_email,
        guest_name,
        payment_status,
        request_notes,
        requested_dates,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    [
      requestRecord.id,
      requestRecord.createdAt,
      requestRecord.eventType,
      requestRecord.guestEmail,
      requestRecord.guestName,
      requestRecord.paymentStatus,
      requestRecord.requestNotes,
      requestRecord.requestedDates,
      requestRecord.status,
    ],
  );

  return requestRecord;
}

export async function updateReservationRequestStatus(
  requestId: string,
  status: ReservationRequestStatusUpdate,
  database?: DatabaseAccess,
): Promise<"updated" | "not_found" | "invalid_transition" | "slot_conflict"> {
  try {
    return await getDatabase(database).transaction(async (client) => {
      const requestResult = await client.query<{
        requested_dates: string;
        status: ReservationRequestStatus;
      }>(
        `
          SELECT requested_dates, status
          FROM reservation_requests
          WHERE id = $1
          FOR UPDATE
        `,
        [requestId],
      );
      const request = requestResult.rows[0];

      if (!request) {
        return "not_found";
      }

      if (request.status !== "pending") {
        return "invalid_transition";
      }

      if (status === "accepted") {
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1, 261))",
          [request.requested_dates],
        );
        const conflict = await client.query(
          `
            SELECT 1
            FROM reservation_requests
            WHERE id <> $1
              AND status = 'accepted'
              AND requested_dates = $2
            LIMIT 1
          `,
          [requestId, request.requested_dates],
        );

        if (conflict.rows.length > 0) {
          return "slot_conflict";
        }
      }

      await client.query(
        `
          UPDATE reservation_requests
          SET status = $2,
              status_updated_at = $3
          WHERE id = $1
        `,
        [requestId, status, new Date().toISOString()],
      );

      return "updated";
    });
  } catch (error) {
    if (isAcceptedSlotConstraintError(error)) {
      return "slot_conflict";
    }

    throw error;
  }
}

export async function markReservationRequestPaid(
  requestId: string,
  database?: DatabaseAccess,
): Promise<MarkReservationRequestPaidResult> {
  return getDatabase(database).transaction(async (client) => {
    const requestResult = await client.query<{
      payment_status: ReservationPaymentStatus;
      status: ReservationRequestStatus;
    }>(
      `
        SELECT payment_status, status
        FROM reservation_requests
        WHERE id = $1
        FOR UPDATE
      `,
      [requestId],
    );
    const request = requestResult.rows[0];

    if (!request) {
      return "not_found";
    }

    if (request.status !== "accepted") {
      return "not_accepted";
    }

    if (request.payment_status === "paid") {
      return "already_paid";
    }

    await client.query(
      `
        UPDATE reservation_requests
        SET payment_status = 'paid'
        WHERE id = $1
      `,
      [requestId],
    );

    return "updated";
  });
}
