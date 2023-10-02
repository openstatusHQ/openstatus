import Stripe from "stripe";

import { env } from "../../env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2023-08-16",
  appInfo: {
    name: "OpenStatus",
    version: "0.1.0",
  },
});

export async function cancelSubscription(customer?: string) {
  if (!customer) return;

  try {
    const subscriptionId = await stripe.subscriptions
      .list({
        customer,
      })
      .then((res) => res.data[0]?.id);

    if (!subscriptionId) return;

    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
      cancellation_details: {
        comment: "Customer deleted their OpenStatus project.",
      },
    });
  } catch (error) {
    console.log("Error cancelling Stripe subscription", error);
    return;
  }
}
