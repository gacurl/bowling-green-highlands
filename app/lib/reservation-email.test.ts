import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import {
  getReservationEmailFailureDiagnostic,
  sendReservationRequestEmail,
  type ReservationEmailFailureDiagnostic,
} from "./reservation-email";

const originalCreateTransport = nodemailer.createTransport;

const reservationEmailInput = {
  eventType: "farm_stay" as const,
  guestEmail: "guest@example.com",
  guestName: "Guest Name",
  requestNotes: "Please call first.",
  requestedDates: "2026-06-14 09:00 to 09:30",
};

function withEnvironment(runTest: () => Promise<void> | void) {
  return async () => {
    const previousContactEmail = process.env.CONTACT_EMAIL;
    const previousEmailFrom = process.env.EMAIL_FROM;
    const previousSmtpUrl = process.env.SMTP_URL;

    process.env.CONTACT_EMAIL = "operator@example.com";
    process.env.EMAIL_FROM = "reservations@example.com";
    process.env.SMTP_URL = "smtp://smtp.example.com";

    try {
      await runTest();
    } finally {
      if (previousContactEmail === undefined) {
        delete process.env.CONTACT_EMAIL;
      } else {
        process.env.CONTACT_EMAIL = previousContactEmail;
      }

      if (previousEmailFrom === undefined) {
        delete process.env.EMAIL_FROM;
      } else {
        process.env.EMAIL_FROM = previousEmailFrom;
      }

      if (previousSmtpUrl === undefined) {
        delete process.env.SMTP_URL;
      } else {
        process.env.SMTP_URL = previousSmtpUrl;
      }

      nodemailer.createTransport = originalCreateTransport;
    }
  };
}

async function captureFailureDiagnostic() {
  try {
    await sendReservationRequestEmail(reservationEmailInput);
  } catch (error) {
    return getReservationEmailFailureDiagnostic(error);
  }

  assert.fail("Expected reservation email delivery to fail");
}

function mockEmailTransport(sendMail: (email?: unknown) => Promise<unknown>) {
  nodemailer.createTransport = ((() => ({
    sendMail,
  })) as unknown) as typeof nodemailer.createTransport;
}

for (const testCase of [
  {
    code: "MISSING_CONTACT_EMAIL",
    name: "CONTACT_EMAIL",
  },
  {
    code: "MISSING_EMAIL_FROM",
    name: "EMAIL_FROM",
  },
  {
    code: "MISSING_SMTP_URL",
    name: "SMTP_URL",
  },
] as const) {
  test(
    `missing ${testCase.name} is classified at environment lookup`,
    withEnvironment(async () => {
      delete process.env[testCase.name];

      assert.deepEqual(await captureFailureDiagnostic(), {
        category: "configuration",
        code: testCase.code,
        stage: "environment_lookup",
      });
    }),
  );
}

test(
  "malformed SMTP URLs fail before transport creation",
  withEnvironment(async () => {
    let createTransportCalls = 0;
    nodemailer.createTransport = (((() => {
      createTransportCalls += 1;
      return { sendMail: async () => undefined };
    }) as unknown) as typeof nodemailer.createTransport);

    for (const smtpUrl of [
      "not-an-smtp-url",
      "https://smtp.example.com",
      "smtp://",
    ]) {
      process.env.SMTP_URL = smtpUrl;

      assert.deepEqual(await captureFailureDiagnostic(), {
        category: "configuration",
        code: "INVALID_SMTP_URL",
        stage: "smtp_url_parse",
      });
    }

    assert.equal(createTransportCalls, 0);
  }),
);

test(
  "valid SMTP configuration preserves email delivery behavior",
  withEnvironment(async () => {
    const sentEmails: unknown[] = [];
    mockEmailTransport(async (email) => {
      sentEmails.push(email);
    });

    assert.deepEqual(
      await sendReservationRequestEmail(reservationEmailInput),
      { contactEmail: "operator@example.com" },
    );
    assert.equal(sentEmails.length, 1);
  }),
);

test(
  "transport creation failures discard raw error details",
  withEnvironment(async () => {
    const sentinelCredential = "transport-credential-sentinel";
    nodemailer.createTransport = (((() => {
      throw Object.assign(new Error(sentinelCredential), {
        response: sentinelCredential,
        stack: sentinelCredential,
      });
    }) as unknown) as typeof nodemailer.createTransport);

    const diagnostic = await captureFailureDiagnostic();

    assert.deepEqual(diagnostic, {
      category: "unknown",
      code: "TRANSPORT_CREATION_FAILED",
      stage: "transport_creation",
    });
    assert.doesNotMatch(JSON.stringify(diagnostic), /transport-credential-sentinel/);
  }),
);

test(
  "allowlisted sendMail errors identify their failure stages",
  withEnvironment(async () => {
    const cases: Array<{
      code: string;
      expected: ReservationEmailFailureDiagnostic;
    }> = [
      {
        code: "ECONNECTION",
        expected: {
          category: "connection",
          code: "ECONNECTION",
          stage: "smtp_connection",
        },
      },
      {
        code: "EDNS",
        expected: {
          category: "connection",
          code: "EDNS",
          stage: "smtp_connection",
        },
      },
      {
        code: "ETIMEDOUT",
        expected: {
          category: "timeout",
          code: "ETIMEDOUT",
          stage: "smtp_connection",
        },
      },
      {
        code: "ETLS",
        expected: {
          category: "tls",
          code: "ETLS",
          stage: "smtp_connection",
        },
      },
      {
        code: "EAUTH",
        expected: {
          category: "authentication",
          code: "EAUTH",
          responseCode: 535,
          stage: "smtp_authentication",
        },
      },
      {
        code: "EENVELOPE",
        expected: {
          category: "message",
          code: "EENVELOPE",
          stage: "send_mail",
        },
      },
      {
        code: "EMESSAGE",
        expected: {
          category: "message",
          code: "EMESSAGE",
          stage: "send_mail",
        },
      },
    ];

    for (const testCase of cases) {
      mockEmailTransport(async () => {
        throw Object.assign(new Error("raw SMTP error"), {
          code: testCase.code,
          responseCode: testCase.code === "EAUTH" ? 535 : undefined,
        });
      });

      assert.deepEqual(await captureFailureDiagnostic(), testCase.expected);
    }
  }),
);

test(
  "unknown sendMail failures remain unknown and exclude sensitive fields",
  withEnvironment(async () => {
    const sentinelCredential = "smtp://user:credential@private.example";
    const sentinelGuestData = "Private Guest Notes";
    mockEmailTransport(async () => {
      throw {
        code: sentinelCredential,
        message: sentinelGuestData,
        response: `${sentinelCredential} ${sentinelGuestData}`,
        responseCode: "535",
        stack: sentinelCredential,
      };
    });

    const diagnostic = await captureFailureDiagnostic();

    assert.deepEqual(diagnostic, {
      category: "unknown",
      code: "UNKNOWN",
      stage: "send_mail",
    });
    assert.doesNotMatch(JSON.stringify(diagnostic), /credential/);
    assert.doesNotMatch(JSON.stringify(diagnostic), /Private Guest Notes/);
  }),
);

test(
  "SMTP response codes are included only when they are valid integers",
  withEnvironment(async () => {
    for (const responseCode of [199, 535.5, 600, "535"]) {
      mockEmailTransport(async () => {
        throw Object.assign(new Error("authentication failed"), {
          code: "EAUTH",
          responseCode,
        });
      });

      assert.deepEqual(await captureFailureDiagnostic(), {
        category: "authentication",
        code: "EAUTH",
        stage: "smtp_authentication",
      });
    }
  }),
);

test(
  "unexpected failures outside the email boundary remain unknown",
  () => {
    assert.deepEqual(
      getReservationEmailFailureDiagnostic(new Error("raw unexpected error")),
      {
        category: "unknown",
        code: "UNKNOWN",
        stage: "unknown",
      },
    );
  },
);
