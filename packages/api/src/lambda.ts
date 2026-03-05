import { apiKeyRouter } from "./router/apiKey";
import { emailRouter } from "./router/email";
import { importRouter } from "./router/import";
import { integrationRouter } from "./router/integration";
import { stripeRouter } from "./router/stripe";
import { createTRPCRouter } from "./trpc";
// Deployed to /trpc/lambda/**
export const lambdaRouter = createTRPCRouter({
  stripeRouter: stripeRouter,
  emailRouter: emailRouter,
  apiKeyRouter: apiKeyRouter,
  integrationRouter: integrationRouter,
  importRouter: importRouter,
});

export { stripe } from "./router/stripe/shared";
