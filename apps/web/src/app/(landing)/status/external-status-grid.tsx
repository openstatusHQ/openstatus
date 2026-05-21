"use client";

import { Grid } from "@/content/mdx-components/grid";
import { api } from "@/trpc/rq-client";

import { ContentBoxLink } from "../content-box";
import { ExternalServicePill } from "./external-service-pill";

export function ExternalStatusGrid() {
  const [services] = api.externalService.grid.useSuspenseQuery();

  return (
    <Grid cols={2}>
      {services.map((service) => (
        <ContentBoxLink
          key={service.slug}
          href={`/status/${service.slug}`}
          className="flex flex-col gap-2"
        >
          <p className="m-0! font-semibold">{service.name}</p>
          <ExternalServicePill
            indicator={service.indicator}
            status={service.status}
            statusMessage={service.statusMessage || undefined}
            className="self-start"
          />
        </ContentBoxLink>
      ))}
    </Grid>
  );
}
