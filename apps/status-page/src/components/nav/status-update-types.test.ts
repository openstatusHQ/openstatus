import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

import { getStatusUpdateTypes } from "./status-update-types";

test("free workspace with email subscriptions enabled shows Email", () => {
  expect(
    getStatusUpdateTypes({
      accessType: "public",
      emailSubscriptionsEnabled: true,
    }),
  ).toEqual(["email", "slack", "rss", "json"]);
});

test("disabled email subscriptions are hidden even on a paid plan", () => {
  expect(
    getStatusUpdateTypes({
      accessType: "public",
      emailSubscriptionsEnabled: false,
    }),
  ).toEqual(["slack", "rss", "json"]);
});

test("email-domain pages show only Email when subscriptions are enabled", () => {
  expect(
    getStatusUpdateTypes({
      accessType: "email-domain",
      emailSubscriptionsEnabled: true,
    }),
  ).toEqual(["email"]);
});

test("email-domain pages hide subscriptions when disabled", () => {
  expect(
    getStatusUpdateTypes({
      accessType: "email-domain",
      emailSubscriptionsEnabled: false,
    }),
  ).toEqual([]);
});
