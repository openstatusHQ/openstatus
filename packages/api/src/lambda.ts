import { apiKeyRouter } from "./router/apiKey";
import { blobRouter } from "./router/blob";
import { emailRouter } from "./router/email";
import { integrationRouter } from "./router/integration";
import { stripeRouter } from "./router/stripe";
import { createTRPCRouter } from "./trpc";
// Deployed to /trpc/lambda/**
export const lambdaRouter = createTRPCRouter({
  stripeRouter: stripeRouter,
  emailRouter: emailRouter,
  apiKeyRouter: apiKeyRouter,
  integrationRouter: integrationRouter,
  blob: blobRouter,
});

export { stripe } from "./router/stripe/shared";
