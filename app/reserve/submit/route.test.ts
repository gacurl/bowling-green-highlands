import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import {
  setDatabaseForTests,
  type DatabaseAccess,
} from "../../../lib/server/database";
import {
  createTestDatabase,
  failDatabaseMutations,
} from "../../../lib/test-support/postgres-test-database";
import { POST } from "./route";
import {
  CONFIRMATION_COOKIE_NAME,
  readConfirmationStateCookieValue,
} from "../../lib/confirmation-state";
import {
  getReserveDateOptions,
} from "../../../lib/reserve-example-availability";
import {
  createReservationRequestRecord,
  readReservationRequests,
  updateReservationRequestStatus,
} from "../../lib/reservation-requests";
import {
  setOperatorDateAvailability,
  setOperatorDateAvailabilityWindow,
} from "../../../lib/operator-availability";

type SentEmail = {
  from: string;
  replyTo: string;
  subject: string;
  text: string;
  to: string;
};

const originalCreateTransport = nodemailer.createTransport;
const TEST_DATE = "2026-06-14";

function createReservationRequest(overrides: Record<string, string> = {}) {
  const formData = new URLSearchParams({
    eventType: "farm_stay",
    guestEmail: "guest@example.com",
    guestName: "Guest Name",
    preferredTime: "09:00",
    requestedDate: TEST_DATE,
    requestNotes: "Please call first.",
    ...overrides,
  });

  return new Request("http://localhost/reserve/submit", {
    body: formData,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
}

function readRedirectPath(response: Response) {
  const location = response.headers.get("location");

  assert.ok(location);

  return new URL(location).pathname + new URL(location).search;
}

function setNodeEnv(value: NodeJS.ProcessEnv["NODE_ENV"] | undefined) {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, "NODE_ENV");
    return;
  }

  Object.defineProperty(process.env, "NODE_ENV", {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function withEnvironment(runTest: () => Promise<void> | void) {
  return async () => {
    const previousContactEmail = process.env.CONTACT_EMAIL;
    const previousConfirmationCookieSecret =
      process.env.CONFIRMATION_COOKIE_SECRET;
    const previousEmailFrom = process.env.EMAIL_FROM;
    const previousSmtpUrl = process.env.SMTP_URL;

    process.env.CONTACT_EMAIL = "operator@example.com";
    process.env.CONFIRMATION_COOKIE_SECRET = "test-confirmation-cookie-secret";
    process.env.EMAIL_FROM = "reservations@example.com";
    process.env.SMTP_URL = "smtp://test-smtp-url";

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

      if (previousConfirmationCookieSecret === undefined) {
        delete process.env.CONFIRMATION_COOKIE_SECRET;
      } else {
        process.env.CONFIRMATION_COOKIE_SECRET = previousConfirmationCookieSecret;
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

function withAvailabilityStore(
  runTest: (database: DatabaseAccess) => Promise<void> | void,
) {
  return async () => {
    const database = await createTestDatabase();
    setDatabaseForTests(database);

    try {
      await runTest(database);
    } finally {
      setDatabaseForTests(null);
    }
  };
}

function mockEmailTransport(sentEmails: SentEmail[]) {
  nodemailer.createTransport = ((() => ({
    sendMail: async (email: SentEmail) => {
      sentEmails.push(email);
    },
  })) as unknown) as typeof nodemailer.createTransport;
}

function mockFailingEmailTransport(error: unknown) {
  nodemailer.createTransport = ((() => ({
    sendMail: async () => {
      throw error;
    },
  })) as unknown) as typeof nodemailer.createTransport;
}

test(
  "valid reservation submissions redirect to confirmation and send email",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(TEST_DATE, "available");

      const sentEmails: SentEmail[] = [];
      mockEmailTransport(sentEmails);

      const response = await POST(createReservationRequest());
      const cookie = response.headers.get("set-cookie") ?? "";
      const cookieValue = /bgh_confirmation_request=([^;]+)/.exec(cookie)?.[1];

      assert.equal(response.status, 303);
      assert.equal(readRedirectPath(response), "/confirmation");
      assert.match(cookie, new RegExp(`${CONFIRMATION_COOKIE_NAME}=`));
      assert.deepEqual(
        readConfirmationStateCookieValue(
          cookieValue,
          process.env.CONFIRMATION_COOKIE_SECRET,
        ),
        {
          contactEmail: "operator@example.com",
          eventType: "farm_stay",
          guestEmail: "guest@example.com",
          guestName: "Guest Name",
          requestedDates: "2026-06-14 09:00",
          requestNotes: "Please call first.",
        },
      );
      assert.equal(
        readConfirmationStateCookieValue(cookieValue, process.env.SMTP_URL),
        null,
      );
      assert.match(cookie, /Max-Age=300/);
      assert.equal(sentEmails.length, 1);
      assert.equal(sentEmails[0].to, "operator@example.com");
      assert.equal(sentEmails[0].replyTo, "guest@example.com");
      assert.match(sentEmails[0].text, /Guest details/);
      assert.match(sentEmails[0].text, /- Name: Guest Name/);
      assert.match(sentEmails[0].text, /Request details/);
      assert.match(sentEmails[0].text, /- Event type: Farm stay/);
      assert.match(
        sentEmails[0].text,
        /- Requested date and time: Sunday, June 14, 2026, 09:00/,
      );
      assert.match(
        sentEmails[0].text,
        /This is a request only\. Review and reply directly to the guest\./,
      );

      const reservationRequests = await readReservationRequests();

      assert.equal(reservationRequests.length, 1);
      assert.equal(reservationRequests[0].status, "pending");
      assert.equal(reservationRequests[0].eventType, "farm_stay");
      assert.equal(reservationRequests[0].guestName, "Guest Name");
      assert.equal(reservationRequests[0].guestEmail, "guest@example.com");
      assert.equal(
        reservationRequests[0].requestedDates,
        "2026-06-14 09:00",
      );
      assert.equal(reservationRequests[0].requestNotes, "Please call first.");
      assert.match(reservationRequests[0].id, /^[0-9a-f-]{36}$/);
      assert.ok(!Number.isNaN(Date.parse(reservationRequests[0].createdAt)));
    }),
  ),
);

test(
  "delivery failures redirect to reserve delivery error",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(TEST_DATE, "available");
      const sentinelCredential = "smtp-password-sentinel";
      const sentinelGuestData = "guest@example.com";
      const smtpError = Object.assign(
        new Error(`${sentinelCredential} ${sentinelGuestData}`),
        {
          code: "EAUTH",
          response: `${sentinelCredential} ${sentinelGuestData}`,
          responseCode: 535,
        },
      );
      mockFailingEmailTransport(smtpError);

      const loggedErrors: unknown[][] = [];
      const originalConsoleError = console.error;
      console.error = (...args: unknown[]) => {
        loggedErrors.push(args);
      };

      try {
        const response = await POST(createReservationRequest());

        assert.equal(response.status, 303);
        assert.equal(readRedirectPath(response), "/reserve?error=delivery");
        assert.equal(response.headers.get("set-cookie"), null);

        const reservationRequests = await readReservationRequests();

        assert.equal(reservationRequests.length, 1);
        assert.deepEqual(loggedErrors, [
          [
            "reservation_email_delivery_failed",
            {
              category: "authentication",
              code: "EAUTH",
              responseCode: 535,
              stage: "smtp_authentication",
            },
          ],
        ]);
        assert.doesNotMatch(JSON.stringify(loggedErrors), /smtp-password-sentinel/);
        assert.doesNotMatch(JSON.stringify(loggedErrors), /guest@example\.com/);
      } finally {
        console.error = originalConsoleError;
      }
    }),
  ),
);

test(
  "delivery failure logging rejects arbitrary SMTP error metadata",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(TEST_DATE, "available");
      const sentinelCredential = "smtp://user:credential@private.example";
      const sentinelGuestData = "Private Guest Notes";
      mockFailingEmailTransport({
        code: sentinelCredential,
        message: sentinelGuestData,
        response: `${sentinelCredential} ${sentinelGuestData}`,
        responseCode: "535",
        stack: sentinelCredential,
      });

      const loggedErrors: unknown[][] = [];
      const originalConsoleError = console.error;
      console.error = (...args: unknown[]) => {
        loggedErrors.push(args);
      };

      try {
        const response = await POST(createReservationRequest());

        assert.equal(response.status, 303);
        assert.equal(readRedirectPath(response), "/reserve?error=delivery");
        assert.equal(response.headers.get("set-cookie"), null);
        assert.equal((await readReservationRequests()).length, 1);
        assert.deepEqual(loggedErrors, [
          [
            "reservation_email_delivery_failed",
            {
              category: "unknown",
              code: "UNKNOWN",
              stage: "send_mail",
            },
          ],
        ]);
        assert.doesNotMatch(JSON.stringify(loggedErrors), /credential/);
        assert.doesNotMatch(JSON.stringify(loggedErrors), /Private Guest Notes/);
      } finally {
        console.error = originalConsoleError;
      }
    }),
  ),
);

test(
  "reservation persistence failures explain that the request was not saved",
  withAvailabilityStore(
    async (database) =>
      withEnvironment(async () => {
        await setOperatorDateAvailability(TEST_DATE, "available");
        setDatabaseForTests(failDatabaseMutations(database));

        const sentEmails: SentEmail[] = [];
        mockEmailTransport(sentEmails);

        const response = await POST(createReservationRequest());

        assert.equal(response.status, 303);
        assert.equal(readRedirectPath(response), "/reserve?error=persistence");
        assert.equal(response.headers.get("set-cookie"), null);
        assert.equal(sentEmails.length, 0);
      })(),
  ),
);

test(
  "missing production confirmation cookie secret explains that the request was not saved",
  withAvailabilityStore(
    withEnvironment(async () => {
      const previousNodeEnv = process.env.NODE_ENV;

      setNodeEnv("production");
      delete process.env.CONFIRMATION_COOKIE_SECRET;

      try {
        await setOperatorDateAvailability(TEST_DATE, "available");

        const sentEmails: SentEmail[] = [];
        mockEmailTransport(sentEmails);

        const response = await POST(createReservationRequest());

        assert.equal(response.status, 303);
        assert.equal(readRedirectPath(response), "/reserve?error=configuration");
        assert.equal(response.headers.get("set-cookie"), null);
        assert.equal(sentEmails.length, 0);
        assert.deepEqual(await readReservationRequests(), []);
      } finally {
        setNodeEnv(previousNodeEnv);
      }
    }),
  ),
);

test(
  "submit validation accepts a preferred time for a publicly available date",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(TEST_DATE, "available");

      const sentEmails: SentEmail[] = [];
      mockEmailTransport(sentEmails);
      const [publicOption] = await getReserveDateOptions();

      assert.ok(publicOption);

      const response = await POST(
        createReservationRequest({
          preferredTime: "09:15",
          requestedDate: publicOption.date,
        }),
      );

      assert.equal(response.status, 303);
      assert.equal(readRedirectPath(response), "/confirmation");
      assert.equal(sentEmails.length, 1);
      assert.equal(
        (await readReservationRequests())[0].requestedDates,
        `${TEST_DATE} 09:15`,
      );
    }),
  ),
);

test(
  "submissions can target a second operator-available date",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability("2026-06-14", "available");
      await setOperatorDateAvailability("2026-06-15", "available");

      const sentEmails: SentEmail[] = [];
      mockEmailTransport(sentEmails);
      const secondDateOption = (await getReserveDateOptions()).find(
        (option) => option.date === "2026-06-15",
      );

      assert.ok(secondDateOption);

      const response = await POST(
        createReservationRequest({ requestedDate: secondDateOption.date }),
      );

      assert.equal(response.status, 303);
      assert.equal(readRedirectPath(response), "/confirmation");
      assert.equal(sentEmails.length, 1);
    }),
  ),
);

test(
  "unconfigured dates cannot be submitted",
  withAvailabilityStore(
    withEnvironment(async () => {
      const sentEmails: SentEmail[] = [];
      mockEmailTransport(sentEmails);

      const response = await POST(createReservationRequest());

      assert.equal(response.status, 303);
      assert.equal(readRedirectPath(response), "/reserve?error=validation");
      assert.equal(response.headers.get("set-cookie"), null);
      assert.equal(sentEmails.length, 0);
      assert.deepEqual(await readReservationRequests(), []);
    }),
  ),
);

test(
  "blocked dates cannot be submitted",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(TEST_DATE, "unavailable");

      const sentEmails: SentEmail[] = [];
      mockEmailTransport(sentEmails);

      const response = await POST(createReservationRequest());

      assert.equal(response.status, 303);
      assert.equal(readRedirectPath(response), "/reserve?error=validation");
      assert.equal(response.headers.get("set-cookie"), null);
      assert.equal(sentEmails.length, 0);
      assert.deepEqual(await readReservationRequests(), []);
    }),
  ),
);

test(
  "window-end and out-of-window preferred times cannot be submitted",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(TEST_DATE, "available");

      for (const preferredTime of ["08:45", "11:00"]) {
        const sentEmails: SentEmail[] = [];
        mockEmailTransport(sentEmails);
        const response = await POST(
          createReservationRequest({ preferredTime }),
        );

        assert.equal(response.status, 303);
        assert.equal(readRedirectPath(response), "/reserve?error=validation");
        assert.equal(response.headers.get("set-cookie"), null);
        assert.equal(sentEmails.length, 0);
        assert.deepEqual(await readReservationRequests(), []);
      }
    }),
  ),
);

test(
  "non-quarter-hour preferred times fail safely",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(TEST_DATE, "available");

      const sentEmails: SentEmail[] = [];
      mockEmailTransport(sentEmails);

      const response = await POST(
        createReservationRequest({
          preferredTime: "09:10",
        }),
      );

      assert.equal(response.status, 303);
      assert.equal(readRedirectPath(response), "/reserve?error=validation");
      assert.equal(response.headers.get("set-cookie"), null);
      assert.equal(sentEmails.length, 0);
      assert.deepEqual(await readReservationRequests(), []);
    }),
  ),
);

test(
  "stale preferred times are rejected if the configured window changes",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(TEST_DATE, "available");
      const [publicOption] = await getReserveDateOptions();

      assert.ok(publicOption);

      await setOperatorDateAvailabilityWindow(
        TEST_DATE,
        10 * 60,
        2 * 60,
      );

      const sentEmails: SentEmail[] = [];
      mockEmailTransport(sentEmails);
      const response = await POST(
        createReservationRequest({ requestedDate: publicOption.date }),
      );

      assert.equal(response.status, 303);
      assert.equal(readRedirectPath(response), "/reserve?error=validation");
      assert.equal(response.headers.get("set-cookie"), null);
      assert.equal(sentEmails.length, 0);
      assert.deepEqual(await readReservationRequests(), []);
    }),
  ),
);

test(
  "accepted legacy start-time conflicts are rejected before submit",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(TEST_DATE, "available");
      const acceptedRequest = await createReservationRequestRecord(
        {
          eventType: "farm_stay",
          guestEmail: "accepted@example.com",
          guestName: "Accepted Guest",
          requestNotes: "",
          requestedDates: `${TEST_DATE} 09:00 to 09:30`,
        },
      );
      assert.equal(
        await updateReservationRequestStatus(acceptedRequest.id, "accepted"),
        "updated",
      );

      const sentEmails: SentEmail[] = [];
      mockEmailTransport(sentEmails);
      const staleSubmitResponse = await POST(createReservationRequest());

      assert.equal(staleSubmitResponse.status, 303);
      assert.equal(readRedirectPath(staleSubmitResponse), "/reserve?error=validation");
      assert.equal(staleSubmitResponse.headers.get("set-cookie"), null);
      assert.equal(sentEmails.length, 0);
      assert.equal((await readReservationRequests()).length, 1);
    }),
  ),
);

test(
  "malformed preferred date and time formats are rejected",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(TEST_DATE, "available");

      const malformedOverrides: Record<string, string>[] = [
        { preferredTime: "9:00" },
        { requestedDate: "2026-02-30" },
      ];

      for (const overrides of malformedOverrides) {
        const sentEmails: SentEmail[] = [];
        mockEmailTransport(sentEmails);
        const response = await POST(createReservationRequest(overrides));

        assert.equal(response.status, 303);
        assert.equal(readRedirectPath(response), "/reserve?error=validation");
        assert.equal(response.headers.get("set-cookie"), null);
        assert.equal(sentEmails.length, 0);
        assert.deepEqual(await readReservationRequests(), []);
      }
    }),
  ),
);

test(
  "legacy event type values are normalized before confirmation and email",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(TEST_DATE, "available");

      const sentEmails: SentEmail[] = [];
      mockEmailTransport(sentEmails);
      const response = await POST(
        createReservationRequest({ eventType: "farm stay" }),
      );
      const cookie = response.headers.get("set-cookie") ?? "";
      const cookieValue = /bgh_confirmation_request=([^;]+)/.exec(cookie)?.[1];

      assert.equal(response.status, 303);
      assert.equal(readRedirectPath(response), "/confirmation");
      assert.deepEqual(
        readConfirmationStateCookieValue(
          cookieValue,
          process.env.CONFIRMATION_COOKIE_SECRET,
        ),
        {
          contactEmail: "operator@example.com",
          eventType: "farm_stay",
          guestEmail: "guest@example.com",
          guestName: "Guest Name",
          requestedDates: "2026-06-14 09:00",
          requestNotes: "Please call first.",
        },
      );
      assert.equal(sentEmails.length, 1);
      assert.match(sentEmails[0].text, /- Event type: Farm stay/);
      assert.match(
        sentEmails[0].text,
        /- Requested date and time: Sunday, June 14, 2026, 09:00/,
      );
    }),
  ),
);

test(
  "unsupported event types are rejected",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(TEST_DATE, "available");

      const sentEmails: SentEmail[] = [];
      mockEmailTransport(sentEmails);
      const response = await POST(
        createReservationRequest({ eventType: "birthday-party" }),
      );

      assert.equal(response.status, 303);
      assert.equal(readRedirectPath(response), "/reserve?error=validation");
      assert.equal(response.headers.get("set-cookie"), null);
      assert.equal(sentEmails.length, 0);
    }),
  ),
);

test(
  "invalid submission payloads fail safely",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(TEST_DATE, "available");

      const sentEmails: SentEmail[] = [];
      mockEmailTransport(sentEmails);

      const response = await POST(createReservationRequest({ guestEmail: "bad" }));

      assert.equal(response.status, 303);
      assert.equal(readRedirectPath(response), "/reserve?error=validation");
      assert.equal(response.headers.get("set-cookie"), null);
      assert.equal(sentEmails.length, 0);
    }),
  ),
);

test(
  "missing required submission fields fail safely",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(TEST_DATE, "available");

      const sentEmails: SentEmail[] = [];
      mockEmailTransport(sentEmails);

      const response = await POST(createReservationRequest({ guestName: "" }));

      assert.equal(response.status, 303);
      assert.equal(readRedirectPath(response), "/reserve?error=validation");
      assert.equal(response.headers.get("set-cookie"), null);
      assert.equal(sentEmails.length, 0);
    }),
  ),
);
