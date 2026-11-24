import { randomUUID } from "node:crypto";
import {
  getDatabase,
  type DatabaseAccess,
  type DatabaseQueryable,
} from "../../lib/server/database";
import { deriveReservationSessionInterval } from "../../lib/requested-slot";
import type { EventTypeValue } from "./event-type";

export type ReservationRequestStatus = "pending" | "accepted" | "declined";
export type ReservationRequestStatusUpdate = "accepted" | "declined";
export type ReservationPaymentStatus = "unpaid" | "paid";

export type ReservationRequestStatusUpdateResult =
  | "updated"
  | "not_found"
  | "invalid_transition"
  | "session_duration_required"
  | "session_interval_unavailable"
  | "invalid_session_duration"
  | "slot_conflict";

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
  sessionDate?: string;
  sessionDurationMinutes?: number;
  sessionStartMinute?: number;
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
  session_date: string | null;
  session_duration_minutes: number | null;
  session_start_minute: number | null;
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
  sessionDurationMinutes?: number;
};

type ReservationSessionSnapshot = {
  date: string | null;
  durationMinutes: number | null;
  startMinute: number | null;
};

type ReservationAcceptanceDetails = {
  sessionDurationMinutes?: number;
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
  session_date::text AS session_date,
  session_duration_minutes,
  session_start_minute,
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

function resolveReservationSessionSnapshot(
  requestedDates: string,
  explicitDurationMinutes?: number,
): ReservationSessionSnapshot {
  const derivedInterval = deriveReservationSessionInterval(requestedDates);

  if (!derivedInterval) {
    if (explicitDurationMinutes !== undefined) {
      throw new Error("Session duration requires a reliable requested start");
    }

    return {
      date: null,
      durationMinutes: null,
      startMinute: null,
    };
  }

  if (
    explicitDurationMinutes !== undefined &&
    (!Number.isInteger(explicitDurationMinutes) ||
      explicitDurationMinutes <= 0 ||
      derivedInterval.startMinute + explicitDurationMinutes > 24 * 60)
  ) {
    throw new Error("Session duration is invalid");
  }

  if (
    explicitDurationMinutes !== undefined &&
    derivedInterval.durationMinutes !== null &&
    explicitDurationMinutes !== derivedInterval.durationMinutes
  ) {
    throw new Error("Session duration conflicts with the requested range");
  }

  return {
    date: derivedInterval.date,
    durationMinutes:
      explicitDurationMinutes ?? derivedInterval.durationMinutes,
    startMinute: derivedInterval.startMinute,
  };
}

function toReservationSessionRecordFields(
  snapshot: ReservationSessionSnapshot,
): Pick<
  ReservationRequestRecord,
  "sessionDate" | "sessionDurationMinutes" | "sessionStartMinute"
> {
  return {
    ...(snapshot.date === null ? {} : { sessionDate: snapshot.date }),
    ...(snapshot.durationMinutes === null
      ? {}
      : { sessionDurationMinutes: snapshot.durationMinutes }),
    ...(snapshot.startMinute === null
      ? {}
      : { sessionStartMinute: snapshot.startMinute }),
  };
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
    ...toReservationSessionRecordFields({
      date: row.session_date,
      durationMinutes: row.session_duration_minutes,
      startMinute: row.session_start_minute,
    }),
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
      const sessionSnapshot = resolveReservationSessionSnapshot(
        request.requestedDates,
        request.sessionDurationMinutes,
      );

      if (
        (request.sessionDate !== undefined &&
          request.sessionDate !== sessionSnapshot.date) ||
        (request.sessionStartMinute !== undefined &&
          request.sessionStartMinute !== sessionSnapshot.startMinute)
      ) {
        throw new Error("Reservation session snapshot is inconsistent");
      }

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
            session_date,
            session_duration_minutes,
            session_start_minute,
            status,
            status_updated_at,
            stripe_checkout_session_id,
            stripe_checkout_session_retryable
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15
          )
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
          sessionSnapshot.date,
          sessionSnapshot.durationMinutes,
          sessionSnapshot.startMinute,
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
    sessionDurationMinutes,
  }: CreateReservationRequestInput,
  database?: DatabaseAccess,
): Promise<ReservationRequestRecord> {
  const sessionSnapshot = resolveReservationSessionSnapshot(
    requestedDates,
    sessionDurationMinutes,
  );
  const requestRecord: ReservationRequestRecord = {
    createdAt: new Date().toISOString(),
    eventType,
    guestEmail,
    guestName,
    id: randomUUID(),
    paymentStatus: "unpaid",
    requestNotes,
    requestedDates,
    ...toReservationSessionRecordFields(sessionSnapshot),
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
        session_date,
        session_duration_minutes,
        session_start_minute,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
      sessionSnapshot.date,
      sessionSnapshot.durationMinutes,
      sessionSnapshot.startMinute,
      requestRecord.status,
    ],
  );

  return requestRecord;
}

export async function updateReservationRequestStatus(
  requestId: string,
  status: ReservationRequestStatusUpdate,
  database?: DatabaseAccess,
  acceptanceDetails?: ReservationAcceptanceDetails,
): Promise<ReservationRequestStatusUpdateResult> {
  try {
    return await getDatabase(database).transaction(async (client) => {
      const requestResult = await client.query<{
        requested_start_key: string;
        session_date: string | null;
        session_duration_minutes: number | null;
        session_start_minute: number | null;
        status: ReservationRequestStatus;
      }>(
        `
          SELECT
            requested_start_key,
            session_date::text AS session_date,
            session_duration_minutes,
            session_start_minute,
            status
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
        const suppliedDuration = acceptanceDetails?.sessionDurationMinutes;

        if (
          request.session_date === null ||
          request.session_start_minute === null
        ) {
          return "session_interval_unavailable";
        }

        if (request.session_duration_minutes === null) {
          if (suppliedDuration === undefined) {
            return "session_duration_required";
          }

          if (
            !Number.isInteger(suppliedDuration) ||
            suppliedDuration <= 0 ||
            request.session_start_minute + suppliedDuration > 24 * 60
          ) {
            return "invalid_session_duration";
          }
        } else if (
          suppliedDuration !== undefined &&
          suppliedDuration !== request.session_duration_minutes
        ) {
          return "invalid_session_duration";
        }

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

        await client.query(
          `
            UPDATE reservation_requests
            SET session_duration_minutes = COALESCE(
                  session_duration_minutes,
                  $2
                ),
                status = $3,
                status_updated_at = $4
            WHERE id = $1
          `,
          [
            requestId,
            suppliedDuration ?? null,
            status,
            new Date().toISOString(),
          ],
        );

        return "updated";
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
