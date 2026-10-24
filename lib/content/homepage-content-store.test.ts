import test from "node:test";
import assert from "node:assert/strict";
import { createTestDatabase } from "../test-support/postgres-test-database";
import { defaultHomepageContent } from "./homepage-content";
import {
  readHomepageContent,
  validateHomepageContent,
  writeHomepageContent,
} from "./homepage-content-store";

test("returns default homepage content when no row exists", async () => {
  const database = await createTestDatabase();

  assert.deepEqual(await readHomepageContent(database), defaultHomepageContent);
});

test("writes and reads homepage content", async () => {
  const database = await createTestDatabase();
  const updatedContent = {
    eyebrow: "Welcome",
    headline: "Request your date.",
    supportingText: "Choose a date and we’ll follow up.",
    primaryCtaLabel: "Request now",
    primaryCtaHref: "/reserve",
    pricingTitle: "Pricing",
    pricingText: "Pricing details are shared during follow-up.",
    policyTitle: "Policy",
    policyText: "Requests are reviewed before dates are confirmed.",
    faqs: [
      {
        id: "one",
        question: "When do you follow up?",
        answer: "We follow up after review.",
      },
    ],
  };

  await writeHomepageContent(updatedContent, database);

  assert.deepEqual(await readHomepageContent(database), updatedContent);
});

test("rejects invalid CTA href values", async () => {
  const contentWithBadHref = {
    ...defaultHomepageContent,
    primaryCtaHref: "https://example.com",
  };

  assert.equal(
    validateHomepageContent(contentWithBadHref),
    "invalid_primary_cta_href",
  );
});

test("rejects empty required fields", () => {
  assert.equal(
    validateHomepageContent({
      ...defaultHomepageContent,
      headline: " ",
    }),
    "invalid_headline",
  );
});

test("rejects empty pricing and policy fields", () => {
  assert.equal(
    validateHomepageContent({
      ...defaultHomepageContent,
      pricingTitle: " ",
    }),
    "invalid_pricing_title",
  );

  assert.equal(
    validateHomepageContent({
      ...defaultHomepageContent,
      pricingText: " ",
    }),
    "invalid_pricing_text",
  );

  assert.equal(
    validateHomepageContent({
      ...defaultHomepageContent,
      policyTitle: " ",
    }),
    "invalid_policy_title",
  );

  assert.equal(
    validateHomepageContent({
      ...defaultHomepageContent,
      policyText: " ",
    }),
    "invalid_policy_text",
  );
});

test("rejects FAQ entries with empty question or answer", () => {
  assert.equal(
    validateHomepageContent({
      ...defaultHomepageContent,
      faqs: [
        {
          id: "bad",
          question: " ",
          answer: "Answer",
        },
      ],
    }),
    "invalid_faqs",
  );

  assert.equal(
    validateHomepageContent({
      ...defaultHomepageContent,
      faqs: [
        {
          id: "bad",
          question: "Question",
          answer: " ",
        },
      ],
    }),
    "invalid_faqs",
  );
});

test("rejects near-empty critical content", () => {
  assert.equal(
    validateHomepageContent({
      ...defaultHomepageContent,
      headline: "Hi",
    }),
    "invalid_headline",
  );

  assert.equal(
    validateHomepageContent({
      ...defaultHomepageContent,
      primaryCtaLabel: "Go",
    }),
    "invalid_primary_cta_label",
  );

  assert.equal(
    validateHomepageContent({
      ...defaultHomepageContent,
      pricingText: "Short",
    }),
    "invalid_pricing_text",
  );

  assert.equal(
    validateHomepageContent({
      ...defaultHomepageContent,
      policyText: "Short",
    }),
    "invalid_policy_text",
  );
});
