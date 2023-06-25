import { edgeRouter } from "./edge";
import { lambdaRouter } from "./lambda";
import { mergeRouters } from "./trpc";

const appRouter = mergeRouters(edgeRouter, lambdaRouter);
export type AppRouter = typeof appRouter;
