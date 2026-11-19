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
  | "not_accepted"
  | "stale_session";

export type MarkReservationCheckoutSessionRetryableResult =
  | "updated"
  | "already_paid"
  | "already_retryable"
  | "not_found"
  | "not_accepted"
  | "stale_session";

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
  stripeCheckoutSessionId?: string;
  stripeCheckoutSessionRetryable?: boolean;
};

export type ReservationCheckoutRequest = {
  guestEmail: string;
  id: string;
  paymentStatus: ReservationPaymentStatus;
  status: ReservationRequestStatus;
  stripeCheckoutSessionId: string | null;
  stripeCheckoutSessionRetryable: boolean;
};

export type ReservationCheckoutOperationResult<Result> = {
  result: Result;
  sessionUpdate?: {
    id: string;
    retryable: boolean;
  };
};

export type ReservationCheckoutLockResult<Result> =
  | {
      kind: "found";
      result: Result;
    }
  | {
      kind: "not_found";
    };

export type ReservationCheckoutOperation<Result> = (
  request: ReservationCheckoutRequest,
) => Promise<ReservationCheckoutOperationResult<Result>>;

type ReservationRequestRow = {
  created_at: string;
  event_type: EventTypeValue;
  guest_email: string;
  guest_name: string;
  id: string;
  payment_status: ReservationPaymentStatus;
  request_notes: string;
  requested_dates: string;
  requested_start_key: string;
  status: ReservationRequestStatus;
  status_updated_at: string | null;
  stripe_checkout_session_id: string | null;
  stripe_checkout_session_retryable: boolean;
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
  requested_start_key,
  status,
  status_updated_at,
  stripe_checkout_session_id,
  stripe_checkout_session_retryable
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
    stripeCheckoutSessionId: row.stripe_checkout_session_id ?? undefined,
    stripeCheckoutSessionRetryable: row.stripe_checkout_session_retryable,
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
            status_updated_at,
            stripe_checkout_session_id,
            stripe_checkout_session_retryable
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
          request.stripeCheckoutSessionId ?? null,
          request.stripeCheckoutSessionRetryable ?? false,
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
        requested_start_key: string;
        status: ReservationRequestStatus;
      }>(
        `
          SELECT requested_start_key, status
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
          [request.requested_start_key],
        );
        const conflict = await client.query(
          `
            SELECT 1
            FROM reservation_requests
            WHERE id <> $1
              AND status = 'accepted'
              AND requested_start_key = $2
            LIMIT 1
          `,
          [requestId, request.requested_start_key],
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
  stripeCheckoutSessionId: string,
  database?: DatabaseAccess,
): Promise<MarkReservationRequestPaidResult> {
  return getDatabase(database).transaction(async (client) => {
    const requestResult = await client.query<{
      payment_status: ReservationPaymentStatus;
      status: ReservationRequestStatus;
      stripe_checkout_session_id: string | null;
    }>(
      `
        SELECT payment_status, status, stripe_checkout_session_id
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

    if (request.stripe_checkout_session_id !== stripeCheckoutSessionId) {
      return "stale_session";
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

export async function markReservationCheckoutSessionRetryable(
  requestId: string,
  stripeCheckoutSessionId: string,
  database?: DatabaseAccess,
): Promise<MarkReservationCheckoutSessionRetryableResult> {
  return getDatabase(database).transaction(async (client) => {
    const requestResult = await client.query<{
      payment_status: ReservationPaymentStatus;
      status: ReservationRequestStatus;
      stripe_checkout_session_id: string | null;
      stripe_checkout_session_retryable: boolean;
    }>(
      `
        SELECT
          payment_status,
          status,
          stripe_checkout_session_id,
          stripe_checkout_session_retryable
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

    if (request.stripe_checkout_session_id !== stripeCheckoutSessionId) {
      return "stale_session";
    }

    if (request.payment_status === "paid") {
      return "already_paid";
    }

    if (request.stripe_checkout_session_retryable) {
      return "already_retryable";
    }

    await client.query(
      `
        UPDATE reservation_requests
        SET stripe_checkout_session_retryable = TRUE
        WHERE id = $1
      `,
      [requestId],
    );

    return "updated";
  });
}

export async function withLockedReservationCheckoutRequest<Result>(
  requestId: string,
  operation: ReservationCheckoutOperation<Result>,
  database?: DatabaseAccess,
): Promise<ReservationCheckoutLockResult<Result>> {
  return getDatabase(database).transaction(async (client) => {
    const requestResult = await client.query<{
      guest_email: string;
      id: string;
      payment_status: ReservationPaymentStatus;
      status: ReservationRequestStatus;
      stripe_checkout_session_id: string | null;
      stripe_checkout_session_retryable: boolean;
    }>(
      `
        SELECT
          guest_email,
          id,
          payment_status,
          status,
          stripe_checkout_session_id,
          stripe_checkout_session_retryable
        FROM reservation_requests
        WHERE id = $1
        FOR UPDATE
      `,
      [requestId],
    );
    const request = requestResult.rows[0];

    if (!request) {
      return { kind: "not_found" };
    }

    const operationResult = await operation({
      guestEmail: request.guest_email,
      id: request.id,
      paymentStatus: request.payment_status,
      status: request.status,
      stripeCheckoutSessionId: request.stripe_checkout_session_id,
      stripeCheckoutSessionRetryable:
        request.stripe_checkout_session_retryable,
    });

    if (operationResult.sessionUpdate) {
      await client.query(
        `
          UPDATE reservation_requests
          SET stripe_checkout_session_id = $2,
              stripe_checkout_session_retryable = $3
          WHERE id = $1
        `,
        [
          requestId,
          operationResult.sessionUpdate.id,
          operationResult.sessionUpdate.retryable,
        ],
      );
    }

    return {
      kind: "found",
      result: operationResult.result,
    };
  });
}
