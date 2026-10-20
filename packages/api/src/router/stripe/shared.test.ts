import type Stripe from "stripe";
import { describe, expect, test } from "vitest";

import { syncCustomerEmailToNewOwner } from "./shared";

function fakeClient(customer: { email?: string | null; deleted?: true }) {
  const updates: Array<{ id: string; params: Stripe.CustomerUpdateParams }> =
    [];
  return {
    updates,
    client: {
      customers: {
        retrieve: async (_id: string) =>
          customer as Stripe.Customer | Stripe.DeletedCustomer,
        update: async (id: string, params: Stripe.CustomerUpdateParams) => {
          updates.push({ id, params });
          return customer as Stripe.Customer;
        },
      },
    },
  };
}

describe("syncCustomerEmailToNewOwner", () => {
  test("moves the email when it still equals the former owner's (case-insensitive)", async () => {
    const { client, updates } = fakeClient({ email: "Max@Acme.dev" });
    const updated = await syncCustomerEmailToNewOwner({
      customerId: "cus_1",
      formerOwnerEmail: "max@acme.dev",
      newOwnerEmail: "web@acme.dev",
      client,
    });
    expect(updated).toBe(true);
    expect(updates).toEqual([
      { id: "cus_1", params: { email: "web@acme.dev" } },
    ]);
  });

  test("keeps a different address, e.g. a finance inbox", async () => {
    const { client, updates } = fakeClient({ email: "finance@acme.dev" });
    const updated = await syncCustomerEmailToNewOwner({
      customerId: "cus_1",
      formerOwnerEmail: "max@acme.dev",
      newOwnerEmail: "web@acme.dev",
      client,
    });
    expect(updated).toBe(false);
    expect(updates).toHaveLength(0);
  });

  test("leaves a customer without email or a deleted customer alone", async () => {
    for (const customer of [{ email: null }, { deleted: true as const }]) {
      const { client, updates } = fakeClient(customer);
      const updated = await syncCustomerEmailToNewOwner({
        customerId: "cus_1",
        formerOwnerEmail: "max@acme.dev",
        newOwnerEmail: "web@acme.dev",
        client,
      });
      expect(updated).toBe(false);
      expect(updates).toHaveLength(0);
    }
  });
});
