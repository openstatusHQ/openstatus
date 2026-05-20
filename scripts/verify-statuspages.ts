type Candidate = { name: string; statusPageUrl: string };

const CANDIDATES: Candidate[] = [
  { name: "Mailchimp", statusPageUrl: "https://status.mailchimp.com/" },
  { name: "Notion", statusPageUrl: "https://status.notion.so/" },
  { name: "Intercom", statusPageUrl: "https://status.intercom.com/" },
  { name: "Mixpanel", statusPageUrl: "https://status.mixpanel.com/" },
  { name: "Segment", statusPageUrl: "https://status.segment.com/" },
  { name: "Trello", statusPageUrl: "https://trello.status.atlassian.com/" },
  { name: "Coinbase", statusPageUrl: "https://status.coinbase.com/" },
  { name: "Asana", statusPageUrl: "https://trust.asana.com/" },
  { name: "Squarespace", statusPageUrl: "https://status.squarespace.com/" },
  { name: "Wix", statusPageUrl: "https://status.wix.com/" },
  { name: "Shopify", statusPageUrl: "https://www.shopifystatus.com/" },
  { name: "Auth0", statusPageUrl: "https://status.auth0.com/" },
  { name: "Okta", statusPageUrl: "https://status.okta.com/" },
  { name: "MongoDB", statusPageUrl: "https://status.mongodb.com/" },
  { name: "Sentry", statusPageUrl: "https://status.sentry.io/" },
  { name: "CircleCI", statusPageUrl: "https://status.circleci.com/" },
  {
    name: "Bitbucket",
    statusPageUrl: "https://bitbucket.status.atlassian.com/",
  },
  { name: "Algolia", statusPageUrl: "https://status.algolia.com/" },
  { name: "Snyk", statusPageUrl: "https://status.snyk.io/" },
  { name: "Looker", statusPageUrl: "https://status.looker.com/" },
  { name: "DocuSign", statusPageUrl: "https://trust.docusign.com/" },
  { name: "Webflow", statusPageUrl: "https://status.webflow.com/" },
  { name: "Buffer", statusPageUrl: "https://status.buffer.com/" },
  { name: "Loom", statusPageUrl: "https://status.loom.com/" },
  { name: "ClickUp", statusPageUrl: "https://status.clickup.com/" },
  { name: "Calendly", statusPageUrl: "https://status.calendly.com/" },
  { name: "Zapier", statusPageUrl: "https://status.zapier.com/" },
  { name: "SendGrid", statusPageUrl: "https://status.sendgrid.com/" },
  { name: "Snowflake", statusPageUrl: "https://status.snowflake.com/" },
  { name: "Databricks", statusPageUrl: "https://status.databricks.com/" },
  { name: "Airtable", statusPageUrl: "https://status.airtable.com/" },
  { name: "Postman", statusPageUrl: "https://status.postman.com/" },
  { name: "LaunchDarkly", statusPageUrl: "https://status.launchdarkly.com/" },
  { name: "Fivetran", statusPageUrl: "https://status.fivetran.com/" },
  { name: "Bitly", statusPageUrl: "https://status.bitly.com/" },
  { name: "Greenhouse", statusPageUrl: "https://status.greenhouse.io/" },
  { name: "Lever", statusPageUrl: "https://status.lever.co/" },
  { name: "Miro", statusPageUrl: "https://status.miro.com/" },
  { name: "Figma", statusPageUrl: "https://status.figma.com/" },
  { name: "Vimeo", statusPageUrl: "https://status.vimeo.com/" },
  { name: "LastPass", statusPageUrl: "https://status.lastpass.com/" },
  {
    name: "Apollo GraphQL",
    statusPageUrl: "https://status.apollographql.com/",
  },
  { name: "Render", statusPageUrl: "https://status.render.com/" },
  { name: "Cloudinary", statusPageUrl: "https://status.cloudinary.com/" },
  { name: "Coursera", statusPageUrl: "https://status.coursera.org/" },
  { name: "Jamf", statusPageUrl: "https://status.jamf.com/" },
  { name: "Mezmo", statusPageUrl: "https://status.mezmo.com/" },
  { name: "GitLab", statusPageUrl: "https://status.gitlab.com/" },
  { name: "Sumo Logic", statusPageUrl: "https://status.sumologic.com/" },
  { name: "Replit", statusPageUrl: "https://status.replit.com/" },
  { name: "Vercel", statusPageUrl: "https://www.vercel-status.com/" },
  { name: "Atlassian", statusPageUrl: "https://status.atlassian.com/" },
  { name: "GitHub", statusPageUrl: "https://www.githubstatus.com/" },
  { name: "Cloudflare", statusPageUrl: "https://www.cloudflarestatus.com/" },
  { name: "Discord", statusPageUrl: "https://discordstatus.com/" },
  { name: "Reddit", statusPageUrl: "https://www.redditstatus.com/" },
  { name: "Slack", statusPageUrl: "https://status.slack.com/" },
  { name: "Stripe", statusPageUrl: "https://status.stripe.com/" },
  { name: "Twilio", statusPageUrl: "https://status.twilio.com/" },
  { name: "Dropbox", statusPageUrl: "https://status.dropbox.com/" },
  { name: "DigitalOcean", statusPageUrl: "https://status.digitalocean.com/" },
  { name: "Heroku", statusPageUrl: "https://status.heroku.com/" },
  { name: "Zoom", statusPageUrl: "https://status.zoom.us/" },
  { name: "New Relic", statusPageUrl: "https://status.newrelic.com/" },
  { name: "PagerDuty", statusPageUrl: "https://status.pagerduty.com/" },
  { name: "Datadog", statusPageUrl: "https://status.datadoghq.com/" },
  { name: "Adobe", statusPageUrl: "https://status.adobe.com/" },
  { name: "Box", statusPageUrl: "https://status.box.com/" },
  { name: "Linode", statusPageUrl: "https://status.linode.com/" },
  { name: "Netlify", statusPageUrl: "https://www.netlifystatus.com/" },
  { name: "Fastly", statusPageUrl: "https://status.fastly.com/" },
  { name: "Epic Games", statusPageUrl: "https://status.epicgames.com/" },
  {
    name: "Sony PlayStation",
    statusPageUrl: "https://status.playstation.com/",
  },
  { name: "Zendesk", statusPageUrl: "https://status.zendesk.com/" },
  { name: "HubSpot", statusPageUrl: "https://status.hubspot.com/" },
  { name: "Hetzner", statusPageUrl: "https://status.hetzner.com/" },
  { name: "Scaleway", statusPageUrl: "https://status.scaleway.com/" },
  { name: "Vultr", statusPageUrl: "https://status.vultr.com/" },
  { name: "Bluesky", statusPageUrl: "https://status.bsky.app/" },
  { name: "OpenAI", statusPageUrl: "https://status.openai.com/" },
  { name: "PayPal", statusPageUrl: "https://www.paypal-status.com/" },
  { name: "Pinterest", statusPageUrl: "https://www.pintereststatus.com/" },
  { name: "Rackspace", statusPageUrl: "https://status.rackspace.com/" },
  { name: "Tailscale", statusPageUrl: "https://status.tailscale.com/" },
  { name: "Salesforce", statusPageUrl: "https://status.salesforce.com/" },
  { name: "Udemy", statusPageUrl: "https://status.udemy.com/" },
  { name: "Grammarly", statusPageUrl: "https://status.grammarly.com/" },
  { name: "Crowdin", statusPageUrl: "https://status.crowdin.com/" },
  { name: "BambooHR", statusPageUrl: "https://status.bamboohr.com/" },
  { name: "Amplitude", statusPageUrl: "https://status.amplitude.com/" },
  { name: "AppsFlyer", statusPageUrl: "https://status.appsflyer.com/" },
  { name: "Linear", statusPageUrl: "https://linearstatus.com/" },
  { name: "Taskade", statusPageUrl: "https://status.taskade.com/" },
  { name: "Cloudways", statusPageUrl: "https://status.cloudways.com/" },
  { name: "UpCloud", statusPageUrl: "https://status.upcloud.com/" },
  { name: "Kinsta", statusPageUrl: "https://status.kinsta.com/" },
  { name: "Hostinger", statusPageUrl: "https://statuspage.hostinger.com/" },
  { name: "1Password", statusPageUrl: "https://status.1password.com/" },
  { name: "TeamViewer", statusPageUrl: "https://status.teamviewer.com/" },
  { name: "Twitter/X API", statusPageUrl: "https://api.twitterstat.us/" },
];

type Verdict =
  | { kind: "atlassian"; pageId: string; pageUrl: string }
  | { kind: "not-atlassian"; reason: string; httpStatus?: number };

type Result = { candidate: Candidate; verdict: Verdict };

const UA = "openstatus-seed-verifier/1.0";
const TIMEOUT_MS = 10_000;
const CONCURRENCY = 8;

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

type AtlassianPage = { id?: unknown; url?: unknown };
type AtlassianSummary = { page?: AtlassianPage };

function isAtlassianSummary(value: unknown): value is AtlassianSummary {
  return typeof value === "object" && value !== null && "page" in value;
}

async function probe(c: Candidate): Promise<Result> {
  const base = normalizeBase(c.statusPageUrl);
  const url = `${base}/api/v2/summary.json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        candidate: c,
        verdict: {
          kind: "not-atlassian",
          reason: `HTTP ${res.status}`,
          httpStatus: res.status,
        },
      };
    }

    const ctype = res.headers.get("content-type") ?? "";
    if (!ctype.includes("application/json")) {
      return {
        candidate: c,
        verdict: {
          kind: "not-atlassian",
          reason: `non-json content-type: ${ctype}`,
        },
      };
    }

    const body: unknown = await res.json();
    if (!isAtlassianSummary(body)) {
      return {
        candidate: c,
        verdict: { kind: "not-atlassian", reason: "no page field" },
      };
    }

    const pageId = body.page?.id;
    const pageUrl = body.page?.url;
    if (typeof pageId !== "string" || typeof pageUrl !== "string") {
      return {
        candidate: c,
        verdict: {
          kind: "not-atlassian",
          reason: "page.id / page.url missing",
        },
      };
    }

    return { candidate: c, verdict: { kind: "atlassian", pageId, pageUrl } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      candidate: c,
      verdict: { kind: "not-atlassian", reason: `error: ${msg}` },
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function run(): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      const item = items[idx];
      if (item === undefined) return;
      results[idx] = await worker(item);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    run(),
  );
  await Promise.all(workers);
  return results;
}

async function main(): Promise<void> {
  const results = await runPool(CANDIDATES, CONCURRENCY, probe);

  const atlassian: Result[] = [];
  const notAtlassian: Result[] = [];
  for (const r of results) {
    (r.verdict.kind === "atlassian" ? atlassian : notAtlassian).push(r);
  }

  console.log("# verified-atlassian");
  console.log("name,statusPageUrl,pageId,pageUrl");
  for (const r of atlassian) {
    if (r.verdict.kind !== "atlassian") continue;
    console.log(
      [
        r.candidate.name,
        r.candidate.statusPageUrl,
        r.verdict.pageId,
        r.verdict.pageUrl,
      ].join(","),
    );
  }

  console.log("");
  console.log("# needs-review");
  console.log("name,statusPageUrl,reason,httpStatus");
  for (const r of notAtlassian) {
    if (r.verdict.kind !== "not-atlassian") continue;
    console.log(
      [
        r.candidate.name,
        r.candidate.statusPageUrl,
        r.verdict.reason,
        r.verdict.httpStatus ?? "",
      ].join(","),
    );
  }

  console.log("");
  console.log(
    `# totals: atlassian=${atlassian.length} other=${notAtlassian.length}`,
  );
}

await main();
