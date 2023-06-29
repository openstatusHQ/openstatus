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
  ],
});

export const config = {
  matcher: [
    "/((?!static|.*\\..*|_next|favicon.ico).*)",
    "/",
    "/(.*?trpc.*?|.*?api.*?)(.*)",
  ],
};
