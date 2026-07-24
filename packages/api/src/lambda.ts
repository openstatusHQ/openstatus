import { apiKeyRouter } from "./router/apiKey";
import { blobRouter } from "./router/blob";
import { emailRouter } from "./router/email";
import { integrationRouter } from "./router/integration";
import { stripeRouter } from "./router/stripe";
import { subscriberNotificationRouter } from "./router/subscriber-notification";
import { createTRPCRouter } from "./trpc";
// Deployed to /trpc/lambda/**
export const lambdaRouter = createTRPCRouter({
  stripeRouter: stripeRouter,
  emailRouter: emailRouter,
  apiKey: apiKeyRouter,
  integrationRouter: integrationRouter,
  blob: blobRouter,
  subscriberNotification: subscriberNotificationRouter,
});

export { stripe } from "./router/stripe/shared";
