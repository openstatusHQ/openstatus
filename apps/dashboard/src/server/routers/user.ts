import { publicProcedure, router } from "../trpc";

export const userRouter = router({
  get: publicProcedure.query(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Retrieve users from a datasource

    return {
      id: 1,
      name: "Max Kaske",
      email: "max@openstatus.dev",
      avatar: "https://avatars.githubusercontent.com/u/56969857?v=4",
    };
  }),
});
