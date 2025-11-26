import { components } from "@/content/mdx";
import {
  ContentBoxDescription,
  ContentBoxLink,
  ContentBoxTitle,
  ContentBoxUrl,
} from "../content-box";
import { env } from "@/env";
import {
  type AtlassianDescriptionEnum,
  externalStatusArray,
} from "@/app/(pages)/status/utils";

export default async function Page() {
  const res = await fetch(env.EXTERNAL_API_URL);
  const data = await res.json();
  const externalStatus = externalStatusArray.parse(data);
  return (
    <section className="prose dark:prose-invert max-w-none">
      <h1>External Status</h1>
      <components.Grid cols={2}>
        {externalStatus.map((status) => (
          <ContentBoxLink
            key={status.name}
            href={status.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ContentBoxTitle>{status.name}</ContentBoxTitle>
            <ContentBoxDescription
              className={STATUS[status.status_description]}
            >
              {status.status_description}
            </ContentBoxDescription>
            <ContentBoxUrl url={status.url} />
          </ContentBoxLink>
        ))}
      </components.Grid>
    </section>
  );
}

const STATUS = {
  "All Systems Operational": "text-success",
  "Major System Outage": "text-destructive",
  "Partial System Outage": "text-warning",
  "Minor Service Outage": "text-warning",
  "Degraded System Service": "text-warning",
  "Partially Degraded Service": "text-warning",
  "Service Under Maintenance": "text-info",
} satisfies Record<AtlassianDescriptionEnum, string>;
