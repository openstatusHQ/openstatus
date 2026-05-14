// Product context surfaced in /llms.txt and /llms-full.txt so agents have
// pricing, audience, and differentiators without crawling individual pages.
// Keep numbers in sync with src/content/pages/unrelated/pricing.mdx.

export const PRODUCT_SUMMARY =
  "Openstatus is an open-source uptime monitoring and status page platform. It runs synthetic checks in parallel from 28 regions across Fly.io, Koyeb, and Railway, surfaces incidents on branded status pages, and exposes a REST API plus MCP server for programmatic control. Available as managed SaaS or self-hosted (AGPL-3.0). Bootstrapped, founded in 2023.";

export const PRODUCT_CONTEXT_MARKDOWN = `## Who it's for

- Development teams that want transparent incident communication
- Companies that need multi-region uptime monitoring
- Teams that prefer infrastructure-as-code workflows (monitoring as code via YAML)
- Organizations that require self-hosted monitoring behind a firewall (private locations)
- Open-source projects and startups looking for a free or affordable monitoring solution

## Pricing

- **Hobby** — $0/month: 1 monitor, 6 regions, 10m check interval, 1 status page, 3 page components, 14-day data retention
- **Starter** — $30/month: 20 monitors, 28 regions, 1m check interval, 1 status page, 20 components, 3-month retention, subscribers, custom domain, WhatsApp/SMS/PagerDuty alerts
- **Pro** — $100/month: 50 monitors, 28 regions, 30s check interval, 5 status pages, 50 components, 12-month retention, private locations, OTel exporter, 20 notification channels

Annual billing gives 2 months free (Starter $300/yr, Pro $1,000/yr). Pricing is available in USD, EUR, and INR.

## Key Features

- **28-region monitoring** — Parallel checks across Europe, North America, South America, Asia, Africa, and Oceania; no round-robin, all selected regions fire simultaneously
- **Multi-cloud** — Monitors run on Fly.io, Koyeb, and Railway for true cloud diversity
- **Status Pages** — Branded public or password-protected pages with custom domains, themes, maintenance windows, and subscriber notifications (email, RSS, Slack)
- **API Monitoring** — Assertions, thresholds, status code checks, header and body validation
- **Monitoring as Code** — Define monitors in YAML, manage via CLI or GitHub Actions
- **Private Locations** — 8.5MB Docker image for monitoring internal services behind firewalls
- **Alerting** — Email, Slack, Discord, webhook, WhatsApp, SMS, PagerDuty, OpsGenie, Grafana OnCall
- **OpenTelemetry** — Export synthetic check metrics to any OTLP endpoint
- **SDK** — Node.js SDK on JSR (@openstatus/sdk-node)
- **MCP server** — Streamable-HTTP MCP at https://api.openstatus.dev/mcp for status reports, maintenance windows, and monitor reads
- **Open-source** — AGPL-3.0-licensed, self-hostable, 8k+ GitHub stars

## Key Differentiators

- Open-source and bootstrapped (no VC funding)
- Parallel scheduling — all selected regions check simultaneously (vs. round-robin competitors)
- Unlimited team members on paid plans
- Status page subscribers included (not a paid add-on)
- Private status pages included in the team plan (not an additional charge)
- Self-hosting option with full feature parity`;
