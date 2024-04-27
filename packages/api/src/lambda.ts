import { clerkRouter } from "./router/clerk/webhook";
import { rumRouter } from "./router/rum";
import { stripeRouter } from "./router/stripe";
import { createTRPCRouter } from "./trpc";

// Deployed to /trpc/lambda/**
export const lambdaRouter = createTRPCRouter({
  clerkRouter: clerkRouter,
  stripeRouter: stripeRouter,
  rumRouter: rumRouter,
});

export { stripe } from "./router/stripe/shared";
