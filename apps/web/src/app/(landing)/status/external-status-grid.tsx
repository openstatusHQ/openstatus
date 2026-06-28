"use client";

import { useQueryState } from "nuqs";
import { useMemo } from "react";

import { Grid } from "../../../content/mdx-components/grid";
import { api } from "../../../trpc/rq-client";
import { ContentBoxLink } from "../content-box";
import { ExternalServicePill } from "./external-service-pill";
import { filterServices } from "./filter-services";
import { qParser } from "./search-params";

export function ExternalStatusGrid() {
  const [services] = api.externalService.grid.useSuspenseQuery();
  const [q] = useQueryState("q", qParser);

  const filtered = useMemo(() => filterServices(services, q), [services, q]);
  const hasQuery = q.trim() !== "";

  return (
    <>
      <p
        className="not-prose text-muted-foreground my-0! text-xs"
        role="status"
      >
        Showing {filtered.length} of {services.length} services
      </p>
      {filtered.length === 0 && hasQuery && (
        <p className="text-muted-foreground my-0! text-sm">
          No services match &ldquo;{q}&rdquo;.
        </p>
      )}
      <Grid cols={2} className="my-0!">
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
              escalated={service.escalated}
              className="self-start"
            />
          </ContentBoxLink>
        ))}
      </Grid>
    </>
  );
}
