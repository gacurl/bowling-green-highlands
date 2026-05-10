import { NextResponse } from "next/server";
import { isReserveExampleSlotValue } from "../../../lib/reserve-example-availability";
import {
  CONFIRMATION_COOKIE_MAX_AGE_SECONDS,
  CONFIRMATION_COOKIE_NAME,
  createConfirmationStateCookieValue,
} from "../../lib/confirmation-state";
import { sendReservationRequestEmail } from "../../lib/reservation-email";

const BASIC_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function getConfirmationSigningSecret() {
  const signingSecret = process.env.SMTP_URL?.trim();

  if (!signingSecret) {
    throw new Error("Missing confirmation signing secret");
  }

  return signingSecret;
}

export async function POST(request: Request) {
  const formData = await request.formData();

  try {
    const guestName = readRequiredString(formData, "guestName");
    const guestEmail = readRequiredString(formData, "guestEmail");
    const requestedDates = readRequiredString(formData, "requestedDates");
    const requestNotes = readOptionalString(formData, "requestNotes");

    if (!isValidEmail(guestEmail)) {
      throw new Error("Invalid email address");
    }

    if (!isReserveExampleSlotValue(requestedDates)) {
      throw new Error("Invalid requested slot");
    }

    const { contactEmail } = await sendReservationRequestEmail({
      guestEmail,
      guestName,
      requestNotes,
      requestedDates,
    });

    const response = NextResponse.redirect(
      new URL("/confirmation", request.url),
      { status: 303 },
    );

    response.cookies.set(
      CONFIRMATION_COOKIE_NAME,
      createConfirmationStateCookieValue(
        {
          contactEmail,
          guestEmail,
          guestName,
          requestedDates,
          requestNotes,
        },
        getConfirmationSigningSecret(),
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
    return NextResponse.redirect(new URL("/reserve?error=1", request.url), {
      status: 303,
    });
  }
}
