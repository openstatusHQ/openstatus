import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: [
    "/",
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
  matcher: [
    "/((?!static|.*\\..*|_next|favicon.ico).*)",
    "/((?!api|trpc|_next/static|_next/image|favicon.ico).*)",
  ],
};
