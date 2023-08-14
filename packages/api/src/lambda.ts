import { clerkRouter } from "./router/clerk/webhook";
import { stripeRouter } from "./router/stripe";
import { createTRPCRouter } from "./trpc";

// Deployed to /trpc/lambda/**
export const lambdaRouter = createTRPCRouter({
  clerkRouter: clerkRouter,
  stripeRouter: stripeRouter,
  // TODO: Add open api router
  // See trpc-openapi
});

export { stripe } from "./router/stripe/shared";
