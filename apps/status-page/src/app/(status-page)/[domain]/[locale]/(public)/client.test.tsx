import type { AppRouter } from "@openstatus/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { StatusPageProvider } from "../../../../../components/status-page/floating-button";
import { TRPCProvider } from "../../../../../lib/trpc/client";
import { navigationState } from "../../../../../test/next-navigation.mock";
import { Client } from "./client";

const slug = "acme";
const INCIDENT = "Downtime detected";

type OpenEvent = {
  id: number;
  type: "incident" | "report" | "maintenance";
  name: string;
  status: "error" | "degraded" | "info" | "success";
};

const incident = (id: number): OpenEvent => ({
  id,
  type: "incident",
  name: INCIDENT,
  status: "error",
});

// only the fields `Client` reads; the page is stored as "Monitor checks"
function page(openEvents: OpenEvent[]) {
  return {
    title: "Acme",
    description: "",
    status: openEvents.length > 0 ? "error" : "success",
    configuration: { type: "absolute", value: "requests" },
    openEvents,
    lastEvents: [],
    trackers: [],
    pageComponents: [],
    statusReports: [],
    maintenances: [],
  };
}

/** Renders `Client` with the query cache seeded the way each fetch left it. */
function render({
  barType,
  initial,
  refetched,
}: {
  barType: "absolute" | "manual";
  initial: ReturnType<typeof page>;
  refetched?: ReturnType<typeof page>;
}) {
  const cardType = barType === "manual" ? "manual" : "requests";
  const queryClient = new QueryClient();
  const trpcClient = createTRPCClient<AppRouter>({ links: [] });
  const trpc = createTRPCOptionsProxy<AppRouter>({
    client: trpcClient,
    queryClient,
  });
  // fixtures are partial pages, so the keys are widened to skip the data tag
  const seed = (key: readonly unknown[], data: unknown) =>
    queryClient.setQueryData(key, data);
  seed(trpc.statusPage.get.queryKey({ slug }), initial);
  if (refetched) {
    seed(trpc.statusPage.get.queryKey({ slug, cardType, barType }), refetched);
  }

  return renderToStaticMarkup(
    <NuqsTestingAdapter>
      <QueryClientProvider client={queryClient}>
        <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
          <StatusPageProvider
            defaultBarType={barType}
            defaultCardType={cardType}
          >
            <Client />
          </StatusPageProvider>
        </TRPCProvider>
      </QueryClientProvider>
    </NuqsTestingAdapter>,
  );
}

const count = (html: string, text: string) => html.split(text).length - 1;

describe("status page banner", () => {
  beforeEach(() => {
    navigationState.params = { domain: slug };
  });

  it("shows a single ongoing monitor incident with Monitor checks", () => {
    const html = render({
      barType: "absolute",
      initial: page([incident(1), incident(2)]),
    });
    expect(count(html, INCIDENT)).toBe(1);
  });

  it("drops the monitor incident once Reports only is refetched", () => {
    const html = render({
      barType: "manual",
      initial: page([incident(1)]),
      refetched: page([]),
    });
    expect(html).not.toContain(INCIDENT);
  });

  it("keeps the initial events while the Reports only refetch is pending", () => {
    const html = render({ barType: "manual", initial: page([incident(1)]) });
    expect(count(html, INCIDENT)).toBe(1);
  });
});
