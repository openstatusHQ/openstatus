import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: [
    "/",
    "/api/og",
    "/api/webhook/ping",
    "/api/v0/cron",
    "/api/v0/ping",
    "/api/webhook/clerk",
  ],
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
