import { edgeRouter } from "./edge";
import { lambdaRouter } from "./lambda";
import { mergeRouters } from "./trpc";

export const appRouter = mergeRouters(edgeRouter, lambdaRouter);
export type AppRouter = typeof appRouter;
