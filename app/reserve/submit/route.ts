import { NextResponse } from "next/server";
import { isReserveExampleSlotValue } from "../../../lib/reserve-example-availability";
import { normalizeEventType } from "../../lib/event-type";
import { createReservationRequestRecord } from "../../lib/reservation-requests";
import {
  CONFIRMATION_COOKIE_MAX_AGE_SECONDS,
  CONFIRMATION_COOKIE_NAME,
  createConfirmationStateCookieValue,
  getConfirmationCookieSecret,
} from "../../lib/confirmation-state";
import { sendReservationRequestEmail } from "../../lib/reservation-email";

const BASIC_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONFIGURATION_ERROR_QUERY = "/reserve?error=configuration";
const PERSISTENCE_ERROR_QUERY = "/reserve?error=persistence";
const VALIDATION_ERROR_QUERY = "/reserve?error=validation";
const DELIVERY_ERROR_QUERY = "/reserve?error=delivery";

const SMTP_ERROR_CATEGORY_BY_TRANSPORT_CODE = {
  EAUTH: "authentication",
  ECONNECTION: "connection",
  ECONNREFUSED: "connection",
  ECONNRESET: "connection",
  EHOSTUNREACH: "connection",
  ENETUNREACH: "connection",
  ENOTFOUND: "connection",
  ESOCKET: "connection",
  ETIMEDOUT: "timeout",
} as const;

type SmtpErrorCategory =
  | (typeof SMTP_ERROR_CATEGORY_BY_TRANSPORT_CODE)[keyof typeof SMTP_ERROR_CATEGORY_BY_TRANSPORT_CODE]
  | "unknown";
type SmtpTransportCode = keyof typeof SMTP_ERROR_CATEGORY_BY_TRANSPORT_CODE;

function sanitizeSmtpError(error: unknown): {
  category: SmtpErrorCategory;
  transportCode: SmtpTransportCode | "unknown";
  responseCode?: number;
} {
  let category: SmtpErrorCategory = "unknown";
  let transportCode: SmtpTransportCode | "unknown" = "unknown";
  let responseCode: number | undefined;

  if (typeof error !== "object" || error === null) {
    return { category, transportCode };
  }

  try {
    const errorCode = (error as { code?: unknown }).code;
    const smtpResponseCode = (error as { responseCode?: unknown }).responseCode;

    if (
      typeof errorCode === "string" &&
      Object.prototype.hasOwnProperty.call(
        SMTP_ERROR_CATEGORY_BY_TRANSPORT_CODE,
        errorCode,
      )
    ) {
      transportCode = errorCode as SmtpTransportCode;
      category = SMTP_ERROR_CATEGORY_BY_TRANSPORT_CODE[transportCode];
    }

    if (
      typeof smtpResponseCode === "number" &&
      Number.isInteger(smtpResponseCode) &&
      smtpResponseCode >= 200 &&
      smtpResponseCode <= 599
    ) {
      responseCode = smtpResponseCode;
    }
  } catch {
    return { category: "unknown", transportCode: "unknown" };
  }

  return responseCode === undefined
    ? { category, transportCode }
    : { category, transportCode, responseCode };
}

function readRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required form field: ${key}`);
  }

  return value.trim();
}

function readOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string) {
  return BASIC_EMAIL_PATTERN.test(value);
}

export async function POST(request: Request) {
  const formData = await request.formData();

  try {
    const guestName = readRequiredString(formData, "guestName");
    const guestEmail = readRequiredString(formData, "guestEmail");
    const eventType = readRequiredString(formData, "eventType");
    const requestedDates = readRequiredString(formData, "requestedDates");
    const requestNotes = readOptionalString(formData, "requestNotes");

    if (!isValidEmail(guestEmail)) {
      throw new Error("Invalid email address");
    }

    if (!(await isReserveExampleSlotValue(requestedDates))) {
      throw new Error("Invalid requested slot");
    }

    const normalizedEventType = normalizeEventType(eventType);

    if (!normalizedEventType) {
      throw new Error("Invalid event type");
    }

    const confirmationCookieSecret = getConfirmationCookieSecret();

    if (!confirmationCookieSecret) {
      return NextResponse.redirect(
        new URL(CONFIGURATION_ERROR_QUERY, request.url),
        { status: 303 },
      );
    }

    try {
      await createReservationRequestRecord({
        eventType: normalizedEventType,
        guestEmail,
        guestName,
        requestNotes,
        requestedDates,
      });
    } catch {
      return NextResponse.redirect(
        new URL(PERSISTENCE_ERROR_QUERY, request.url),
        { status: 303 },
      );
    }

    let contactEmail: string;

    try {
      const emailResult = await sendReservationRequestEmail({
        eventType: normalizedEventType,
        guestEmail,
        guestName,
        requestNotes,
        requestedDates,
      });
      contactEmail = emailResult.contactEmail;
    } catch (error) {
      console.error(
        "reservation_email_delivery_failed",
        sanitizeSmtpError(error),
      );
      return NextResponse.redirect(
        new URL(DELIVERY_ERROR_QUERY, request.url),
        { status: 303 },
      );
    }

    const response = NextResponse.redirect(
      new URL("/confirmation", request.url),
      { status: 303 },
    );

    response.cookies.set(
      CONFIRMATION_COOKIE_NAME,
      createConfirmationStateCookieValue(
        {
          contactEmail,
          eventType: normalizedEventType,
          guestEmail,
          guestName,
          requestedDates,
          requestNotes,
        },
        confirmationCookieSecret,
      ),
      {
        httpOnly: true,
        maxAge: CONFIRMATION_COOKIE_MAX_AGE_SECONDS,
        path: "/confirmation",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    );

    return response;
  } catch {
    return NextResponse.redirect(
      new URL(VALIDATION_ERROR_QUERY, request.url),
      {
        status: 303,
      },
    );
  }
}
