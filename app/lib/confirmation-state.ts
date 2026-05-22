import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";

export const CONFIRMATION_COOKIE_NAME = "bgh_confirmation_request";
export const CONFIRMATION_COOKIE_MAX_AGE_SECONDS = 5 * 60;

export type ConfirmationState = {
  contactEmail: string;
  eventType: string;
  guestEmail: string;
  guestName: string;
  requestedDates: string;
  requestNotes: string;
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeConfirmationState(
  value: Record<string, unknown>,
): ConfirmationState | null {
  const contactEmail = readString(value.contactEmail);
  const eventType = readString(value.eventType);
  const guestEmail = readString(value.guestEmail);
  const guestName = readString(value.guestName);
  const requestedDates = readString(value.requestedDates);
  const requestNotes = readString(value.requestNotes);

  if (!guestEmail || !guestName || !requestedDates) {
    return null;
  }

  return {
    contactEmail,
    eventType,
    guestEmail,
    guestName,
    requestedDates,
    requestNotes,
  };
}

function signPayload(payload: string, signingSecret: string) {
  return createHmac("sha256", signingSecret).update(payload).digest("base64url");
}

function signaturesMatch(signature: string, expectedSignature: string) {
  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  return (
    signatureBuffer.length === expectedSignatureBuffer.length &&
    timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  );
}

export function createConfirmationStateCookieValue(
  state: ConfirmationState,
  signingSecret: string,
) {
  const trimmedSigningSecret = signingSecret.trim();

  if (!trimmedSigningSecret) {
    throw new Error("Missing confirmation signing secret");
  }

  const payload = Buffer.from(JSON.stringify(state), "utf8").toString(
    "base64url",
  );
  const signature = signPayload(payload, trimmedSigningSecret);

  return `${payload}.${signature}`;
}

export function readConfirmationStateCookieValue(
  cookieValue: string | undefined,
  signingSecret: string | undefined,
) {
  if (!cookieValue) {
    return null;
  }

  const trimmedSigningSecret = signingSecret?.trim();

  if (!trimmedSigningSecret) {
    return null;
  }

  try {
    const [payload, signature] = cookieValue.split(".");

    if (!payload || !signature) {
      return null;
    }

    const expectedSignature = signPayload(payload, trimmedSigningSecret);

    if (!signaturesMatch(signature, expectedSignature)) {
      return null;
    }

    const parsedValue = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );

    if (!parsedValue || typeof parsedValue !== "object") {
      return null;
    }

    return normalizeConfirmationState(
      parsedValue as Record<string, unknown>,
    );
  } catch {
    return null;
  }
}
