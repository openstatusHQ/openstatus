"use client";

import { api } from "@/trpc/rq-client";

import { ExternalServiceComponents } from "../external-service-components";

export function ServiceComponents({
  slug,
  serviceName,
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
    <>
      <h2>{serviceName} components</h2>
      <div className="not-prose">
        <ExternalServiceComponents
          components={data.components}
          days={days}
          hrefBase={`/status/${slug}`}
        />
      </div>
    </>
  );
}
