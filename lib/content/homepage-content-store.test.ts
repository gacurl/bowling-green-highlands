import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { defaultHomepageContent } from "./homepage-content";
import {
  readHomepageContent,
  validateHomepageContent,
  writeHomepageContent,
} from "./homepage-content-store";

async function createStorePath() {
  const directory = await mkdtemp(path.join(tmpdir(), "bgh-homepage-content-"));

  return path.join(directory, "homepage-content.json");
}

test("returns default homepage content when store file does not exist", async () => {
  const storePath = await createStorePath();

  assert.deepEqual(await readHomepageContent(storePath), defaultHomepageContent);
});

test("writes and reads homepage content", async () => {
  const storePath = await createStorePath();
  const updatedContent = {
    eyebrow: "Welcome",
    headline: "Request your date.",
    supportingText: "Choose a date and we’ll follow up.",
    primaryCtaLabel: "Request now",
    primaryCtaHref: "/reserve",
  };

  await writeHomepageContent(updatedContent, storePath);

  assert.deepEqual(await readHomepageContent(storePath), updatedContent);
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
