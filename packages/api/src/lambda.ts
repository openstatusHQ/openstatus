import { clerkRouter } from "./router/clerk";
import { createTRPCRouter } from "./trpc";

// Deployed to /trpc/lambda/**
export const lambdaRouter = createTRPCRouter({
  clerkRouter: clerkRouter,
});
