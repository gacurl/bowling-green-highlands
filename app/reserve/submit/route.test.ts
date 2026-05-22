import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { POST } from "./route";
import {
  CONFIRMATION_COOKIE_NAME,
  readConfirmationStateCookieValue,
} from "../../lib/confirmation-state";
import {
  getReserveExampleSlots,
  RESERVE_EXAMPLE_DATE,
} from "../../../lib/reserve-example-availability";
import { readReservationRequests } from "../../lib/reservation-requests";
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

function withEnvironment(runTest: () => Promise<void> | void) {
  return async () => {
    const previousContactEmail = process.env.CONTACT_EMAIL;
    const previousEmailFrom = process.env.EMAIL_FROM;
    const previousSmtpUrl = process.env.SMTP_URL;

    process.env.CONTACT_EMAIL = "operator@example.com";
    process.env.EMAIL_FROM = "reservations@example.com";
    process.env.SMTP_URL = "smtp://test-signing-secret";

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

function withAvailabilityStore(runTest: () => Promise<void> | void) {
  return async () => {
    const previousStorePath = process.env.BGH_AVAILABILITY_STORE_PATH;
    const previousRequestStorePath =
      process.env.BGH_RESERVATION_REQUESTS_STORE_PATH;
    const directory = await mkdtemp(path.join(tmpdir(), "bgh-submit-route-"));
    const testStorePath = path.join(
      directory,
      "operator-availability-submit-route-test.json",
    );
    const requestStorePath = path.join(
      directory,
      "reservation-requests-submit-route-test.json",
    );

    process.env.BGH_AVAILABILITY_STORE_PATH = testStorePath;
    process.env.BGH_RESERVATION_REQUESTS_STORE_PATH = requestStorePath;

    try {
      await runTest();
    } finally {
      if (previousStorePath === undefined) {
        delete process.env.BGH_AVAILABILITY_STORE_PATH;
      } else {
        process.env.BGH_AVAILABILITY_STORE_PATH = previousStorePath;
      }

      if (previousRequestStorePath === undefined) {
        delete process.env.BGH_RESERVATION_REQUESTS_STORE_PATH;
      } else {
        process.env.BGH_RESERVATION_REQUESTS_STORE_PATH = previousRequestStorePath;
      }
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

function mockFailingEmailTransport() {
  nodemailer.createTransport = ((() => ({
    sendMail: async () => {
      throw new Error("SMTP unavailable");
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
        readConfirmationStateCookieValue(cookieValue, process.env.SMTP_URL),
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
      mockFailingEmailTransport();

      const response = await POST(createReservationRequest());

      assert.equal(response.status, 303);
      assert.equal(readRedirectPath(response), "/reserve?error=delivery");
      assert.equal(response.headers.get("set-cookie"), null);

      const reservationRequests = await readReservationRequests();

      assert.equal(reservationRequests.length, 1);
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
        readConfirmationStateCookieValue(cookieValue, process.env.SMTP_URL),
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
