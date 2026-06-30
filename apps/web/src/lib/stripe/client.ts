import type { Stripe as StripeProps } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js";

import { env } from "@/env";

let stripePromise: Promise<StripeProps | null>;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  }

  return stripePromise;
};
