import { rumRouter } from "./router/rum";
import { stripeRouter } from "./router/stripe";
import { createTRPCRouter } from "./trpc";

// Deployed to /trpc/lambda/**
export const lambdaRouter = createTRPCRouter({
  stripeRouter: stripeRouter,
  rumRouter: rumRouter,
});

export { stripe } from "./router/stripe/shared";
