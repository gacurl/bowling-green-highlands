import { redirect } from "next/navigation";
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

export async function POST(request: Request) {
  const formData = await request.formData();
  let confirmationUrl: string;

  try {
    const guestName = readRequiredString(formData, "guestName");
    const guestEmail = readRequiredString(formData, "guestEmail");
    const requestedDates = readRequiredString(formData, "requestedDates");
    const requestNotes = readOptionalString(formData, "requestNotes");

    if (!isValidEmail(guestEmail)) {
      throw new Error("Invalid email address");
    }

    const { contactEmail } = await sendReservationRequestEmail({
      guestEmail,
      guestName,
      requestNotes,
      requestedDates,
    });

    confirmationUrl = `/confirmation?submitted=1&guestName=${encodeURIComponent(guestName)}&guestEmail=${encodeURIComponent(guestEmail)}&requestedDates=${encodeURIComponent(requestedDates)}&requestNotes=${encodeURIComponent(requestNotes)}&contactEmail=${encodeURIComponent(contactEmail)}`;
  } catch {
    redirect("/reserve?error=1");
  }

  redirect(confirmationUrl);
}
