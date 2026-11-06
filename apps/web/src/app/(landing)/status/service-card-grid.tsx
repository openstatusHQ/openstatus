import { Grid } from "../../../content/mdx-components/grid";
import { ContentBoxLink } from "../content-box";
import { ExternalServicePill } from "./external-service-pill";

export type ServiceCardItem = {
  slug: string;
  name: string;
  indicator: string;
  status: string;
  statusMessage: string;
  escalated: boolean;
};

export function ServiceCardGrid({ services }: { services: ServiceCardItem[] }) {
  return (
    <Grid cols={2} className="my-0!">
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
            escalated={service.escalated}
            className="self-start"
          />
        </ContentBoxLink>
      ))}
    </Grid>
  );
}
