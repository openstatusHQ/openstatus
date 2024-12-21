import { stripeRouter } from "./router/stripe";
import { createTRPCRouter } from "./trpc";

// Deployed to /trpc/lambda/**
export const lambdaRouter = createTRPCRouter({
  stripeRouter: stripeRouter,
});

export { stripe } from "./router/stripe/shared";
