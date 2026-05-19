import { getQueryClient, trpc } from "@/lib/trpc/server";
import { redirect } from "next/navigation";
import type { SearchParams } from "nuqs";
import { Client } from "./client";
import { searchParamsCache } from "./search-params";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParamsCache.parse(searchParams);

  // Same-origin-only redirect: strip host, reject non-HTTP and `//…`
  // (protocol-relative). `/` and `/login` are app-specific UX skips.
  if (params.callbackUrl) {
    try {
      const target = new URL(params.callbackUrl, "http://_");
      const safe =
        (target.protocol === "http:" || target.protocol === "https:") &&
        target.pathname.startsWith("/") &&
        !target.pathname.startsWith("//") &&
        target.pathname !== "/" &&
        target.pathname !== "/login";
      if (safe) {
        redirect(`${target.pathname}${target.search}${target.hash}`);
      }
    } catch {
      // malformed — fall through
    }
  }

  const queryClient = getQueryClient();
  const [monitors, pages] = await Promise.all([
    queryClient.fetchQuery(trpc.monitor.list.queryOptions()),
    queryClient.fetchQuery(trpc.page.list.queryOptions()),
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

  return <Client />;
}
