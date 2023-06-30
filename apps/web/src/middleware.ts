import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: [
    "/",
    "/play",
    "/api/(.*)",
    "/api/og",
    "/api/ping",
    "/api/v0/cron",
    "/api/v0/ping",
    "/api/webhook/clerk",
    "/api/checker/regions/(.*)",
    "/api/checker/cron/10m",
  ],
});

export const config = {
  matcher: ["/((?!api|trpc|_next/static|_next/image|favicon.ico).*)"],
};
