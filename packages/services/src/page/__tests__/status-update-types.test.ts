import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

import { getStatusUpdateTypes } from "../status-update-types";

test("public pages include Email when subscriptions are enabled", () => {
  expect(
    getStatusUpdateTypes({
      accessType: "public",
      emailSubscriptionsEnabled: true,
    }),
  ).toEqual(["email", "slack", "rss", "json"]);
});

test("public pages omit Email when subscriptions are disabled", () => {
  expect(
    getStatusUpdateTypes({
      accessType: "public",
      emailSubscriptionsEnabled: false,
    }),
  ).toEqual(["slack", "rss", "json"]);
});

test("email-domain pages only include Email when subscriptions are enabled", () => {
  expect(
    getStatusUpdateTypes({
      accessType: "email-domain",
      emailSubscriptionsEnabled: true,
    }),
  ).toEqual(["email"]);
});

test("email-domain pages have no subscription options when disabled", () => {
  expect(
    getStatusUpdateTypes({
      accessType: "email-domain",
      emailSubscriptionsEnabled: false,
    }),
  ).toEqual([]);
});
