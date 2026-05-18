import type { Metadata } from "next";

import { ExternalServicePill } from "@/app/(landing)/status/external-service-pill";
import { components } from "@/content/mdx";
import { cachedListExternalServices } from "@/lib/external-service-cache";
import {
  BASE_URL,
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/lib/metadata/shared-metadata";
import { OSTinybird, safePipeData } from "@openstatus/tinybird";

import { ButtonLink } from "@/content/mdx-components/button-link";
import { CustomLink } from "@/content/mdx-components/custom-link";
import { env } from "@/env";
import {
  ContentBoxContainer,
  ContentBoxDescription,
  ContentBoxLink,
  ContentBoxTitle,
} from "../content-box";

export const dynamic = "force-dynamic";

const TITLE = "External Status";
const DESCRIPTION =
  "Easily check if your external providers is working properly";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/status",
  },
  openGraph: {
    ...ogMetadata,
    title: TITLE,
    description: DESCRIPTION,
    images: [`${BASE_URL}/api/og/external-service`],
  },
  twitter: {
    ...twitterMetadata,
    title: TITLE,
    description: DESCRIPTION,
    images: [`${BASE_URL}/api/og/external-service`],
  },
};

type LatestSnapshot = {
  id: string;
  indicator: string;
  status: string;
  status_message: string;
  last_fetched_at: number;
};

const UNKNOWN_SNAPSHOT: Omit<LatestSnapshot, "id"> = {
  indicator: "",
  status: "",
  status_message: "Status unavailable",
  last_fetched_at: 0,
};

export default async function Page() {
  const services = await cachedListExternalServices();
  const tb = new OSTinybird(env.TINY_BIRD_API_KEY);
  const latestRes = await safePipeData(
    tb.externalStatusLatest({}),
    "externalStatusLatest (list)",
  );
  const latestRows = Array.isArray(latestRes.data) ? latestRes.data : [];
  const latestById = new Map<string, LatestSnapshot>();
  for (const row of latestRows) {
    latestById.set(row.id, row);
  }

  return (
    <section className="prose dark:prose-invert mb-12 max-w-none">
      <ContentBoxContainer className="not-prose my-6 px-4 py-2 text-sm">
        <CustomLink
          href="https://app.openstatus.dev?ref=status-index-top"
          className="font-medium underline-offset-4 hover:underline"
        >
          Track your own service's uptime — get a free status page with
          OpenStatus →
        </CustomLink>
      </ContentBoxContainer>
      <h1>External Status</h1>
      <components.Grid cols={2}>
        {services.map((service) => {
          const snap = latestById.get(service.slug) ?? UNKNOWN_SNAPSHOT;
          return (
            <ContentBoxLink
              key={service.slug}
              href={`/status/${service.slug}`}
              className="flex flex-col gap-2"
            >
              <p className="m-0! font-semibold">{service.name}</p>
              <ExternalServicePill
                indicator={snap.indicator}
                status={snap.status}
                statusMessage={snap.status_message || undefined}
                className="self-start"
              />
            </ContentBoxLink>
          );
        })}
      </components.Grid>
      <ContentBoxContainer className="not-prose mt-10 flex flex-col items-start gap-3 bg-muted/30">
        <ContentBoxTitle className="text-lg">
          Build your own status page
        </ContentBoxTitle>
        <ContentBoxDescription className="text-sm">
          Global uptime monitoring, instant alerts, and a public status page —
          free to start.
        </ContentBoxDescription>
        <ButtonLink href="https://app.openstatus.dev?ref=status-index-bottom">
          Get started free
        </ButtonLink>
      </ContentBoxContainer>
    </section>
  );
}
