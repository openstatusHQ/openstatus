import { emailRouter } from "./router/email";
import { stripeRouter } from "./router/stripe";
import { createTRPCRouter } from "./trpc";
// Deployed to /trpc/lambda/**
export const lambdaRouter = createTRPCRouter({
  stripeRouter: stripeRouter,
  emailRouter: emailRouter,
});

export { stripe } from "./router/stripe/shared";
