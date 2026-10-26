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
  getReserveExampleSlots,
  RESERVE_EXAMPLE_DATE,
} from "../../../lib/reserve-example-availability";
import {
  readReservationRequests,
  updateReservationRequestStatus,
} from "../../lib/reservation-requests";
import { setOperatorDateAvailability } from "../../../lib/operator-availability";

type SentEmail = {
  from: string;
  replyTo: string;
  subject: string;
  text: string;
  to: string;
};

const originalCreateTransport = nodemailer.createTransport;

function createReservationRequest(overrides: Record<string, string> = {}) {
  const formData = new URLSearchParams({
    eventType: "farm_stay",
    guestEmail: "guest@example.com",
    guestName: "Guest Name",
    requestedDates: "2026-06-14 09:00 to 09:30",
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
      await setOperatorDateAvailability(RESERVE_EXAMPLE_DATE, "available");

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
          requestedDates: "2026-06-14 09:00 to 09:30",
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
        /- Requested date and time: Sunday, June 14, 2026, 09:00 to 09:30/,
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
        "2026-06-14 09:00 to 09:30",
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
      await setOperatorDateAvailability(RESERVE_EXAMPLE_DATE, "available");
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
              responseCode: 535,
              transportCode: "EAUTH",
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
      await setOperatorDateAvailability(RESERVE_EXAMPLE_DATE, "available");
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
              transportCode: "unknown",
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
        await setOperatorDateAvailability(RESERVE_EXAMPLE_DATE, "available");
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
        await setOperatorDateAvailability(RESERVE_EXAMPLE_DATE, "available");

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
  "submit validation accepts the same available options shown publicly",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(RESERVE_EXAMPLE_DATE, "available");

      const sentEmails: SentEmail[] = [];
      mockEmailTransport(sentEmails);
      const publicSlots = await getReserveExampleSlots();
      const publicOption = publicSlots.find((slot) => slot.status === "available");

      assert.ok(publicOption);

      const requestedDates = `${publicOption.date} ${publicOption.startTime} to ${publicOption.endTime}`;
      const response = await POST(createReservationRequest({ requestedDates }));

      assert.equal(response.status, 303);
      assert.equal(readRedirectPath(response), "/confirmation");
      assert.equal(sentEmails.length, 1);
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
      const publicSlots = await getReserveExampleSlots();
      const secondDateOption = publicSlots.find(
        (slot) => slot.status === "available" && slot.date === "2026-06-15",
      );

      assert.ok(secondDateOption);

      const requestedDates = `${secondDateOption.date} ${secondDateOption.startTime} to ${secondDateOption.endTime}`;
      const response = await POST(createReservationRequest({ requestedDates }));

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
      await setOperatorDateAvailability(RESERVE_EXAMPLE_DATE, "unavailable");

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
  "unavailable public options cannot be submitted",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(RESERVE_EXAMPLE_DATE, "available");

      const sentEmails: SentEmail[] = [];
      mockEmailTransport(sentEmails);

      const response = await POST(
        createReservationRequest({
          requestedDates: "2026-06-14 09:30 to 10:00",
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
  "forged reservation options fail safely",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(RESERVE_EXAMPLE_DATE, "available");

      const sentEmails: SentEmail[] = [];
      mockEmailTransport(sentEmails);

      const response = await POST(
        createReservationRequest({
          requestedDates: "2026-06-14 08:30 to 09:00",
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
  "stale options are rejected if operator availability changes before submit",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(RESERVE_EXAMPLE_DATE, "available");
      const publicSlots = await getReserveExampleSlots();
      const publicOption = publicSlots.find((slot) => slot.status === "available");

      assert.ok(publicOption);

      await setOperatorDateAvailability(RESERVE_EXAMPLE_DATE, "unavailable");

      const sentEmails: SentEmail[] = [];
      mockEmailTransport(sentEmails);
      const requestedDates = `${publicOption.date} ${publicOption.startTime} to ${publicOption.endTime}`;
      const response = await POST(createReservationRequest({ requestedDates }));

      assert.equal(response.status, 303);
      assert.equal(readRedirectPath(response), "/reserve?error=validation");
      assert.equal(response.headers.get("set-cookie"), null);
      assert.equal(sentEmails.length, 0);
      assert.deepEqual(await readReservationRequests(), []);
    }),
  ),
);

test(
  "stale options are rejected if the slot is accepted before submit",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(RESERVE_EXAMPLE_DATE, "available");
      const publicSlots = await getReserveExampleSlots();
      const publicOption = publicSlots.find((slot) => slot.status === "available");

      assert.ok(publicOption);

      const acceptedSeedResponse = await POST(
        createReservationRequest({
          guestEmail: "seed@example.com",
          requestedDates: `${publicOption.date} ${publicOption.startTime} to ${publicOption.endTime}`,
        }),
      );
      assert.equal(acceptedSeedResponse.status, 303);
      const seededRequests = await readReservationRequests();
      assert.equal(seededRequests.length, 1);
      assert.equal(
        await updateReservationRequestStatus(seededRequests[0].id, "accepted"),
        "updated",
      );

      const sentEmails: SentEmail[] = [];
      mockEmailTransport(sentEmails);
      const staleSubmitResponse = await POST(
        createReservationRequest({
          requestedDates: `${publicOption.date} ${publicOption.startTime} to ${publicOption.endTime}`,
        }),
      );

      assert.equal(staleSubmitResponse.status, 303);
      assert.equal(readRedirectPath(staleSubmitResponse), "/reserve?error=validation");
      assert.equal(staleSubmitResponse.headers.get("set-cookie"), null);
      assert.equal(sentEmails.length, 0);
      assert.equal((await readReservationRequests()).length, 1);
    }),
  ),
);

test(
  "malformed requested slot format is rejected",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(RESERVE_EXAMPLE_DATE, "available");

      const sentEmails: SentEmail[] = [];
      mockEmailTransport(sentEmails);
      const response = await POST(
        createReservationRequest({
          requestedDates: "2026-06-14 9:00 to 09:30",
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
  "legacy event type values are normalized before confirmation and email",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(RESERVE_EXAMPLE_DATE, "available");

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
          requestedDates: "2026-06-14 09:00 to 09:30",
          requestNotes: "Please call first.",
        },
      );
      assert.equal(sentEmails.length, 1);
      assert.match(sentEmails[0].text, /- Event type: Farm stay/);
      assert.match(
        sentEmails[0].text,
        /- Requested date and time: Sunday, June 14, 2026, 09:00 to 09:30/,
      );
    }),
  ),
);

test(
  "unsupported event types are rejected",
  withAvailabilityStore(
    withEnvironment(async () => {
      await setOperatorDateAvailability(RESERVE_EXAMPLE_DATE, "available");

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
      await setOperatorDateAvailability(RESERVE_EXAMPLE_DATE, "available");

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
      await setOperatorDateAvailability(RESERVE_EXAMPLE_DATE, "available");

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
