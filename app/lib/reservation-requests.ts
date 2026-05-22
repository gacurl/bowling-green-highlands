import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EventTypeValue } from "./event-type";

export type ReservationRequestStatus = "pending";

export type ReservationRequestRecord = {
  createdAt: string;
  eventType: EventTypeValue;
  guestEmail: string;
  guestName: string;
  id: string;
  requestNotes: string;
  requestedDates: string;
  status: ReservationRequestStatus;
};

type ReservationRequestStoreFile = {
  requests?: unknown;
};

type CreateReservationRequestInput = {
  eventType: EventTypeValue;
  guestEmail: string;
  guestName: string;
  requestNotes: string;
  requestedDates: string;
};

function getReservationRequestStorePath() {
  return (
    process.env.BGH_RESERVATION_REQUESTS_STORE_PATH ??
    path.join(process.cwd(), "data", "reservation-requests.json")
  );
}

function normalizeReservationRequestRecord(
  value: unknown,
): ReservationRequestRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.id !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.guestName !== "string" ||
    typeof record.guestEmail !== "string" ||
    typeof record.requestNotes !== "string" ||
    typeof record.requestedDates !== "string" ||
    typeof record.eventType !== "string" ||
    record.status !== "pending"
  ) {
    return null;
  }

  return {
    createdAt: record.createdAt,
    eventType: record.eventType as EventTypeValue,
    guestEmail: record.guestEmail,
    guestName: record.guestName,
    id: record.id,
    requestNotes: record.requestNotes,
    requestedDates: record.requestedDates,
    status: "pending",
  };
}

function normalizeReservationRequestStore(
  storeValue: unknown,
): ReservationRequestRecord[] {
  if (!storeValue || typeof storeValue !== "object" || Array.isArray(storeValue)) {
    return [];
  }

  const requests = (storeValue as ReservationRequestStoreFile).requests;

  if (!Array.isArray(requests)) {
    return [];
  }

  return requests
    .map((requestRecord) => normalizeReservationRequestRecord(requestRecord))
    .filter(
      (requestRecord): requestRecord is ReservationRequestRecord =>
        requestRecord !== null,
    );
}

function toStoreFile(
  requests: ReservationRequestRecord[],
): ReservationRequestStoreFile {
  return { requests };
}

export async function readReservationRequests(
  storePath = getReservationRequestStorePath(),
): Promise<ReservationRequestRecord[]> {
  try {
    const fileContents = await readFile(storePath, "utf8");
    const parsedStore = JSON.parse(fileContents);

    return normalizeReservationRequestStore(parsedStore);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function writeReservationRequests(
  requests: ReservationRequestRecord[],
  storePath = getReservationRequestStorePath(),
) {
  const directory = path.dirname(storePath);
  const temporaryPath = `${storePath}.tmp`;
  const serializedStore = `${JSON.stringify(toStoreFile(requests), null, 2)}\n`;

  await mkdir(directory, { recursive: true });
  await writeFile(temporaryPath, serializedStore, "utf8");
  await rename(temporaryPath, storePath);
}

export async function createReservationRequestRecord(
  {
    eventType,
    guestEmail,
    guestName,
    requestNotes,
    requestedDates,
  }: CreateReservationRequestInput,
  storePath = getReservationRequestStorePath(),
) {
  const requests = await readReservationRequests(storePath);
  const requestRecord: ReservationRequestRecord = {
    createdAt: new Date().toISOString(),
    eventType,
    guestEmail,
    guestName,
    id: randomUUID(),
    requestNotes,
    requestedDates,
    status: "pending",
  };

  requests.push(requestRecord);
  await writeReservationRequests(requests, storePath);

  return requestRecord;
}
