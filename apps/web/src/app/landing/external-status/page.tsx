import { components } from "@/content/mdx";
import {
  ContentBoxDescription,
  ContentBoxLink,
  ContentBoxTitle,
  ContentBoxUrl,
} from "../content-box";

export default function Page() {
  return (
    <section className="prose dark:prose-invert max-w-none">
      <h1>External Status</h1>
      <components.Grid cols={2}>
        {EXTERNAL_STATUS.map((status) => (
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

const STATUS: Record<string, string> = {
  "All Systems Operational": "text-success",
  "Major System Outage": "text-destructive",
  "Partial System Outage": "text-warning",
  "Minor Service Outage": "text-warning",
  "Degraded System Service": "text-warning",
  "Partially Degraded Service": "text-warning",
  "Service Under Maintenance": "text-info",
};

const EXTERNAL_STATUS = [
  {
    id: 1,
    name: "GitHub",
    url: "https://www.githubstatus.com/",
    external_id: "kctbh9vrtdwd",
    last_updated_at: "2025-11-09T13:00:57.445Z",
    time_zone: "Etc/UTC",
    status_indicator: "none",
    status_description: "All Systems Operational",
    created_at: "2023-11-17 14:55:19",
    updated_at: "2025-11-09T15:40:49.374Z",
  },
  {
    id: 2,
    name: "Notion",
    url: "https://status.notion.so/",
    external_id: "kgl53swp0yg1",
    last_updated_at: "2025-06-04T12:02:27.721-07:00",
    time_zone: "America/Los_Angeles",
    status_indicator: "minor",
    status_description: "Partially Degraded Service",
    created_at: "2023-11-17 16:55:36",
    updated_at: "2025-06-04T19:11:47.323Z",
  },
  {
    id: 3,
    name: "Cloudflare",
    url: "https://www.cloudflarestatus.com/",
    external_id: "yh6f0r4529hb",
    last_updated_at: "2025-11-04T11:52:07.683Z",
    time_zone: "Etc/UTC",
    status_indicator: "minor",
    status_description: "Minor Service Outage",
    created_at: "2023-11-17 16:59:09",
    updated_at: "2025-11-04T11:55:54.277Z",
  },
  {
    id: 4,
    name: "Airtable",
    url: "https://status.airtable.com/",
    external_id: "5vv477bkm0kl",
    last_updated_at: "2025-11-04T12:01:00.808Z",
    time_zone: "Etc/UTC",
    status_indicator: "none",
    status_description: "All Systems Operational",
    created_at: "2023-11-17 16:59:27",
    updated_at: "2025-11-04T12:08:48.633Z",
  },
  {
    id: 5,
    name: "Fly.io",
    url: "https://status.flyio.net/",
    external_id: "65rccr4mbblw",
    last_updated_at: "2025-11-04T12:01:16.775Z",
    time_zone: "America/Chicago",
    status_indicator: "none",
    status_description: "All Systems Operational",
    created_at: "2023-11-17 17:00:27",
    updated_at: "2025-11-04T12:08:49.147Z",
  },
  {
    id: 6,
    name: "Discord",
    url: "https://discordstatus.com/",
    external_id: "srhpyqt94yxb",
    last_updated_at: "2025-11-04T04:01:22.661-08:00",
    time_zone: "America/Los_Angeles",
    status_indicator: "none",
    status_description: "All Systems Operational",
    created_at: "2023-11-17 17:01:54",
    updated_at: "2025-11-04T12:08:49.648Z",
  },
  {
    id: 7,
    name: "SendGrid",
    url: "https://status.sendgrid.com/",
    external_id: "3tgl2vf85cht",
    last_updated_at: "2025-11-04T04:01:15.870-08:00",
    time_zone: "America/Los_Angeles",
    status_indicator: "none",
    status_description: "All Systems Operational",
    created_at: "2023-11-17 17:14:40",
    updated_at: "2025-11-04T12:08:50.142Z",
  },
  {
    id: 8,
    name: "Stripe",
    url: "https://www.stripestatus.com/",
    external_id: "d5zv7xbys5v3",
    last_updated_at: "2025-11-04T12:01:31.323Z",
    time_zone: "Etc/UTC",
    status_indicator: "none",
    status_description: "All Systems Operational",
    created_at: "2023-11-17 17:18:03",
    updated_at: "2025-11-04T12:08:50.681Z",
  },
  {
    id: 9,
    name: "Figma",
    url: "https://status.figma.com/",
    external_id: "rxpksf93ynw6",
    last_updated_at: "2025-11-04T12:00:56.995Z",
    time_zone: "Etc/UTC",
    status_indicator: "none",
    status_description: "All Systems Operational",
    created_at: "2023-11-17 17:24:42",
    updated_at: "2025-11-04T12:08:51.189Z",
  },
  {
    id: 10,
    name: "OpenAI",
    url: "https://status.openai.com/",
    external_id: "jbxzcdv9xc4d",
    last_updated_at: "2025-02-27T03:19:15.640-08:00",
    time_zone: "America/Los_Angeles",
    status_indicator: "none",
    status_description: "All Systems Operational",
    created_at: "2023-11-17 17:25:23",
    updated_at: "2025-02-27T17:30:22.918Z",
  },
  {
    id: 11,
    name: "Vercel",
    url: "https://www.vercel-status.com/",
    external_id: "lvglq8h0mdyh",
    last_updated_at: "2025-11-09T13:01:06.984Z",
    time_zone: "Etc/UTC",
    status_indicator: "none",
    status_description: "All Systems Operational",
    created_at: "2023-11-19 17:56:59",
    updated_at: "2025-11-09T15:41:11.524Z",
  },
  {
    id: 12,
    name: "Coinbase",
    url: "https://status.coinbase.com",
    external_id: "kr0djjh0jyy9",
    last_updated_at: "2025-11-08T22:32:00.595-08:00",
    time_zone: "America/Los_Angeles",
    status_indicator: "none",
    status_description: "All Systems Operational",
    created_at: "2025-08-12 11:34:36",
    updated_at: "2025-11-09T15:41:12.082Z",
  },
  {
    id: 13,
    name: "Dropbox",
    url: "https://status.dropbox.com",
    external_id: "t34htyd6jblf",
    last_updated_at: "2025-11-08T13:26:48.622Z",
    time_zone: "Etc/UTC",
    status_indicator: "none",
    status_description: "All Systems Operational",
    created_at: "2025-08-12 11:35:05",
    updated_at: "2025-11-09T15:41:12.707Z",
  },
  {
    id: 14,
    name: "Twilio",
    url: "https://status.twilio.com",
    external_id: "gpkpyklzq55q",
    last_updated_at: "2025-11-09T05:00:48.280-08:00",
    time_zone: "America/Los_Angeles",
    status_indicator: "minor",
    status_description: "Partially Degraded Service",
    created_at: "2025-08-12 11:35:14",
    updated_at: "2025-11-09T15:41:13.257Z",
  },
  {
    id: 15,
    name: "DigitalOcean",
    url: "https://status.digitalocean.com",
    external_id: "w4cz49tckxhp",
    last_updated_at: "2025-11-09T07:11:28.333Z",
    time_zone: "Etc/UTC",
    status_indicator: "none",
    status_description: "All Systems Operational",
    created_at: "2025-08-12 11:35:24",
    updated_at: "2025-11-09T15:41:13.755Z",
  },
  {
    id: 16,
    name: "Datadog US1",
    url: "https://status.datadoghq.com",
    external_id: "1k6wzpspjf99",
    last_updated_at: "2025-11-09T08:00:47.172-05:00",
    time_zone: "America/New_York",
    status_indicator: "none",
    status_description: "All Systems Operational",
    created_at: "2025-08-12 11:35:33",
    updated_at: "2025-11-09T15:41:14.440Z",
  },
  {
    id: 17,
    name: "New Relic",
    url: "https://status.newrelic.com",
    external_id: "nwg5xmnm9d17",
    last_updated_at: "2025-11-09T13:01:05.725Z",
    time_zone: "Etc/UTC",
    status_indicator: "none",
    status_description: "All Systems Operational",
    created_at: "2025-08-12 11:35:57",
    updated_at: "2025-11-09T15:41:15.112Z",
  },
];
