import type { Metadata } from "next";

import { ExternalServicePill } from "@/app/(landing)/status/external-service-pill";
import { components } from "@/content/mdx";
import { cachedListExternalServices } from "@/lib/external-service-cache";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/lib/metadata/shared-metadata";
import { OSTinybird, safePipeData } from "@openstatus/tinybird";

import { env } from "@/env";
import { ContentBoxLink, ContentBoxUrl } from "../content-box";

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
  },
  twitter: {
    ...twitterMetadata,
    title: TITLE,
    description: DESCRIPTION,
    images: [`/api/og?title=${TITLE}&description=${DESCRIPTION}`],
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
              <ContentBoxUrl
                url={service.url}
                className="m-0! text-muted-foreground text-sm"
              />
            </ContentBoxLink>
          );
        })}
      </components.Grid>
    </section>
  );
}
