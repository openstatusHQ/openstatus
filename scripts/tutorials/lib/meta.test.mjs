import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { validateMeta } from "./meta.mjs";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..");
const tutorials = readdirSync(dir).filter((f) => f.endsWith(".mjs"));
// Terminal casts (scripts/record-terminal.mjs) and Slack threads
// (scripts/record-slack.mjs) share the meta contract.
const castsDir = join(dir, "..", "casts");
const casts = readdirSync(castsDir).filter((f) => f.endsWith(".mjs"));
const threadsDir = join(dir, "..", "slack", "threads");
const threads = readdirSync(threadsDir).filter((f) => f.endsWith(".mjs"));
// Agent sessions (scripts/record-agent.mjs) are tutorials or product updates.
const sessionsDir = join(dir, "..", "agent", "sessions");
const sessions = readdirSync(sessionsDir).filter((f) => f.endsWith(".mjs"));

const valid = {
  order: 1,
  label: "Launch",
  title: "Title",
  subtitle: "Subtitle",
  outroTitle: "Done.",
  outroSubtitle: "Next: more.",
};

describe("validateMeta", () => {
  test("accepts a complete meta", () => {
    expect(validateMeta(valid, "t")).toEqual([]);
  });

  test("names every missing field and unknown requirement", () => {
    const problems = validateMeta(
      { ...valid, order: 0, title: " ", requires: ["database"] },
      "t",
    );
    expect(problems).toEqual([
      "t: meta.order must be a positive integer",
      "t: meta.title must be a non-empty string",
      't: unknown requirement "database"',
    ]);
  });

  test("wants the label as one word", () => {
    expect(validateMeta({ ...valid, label: "" }, "t")).toEqual([
      "t: meta.label must be a non-empty string",
    ]);
    expect(validateMeta({ ...valid, label: "Set up" }, "t")).toEqual([
      "t: meta.label must be one word",
    ]);
  });

  test("checks thumbnail copy only when set", () => {
    expect(validateMeta({ ...valid, thumbTitle: "Short." }, "t")).toEqual([]);
    expect(
      validateMeta({ ...valid, thumbEyebrow: " ", thumbSubtitle: "" }, "t"),
    ).toEqual([
      "t: meta.thumbEyebrow must be a non-empty string if set",
      "t: meta.thumbSubtitle must be a non-empty string if set",
    ]);
  });

  test("checks a viewport only when set", () => {
    const viewport = { width: 1120, height: 900 };
    expect(validateMeta({ ...valid, viewport }, "t")).toEqual([]);
    expect(validateMeta({ ...valid, viewport: { width: 1120 } }, "t")).toEqual([
      "t: meta.viewport needs a positive integer width and height",
    ]);
  });

  test("reports a requires that is not a list", () => {
    expect(validateMeta({ ...valid, requires: {} }, "t")).toEqual([
      "t: meta.requires must be an array",
    ]);
  });
});

describe("validateMeta for a product update", () => {
  const update = { format: "update", title: "SAML SSO", tagline: "Sign in." };

  test("needs only a title and a tagline", () => {
    expect(validateMeta(update, "u")).toEqual([]);
    expect(validateMeta({ format: "update", title: "SAML SSO" }, "u")).toEqual([
      "u: meta.tagline must be a non-empty string",
    ]);
  });

  test("keeps the title short enough to read in a feed", () => {
    const title = "A feature name that goes on for far too long";
    expect(validateMeta({ ...update, title }, "u")).toEqual([
      `u: meta.title is ${title.length} characters, an update's title fits in 40`,
    ]);
  });

  test("takes the link as a path, not a URL", () => {
    expect(
      validateMeta({ ...update, link: "changelog/saml-sso" }, "u"),
    ).toEqual([]);
    expect(
      validateMeta({ ...update, link: "https://openstatus.dev" }, "u"),
    ).toEqual([
      'u: meta.link is a path after openstatus.dev/, e.g. "changelog/saml-sso"',
    ]);
  });

  test("rejects any other format", () => {
    expect(validateMeta({ ...valid, format: "short" }, "t")).toEqual([
      't: meta.format can only be "update"',
    ]);
  });
});

describe("product updates", () => {
  const updatesDir = join(dir, "..", "updates");
  const updates = readdirSync(updatesDir).filter((f) => f.endsWith(".mjs"));

  test("every update exports an update meta and steps", async () => {
    for (const file of updates) {
      const update = await import(join(updatesDir, file));
      expect(update.meta.format).toBe("update");
      expect(validateMeta(update.meta, file)).toEqual([]);
      expect(update.default).toBeTypeOf("function");
    }
  });
});

describe("agent sessions", () => {
  test("every session exports a valid meta", async () => {
    for (const file of sessions) {
      const { meta } = await import(join(sessionsDir, file));
      expect(validateMeta(meta, file)).toEqual([]);
    }
  });
});

// Tutorials and casts are each a series: valid metas, one order per video.
for (const [name, from, files] of [
  ["tutorial", dir, tutorials],
  ["cast", castsDir, casts],
]) {
  describe(`${name}s`, () => {
    test(`every ${name} exports a valid meta`, async () => {
      for (const file of files) {
        const { meta } = await import(join(from, file));
        expect(validateMeta(meta, file)).toEqual([]);
      }
    });

    test("series order is unique", async () => {
      const orders = await Promise.all(
        files.map(async (f) => (await import(join(from, f))).meta.order),
      );
      expect(new Set(orders).size).toBe(orders.length);
    });
  });
}

describe("slack threads", () => {
  test("every thread exports a valid meta and a cast to play", async () => {
    for (const file of threads) {
      const thread = await import(join(threadsDir, file));
      expect(validateMeta(thread.meta, file)).toEqual([]);
      expect(thread.default).toBeTypeOf("function");
      expect(thread.model).toBeDefined();
      expect(thread.people.length).toBeGreaterThan(0);
      expect(thread.channels.length).toBeGreaterThan(0);
    }
  });

  test("a thread cut with the dashboard has its own valid copy", async () => {
    for (const file of threads) {
      const thread = await import(join(threadsDir, file));
      if (thread.dashboardMeta === undefined) continue;
      expect(validateMeta(thread.dashboardMeta, file)).toEqual([]);
      expect(thread.dashboardMeta.title).not.toBe(thread.meta.title);
    }
  });
});
