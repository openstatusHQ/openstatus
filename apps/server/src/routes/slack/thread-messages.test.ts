import { describe, expect, test } from "@openstatus/test-utils";

import {
  convertThreadToMessages,
  formatSlackLine,
  formatSlackTime,
} from "./thread-messages";

describe("formatSlackTime", () => {
  test("renders a Slack ts as minutes in UTC", () => {
    expect(formatSlackTime("1792139400.000200")).toBe("2026-10-16 08:30 UTC");
  });

  test("has nothing for a missing or malformed ts", () => {
    expect(formatSlackTime(undefined)).toBeUndefined();
    expect(formatSlackTime("not-a-ts")).toBeUndefined();
  });
});

describe("convertThreadToMessages", () => {
  test("prefixes people with time and author across days, not the bot", () => {
    const messages = convertThreadToMessages(
      [
        { user: "U1", text: "500s since the deploy", ts: "1792098600.000100" },
        { user: "UBOT", text: "Drafted a report.", ts: "1792139100.000100" },
        { user: "U2", text: "<@UBOT> thanks", ts: "1792139400.000200" },
      ],
      "UBOT",
    );
    expect(messages).toEqual([
      {
        role: "user",
        content: "[2026-10-15 21:10 UTC] <@U1>: 500s since the deploy",
      },
      { role: "assistant", content: "Drafted a report." },
      {
        role: "user",
        content: "[2026-10-16 08:30 UTC] <@U2>: <@UBOT> thanks",
      },
    ]);
  });

  test("drops leading bot messages and empty ones", () => {
    const messages = convertThreadToMessages(
      [
        { bot_id: "B1", text: "Welcome", ts: "1.0" },
        { user: "U1", ts: "2.0" },
        { user: "U1", text: "hi", ts: "3.0" },
      ],
      "UBOT",
    );
    expect(messages).toEqual([
      { role: "user", content: "[1970-01-01 00:00 UTC] <@U1>: hi" },
    ]);
  });

  test("keeps the text when the ts is missing", () => {
    expect(formatSlackLine({ user: "U1", text: "hi" })).toBe("<@U1>: hi");
  });
});
