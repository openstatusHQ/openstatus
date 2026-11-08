import { describe, expect, test } from "vitest";

import { stateAt, type SlackData, type SlackEvent } from "./slack-data";

const at = (t: number, e: Record<string, unknown>) =>
  ({ t, clock: "10:00", ...e }) as SlackEvent;

const data: SlackData = {
  team: { id: "T", name: "Acme", domain: "acme" },
  viewer: "U_MAX",
  bot: { id: "U_BOT", name: "openstatus" },
  people: [{ id: "U_MAX", name: "max", realName: "Maximilian Kaske" }],
  channels: [{ id: "C_ENG", name: "engineering" }],
  events: [
    at(0, {
      op: "post",
      channel: "C_ENG",
      user: "U_MAX",
      text: "Declaring.",
      ts: "1.1",
    }),
    at(1, {
      op: "post",
      channel: "C_ENG",
      user: "U_BOT",
      text: "card",
      ts: "2.1",
    }),
    at(2, { op: "update", channel: "C_ENG", ts: "2.1", text: "declared" }),
    at(3, {
      op: "post",
      channel: "C_ENG",
      user: "U_BOT",
      text: "reply",
      ts: "3.1",
      thread_ts: "2.1",
    }),
    at(4, { op: "channel", channel: "C_INC1", name: "inc-checkout" }),
    at(5, { op: "open", channel: "C_INC1" }),
    at(6, {
      op: "post",
      channel: "C_INC1",
      user: "U_BOT",
      text: "header",
      ts: "4.1",
    }),
    at(7, { op: "pin", channel: "C_INC1", ts: "4.1" }),
    at(8, {
      op: "react",
      channel: "C_INC1",
      ts: "4.1",
      name: "pushpin",
      user: "U_MAX",
    }),
    at(9, {
      op: "modal",
      view: { title: { type: "plain_text", text: "Update incident" } },
    }),
    at(10, { op: "field", block_id: "status", value: "Mitigated" }),
    at(11, { op: "modal_close" }),
    at(12, { op: "archive", channel: "C_INC1" }),
  ],
};

describe("stateAt", () => {
  test("shows only what happened by t", () => {
    expect(stateAt(data, 0.5).messages.C_ENG).toHaveLength(1);
    expect(stateAt(data, 1.5).messages.C_ENG).toHaveLength(2);
  });

  test("applies updates in place", () => {
    const [, card] = stateAt(data, 2).messages.C_ENG;
    expect(card.text).toBe("declared");
  });

  test("keeps thread replies out of the channel", () => {
    expect(stateAt(data, 3).messages.C_ENG.map((m) => m.text)).toEqual([
      "Declaring.",
      "declared",
    ]);
  });

  test("adds the app's channels and follows the viewer into them", () => {
    const s = stateAt(data, 5);
    expect(s.channel).toBe("C_INC1");
    expect(s.channels.map((c) => c.name)).toContain("inc-checkout");
  });

  test("pins and reacts on the right message", () => {
    const [header] = stateAt(data, 8).messages.C_INC1;
    expect(header.pinned).toBe(true);
    expect(header.reactions).toEqual([{ name: "pushpin", users: ["U_MAX"] }]);
  });

  test("opens, fills and closes the modal", () => {
    expect(stateAt(data, 10).modal?.fields).toEqual({ status: "Mitigated" });
    expect(stateAt(data, 11).modal).toBeNull();
  });

  test("marks archived channels", () => {
    const inc = stateAt(data, 12).channels.find((c) => c.id === "C_INC1");
    expect(inc?.archived).toBe(true);
  });
});
