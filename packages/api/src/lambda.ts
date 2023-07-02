import { clerkRouter } from "./router/clerk/webhook";
import { createTRPCRouter } from "./trpc";

// Deployed to /trpc/lambda/**
export const lambdaRouter = createTRPCRouter({
  clerkRouter: clerkRouter,
  // TODO: Add open api router
  // See trpc-openapi
});
