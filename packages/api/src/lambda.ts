import { clerkRouter } from "./router/clerk/webhook";
import { createTRPCRouter } from "./trpc";

// Deployed to /trpc/lambda/**
export const lambdaRouter = createTRPCRouter({
  clerkRouter: clerkRouter,
});
