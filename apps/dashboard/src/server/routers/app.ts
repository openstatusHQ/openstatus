import { userRouter } from "./user";
import { router } from "../trpc";

export const appRouter = router({
  user: userRouter,
});

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;
