import nodemailer from "nodemailer";
import { formatRequestedSlotLabel } from "../../lib/requested-slot";
import { getEventTypeLabel, type EventTypeValue } from "./event-type";

type ReservationEmailInput = {
  eventType: EventTypeValue;
  guestEmail: string;
  guestName: string;
  requestNotes: string;
  requestedDates: string;
};

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export async function sendReservationRequestEmail({
  eventType,
  guestEmail,
  guestName,
  requestNotes,
  requestedDates,
}: ReservationEmailInput) {
  const contactEmail = requireEnv("CONTACT_EMAIL");
  const emailFrom = requireEnv("EMAIL_FROM");
  const smtpUrl = requireEnv("SMTP_URL");

  const transport = nodemailer.createTransport(smtpUrl);

  const text = [
    "New Bowling Green Highlands reservation request",
    "",
    `Name: ${guestName}`,
    `Email: ${guestEmail}`,
    `Event type: ${getEventTypeLabel(eventType)}`,
    `Requested date and time: ${formatRequestedSlotLabel(requestedDates)}`,
    `Notes: ${requestNotes || "None provided"}`,
    "",
    "This is a request only. Please review and reply directly to the guest.",
  ].join("\n");

  await transport.sendMail({
    from: emailFrom,
    replyTo: guestEmail,
    to: contactEmail,
    subject: `Reservation request from ${guestName}`,
    text,
  });

  return { contactEmail };
}
