"use client";

import { useQueryState } from "nuqs";
import { useMemo } from "react";

import { Grid } from "@/content/mdx-components/grid";
import { api } from "@/trpc/rq-client";

import { ContentBoxLink } from "../content-box";
import { ExternalServicePill } from "./external-service-pill";
import { filterServices } from "./filter-services";
import { qParser } from "./search-params";

export function ExternalStatusGrid() {
  const [services] = api.externalService.grid.useSuspenseQuery();
  const [q] = useQueryState("q", qParser);

  const filtered = useMemo(() => filterServices(services, q), [services, q]);
  const hasQuery = q.trim() !== "";

  if (filtered.length === 0 && hasQuery) {
    return (
      <div className="not-prose flex flex-col gap-2">
        <p className="text-muted-foreground text-xs" role="status">
          Showing 0 of {services.length} services
        </p>
        <p className="text-muted-foreground text-sm">
          No services match &ldquo;{q}&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <>
      {hasQuery && (
        <p
          className="not-prose mb-2 text-muted-foreground text-xs"
          role="status"
        >
          Showing {filtered.length} of {services.length} services
        </p>
      )}
      <Grid cols={2}>
        {filtered.map((service) => (
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
    </>
  );
}
