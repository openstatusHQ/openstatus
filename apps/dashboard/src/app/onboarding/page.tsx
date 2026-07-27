import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SearchParams } from "nuqs";

import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";

import { Client } from "./client";
import { searchParamsCache } from "./search-params";

function tryRedirectToCallback(callbackUrl: string | null): void {
  if (!callbackUrl) return;
  let safePath: string | null = null;
  try {
    const target = new URL(callbackUrl, "http://_");
    const safe =
      (target.protocol === "http:" || target.protocol === "https:") &&
      target.pathname.startsWith("/") &&
      !target.pathname.startsWith("//") &&
      target.pathname !== "/" &&
      target.pathname !== "/login";
    if (safe) {
      safePath = `${target.pathname}${target.search}${target.hash}`;
    }
  } catch {
    // malformed — fall through
  }
  // redirect() throws NEXT_REDIRECT; must be outside the try/catch above.
  if (safePath) {
    redirect(safePath);
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParamsCache.parse(searchParams);

  // Same-origin-only redirect: strip host, reject non-HTTP and `//…`
  // (protocol-relative). `/` and `/login` are app-specific UX skips.
  // First check query params, then fallback to cookie set by middleware.
  tryRedirectToCallback(params.callbackUrl);

  // Fallback: check auth-redirect cookie for invite flows where Auth.js
  // didn't pass the callbackUrl properly. The cookie has a 10-minute TTL
  // and will expire naturally.
  const cookieStore = await cookies();
  const authRedirect = cookieStore.get("auth-redirect")?.value;
  if (authRedirect) {
    tryRedirectToCallback(authRedirect);
  }

  const queryClient = getQueryClient();
  const [monitors, pages] = await Promise.all([
    queryClient.fetchQuery(trpc.monitor.list.queryOptions()),
    queryClient.fetchQuery(trpc.page.list.queryOptions()),
    queryClient.fetchQuery(trpc.apiKey.list.queryOptions()),
  ]);

  const updates: {
    step?: "1" | "2" | "3";
    monitor?: "completed";
    page?: "completed";
  } = {};

  let monitorDone = params.monitor !== null;
  let pageDone = params.page !== null;
  if (!monitorDone && monitors.length > 0) {
    updates.monitor = "completed";
    monitorDone = true;
  }
  if (!pageDone && pages.length > 0) {
    updates.page = "completed";
    pageDone = true;
  }

  if (params.step === "1" && monitorDone && pageDone) updates.step = "3";
  else if (params.step === "1" && monitorDone) updates.step = "2";
  else if (params.step === "2" && pageDone) updates.step = "3";

  if (Object.keys(updates).length > 0) {
    const next = new URLSearchParams();
    next.set("step", updates.step ?? params.step);
    const monitor = updates.monitor ?? params.monitor;
    if (monitor) next.set("monitor", monitor);
    const page = updates.page ?? params.page;
    if (page) next.set("page", page);
    if (params.callbackUrl) next.set("callbackUrl", params.callbackUrl);
    redirect(`/onboarding?${next.toString()}`);
  }

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
