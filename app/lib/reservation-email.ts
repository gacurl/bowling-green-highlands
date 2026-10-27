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

const TRANSPORT_FAILURE_BY_CODE = {
  EAI_AGAIN: {
    category: "connection",
    stage: "smtp_connection",
  },
  EAUTH: {
    category: "authentication",
    stage: "smtp_authentication",
  },
  ECONFIG: {
    category: "configuration",
    stage: "transport_creation",
  },
  ECONNECTION: {
    category: "connection",
    stage: "smtp_connection",
  },
  ECONNREFUSED: {
    category: "connection",
    stage: "smtp_connection",
  },
  ECONNRESET: {
    category: "connection",
    stage: "smtp_connection",
  },
  EDNS: {
    category: "connection",
    stage: "smtp_connection",
  },
  EENVELOPE: {
    category: "message",
    stage: "send_mail",
  },
  EHOSTUNREACH: {
    category: "connection",
    stage: "smtp_connection",
  },
  EMESSAGE: {
    category: "message",
    stage: "send_mail",
  },
  ENETUNREACH: {
    category: "connection",
    stage: "smtp_connection",
  },
  ENOAUTH: {
    category: "authentication",
    stage: "smtp_authentication",
  },
  ENOTFOUND: {
    category: "connection",
    stage: "smtp_connection",
  },
  EOAUTH2: {
    category: "authentication",
    stage: "smtp_authentication",
  },
  EPROTOCOL: {
    category: "connection",
    stage: "smtp_connection",
  },
  EREQUIRETLS: {
    category: "tls",
    stage: "smtp_connection",
  },
  ESOCKET: {
    category: "connection",
    stage: "smtp_connection",
  },
  ETIMEDOUT: {
    category: "timeout",
    stage: "smtp_connection",
  },
  ETLS: {
    category: "tls",
    stage: "smtp_connection",
  },
} as const;

const MISSING_ENV_FAILURE_BY_NAME = {
  CONTACT_EMAIL: {
    category: "configuration",
    code: "MISSING_CONTACT_EMAIL",
    stage: "environment_lookup",
  },
  EMAIL_FROM: {
    category: "configuration",
    code: "MISSING_EMAIL_FROM",
    stage: "environment_lookup",
  },
  SMTP_URL: {
    category: "configuration",
    code: "MISSING_SMTP_URL",
    stage: "environment_lookup",
  },
} as const;

type RequiredEmailEnvironmentName = keyof typeof MISSING_ENV_FAILURE_BY_NAME;
type TransportFailureCode = keyof typeof TRANSPORT_FAILURE_BY_CODE;

type ReservationEmailFailureStage =
  | "environment_lookup"
  | "smtp_url_parse"
  | "transport_creation"
  | "smtp_connection"
  | "smtp_authentication"
  | "send_mail"
  | "unknown";

type ReservationEmailFailureCategory =
  | "configuration"
  | "connection"
  | "timeout"
  | "tls"
  | "authentication"
  | "message"
  | "unknown";

type ReservationEmailFailureCode =
  | (typeof MISSING_ENV_FAILURE_BY_NAME)[RequiredEmailEnvironmentName]["code"]
  | TransportFailureCode
  | "INVALID_SMTP_URL"
  | "TRANSPORT_CREATION_FAILED"
  | "UNKNOWN";

export type ReservationEmailFailureDiagnostic = {
  stage: ReservationEmailFailureStage;
  category: ReservationEmailFailureCategory;
  code: ReservationEmailFailureCode;
  responseCode?: number;
};

const UNKNOWN_EMAIL_FAILURE = {
  category: "unknown",
  code: "UNKNOWN",
  stage: "unknown",
} as const satisfies ReservationEmailFailureDiagnostic;

class ReservationEmailFailure extends Error {
  readonly diagnostic: ReservationEmailFailureDiagnostic;

  constructor(diagnostic: ReservationEmailFailureDiagnostic) {
    super("Reservation email delivery failed");
    this.name = "ReservationEmailFailure";
    this.diagnostic = diagnostic;
  }
}

function readResponseCode(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  try {
    const responseCode = (error as { responseCode?: unknown }).responseCode;

    return typeof responseCode === "number" &&
      Number.isInteger(responseCode) &&
      responseCode >= 200 &&
      responseCode <= 599
      ? responseCode
      : undefined;
  } catch {
    return undefined;
  }
}

function readTransportFailureCode(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  try {
    const code = (error as { code?: unknown }).code;

    return typeof code === "string" &&
      Object.prototype.hasOwnProperty.call(TRANSPORT_FAILURE_BY_CODE, code)
      ? (code as TransportFailureCode)
      : undefined;
  } catch {
    return undefined;
  }
}

function createTransportFailureDiagnostic(
  error: unknown,
  fallback: ReservationEmailFailureDiagnostic,
): ReservationEmailFailureDiagnostic {
  const code = readTransportFailureCode(error);
  const responseCode = readResponseCode(error);

  if (!code) {
    return responseCode === undefined
      ? fallback
      : { ...fallback, responseCode };
  }

  const classification = TRANSPORT_FAILURE_BY_CODE[code];

  return responseCode === undefined
    ? { ...classification, code }
    : { ...classification, code, responseCode };
}

function requireEnv(name: RequiredEmailEnvironmentName) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ReservationEmailFailure(MISSING_ENV_FAILURE_BY_NAME[name]);
  }

  return value;
}

function requireValidSmtpUrl(value: string) {
  try {
    const smtpUrl = new URL(value);

    if (
      (smtpUrl.protocol !== "smtp:" && smtpUrl.protocol !== "smtps:") ||
      !smtpUrl.hostname
    ) {
      throw new Error("Invalid SMTP URL");
    }
  } catch {
    throw new ReservationEmailFailure({
      category: "configuration",
      code: "INVALID_SMTP_URL",
      stage: "smtp_url_parse",
    });
  }

  return value;
}

export function getReservationEmailFailureDiagnostic(
  error: unknown,
): ReservationEmailFailureDiagnostic {
  try {
    return error instanceof ReservationEmailFailure
      ? error.diagnostic
      : UNKNOWN_EMAIL_FAILURE;
  } catch {
    return UNKNOWN_EMAIL_FAILURE;
  }
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
  const smtpUrl = requireValidSmtpUrl(requireEnv("SMTP_URL"));

  let transport: ReturnType<typeof nodemailer.createTransport>;

  try {
    transport = nodemailer.createTransport(smtpUrl);
  } catch (error) {
    throw new ReservationEmailFailure(
      createTransportFailureDiagnostic(error, {
        category: "unknown",
        code: "TRANSPORT_CREATION_FAILED",
        stage: "transport_creation",
      }),
    );
  }

  const text = [
    "Bowling Green Highlands reservation request",
    "",
    "Guest details",
    `- Name: ${guestName}`,
    `- Email: ${guestEmail}`,
    "",
    "Request details",
    `- Requested date and time: ${formatRequestedSlotLabel(requestedDates)}`,
    `- Event type: ${getEventTypeLabel(eventType)}`,
    `- Notes: ${requestNotes || "None provided"}`,
    "",
    "Next step",
    "This is a request only. Review and reply directly to the guest.",
  ].join("\n");

  try {
    await transport.sendMail({
      from: emailFrom,
      replyTo: guestEmail,
      to: contactEmail,
      subject: `Reservation request from ${guestName}`,
      text,
    });
  } catch (error) {
    throw new ReservationEmailFailure(
      createTransportFailureDiagnostic(error, {
        category: "unknown",
        code: "UNKNOWN",
        stage: "send_mail",
      }),
    );
  }

  return { contactEmail };
}
