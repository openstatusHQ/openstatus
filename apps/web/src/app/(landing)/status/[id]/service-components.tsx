"use client";

import { api } from "../../../../trpc/rq-client";
import { ExternalServiceComponents } from "../external-service-components";
import { StatusSection } from "../service-blocks";

export function ServiceComponents({
  slug,
  days,
}: {
  slug: string;
  serviceName: string;
  days: number;
}) {
  const [data] = api.externalService.components.useSuspenseQuery({
    slug,
    days,
  });

  if (!data.supported || data.components.length === 0) return null;

  return (
    <StatusSection
      id="components"
      title="Components"
      count={String(data.components.length)}
      aside="Issues first"
    >
      <ExternalServiceComponents
        components={data.components}
        days={days}
        hrefBase={`/status/${slug}`}
      />
    </StatusSection>
  );
}
