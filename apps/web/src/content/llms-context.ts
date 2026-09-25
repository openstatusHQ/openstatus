// Product context surfaced in /llms.txt and /llms-full.txt so agents have
// pricing, audience, and differentiators without crawling individual pages.
// Keep numbers in sync with src/content/pages/unrelated/pricing.mdx.

export const PRODUCT_SUMMARY =
  "Openstatus is an open-source uptime monitoring and status page platform built for infra as code: monitors, status pages, and notification channels are declared in YAML or Terraform and driven from a CLI, a typed API, or an MCP server (Claude, ChatGPT, Cursor), so your agents can update them. It runs synthetic checks in parallel from 28 regions across Fly.io, Koyeb, and Railway and surfaces incidents on branded status pages. Available as managed SaaS or self-hosted (AGPL-3.0). Bootstrapped, founded in 2023.";

export const PRODUCT_CONTEXT_MARKDOWN = `## Who it's for

- Teams that manage uptime monitoring and status pages as infra as code and let agents (Claude, Cursor, ChatGPT, CI) open and resolve incidents over MCP, CLI, or API
- Development teams that want transparent incident communication
- Companies that need multi-region uptime monitoring
- Teams that prefer infrastructure-as-code workflows (YAML via the CLI, or the Terraform provider)
- Organizations that require self-hosted monitoring behind a firewall (private locations)
- Open-source projects and startups looking for a free or affordable monitoring solution

## Pricing

- **Hobby** — $0/month: 1 monitor, 6 regions, 10m check interval, 1 status page, 3 page components, 14-day data retention
- **Starter** — $30/month: 20 monitors, 28 regions, 1m check interval, 1 status page, 20 components, 3-month retention, subscribers, custom domain, WhatsApp/PagerDuty alerts
- **Pro** — $100/month: 50 monitors, 28 regions, 30s check interval, 5 status pages, 50 components, 12-month retention, private locations, OTel exporter, 20 notification channels
- **Scale** — $500/month: everything in Pro plus 10 status pages, 500 page components, and White Label, Magic Link auth, and IP Restriction included at no extra cost

Annual billing gives 2 months free (Starter $300/yr, Pro $1,000/yr, Scale $5,000/yr). Pricing is available in USD and EUR.

## Key Features

- **28-region monitoring** — Parallel checks across Europe, North America, South America, Asia, Africa, and Oceania; no round-robin, all selected regions fire simultaneously
- **Multi-cloud** — Monitors run on Fly.io, Koyeb, and Railway for true cloud diversity
- **Status Pages** — Branded public or password-protected pages with custom domains, themes, maintenance windows, and subscriber notifications (email, RSS, Slack)
- **API Monitoring** — Assertions, thresholds, status code checks, header and body validation
- **Infra as Code** — Define monitors, status pages, and notification channels in YAML (CLI, GitHub Actions) or Terraform
- **Private Locations** — 8.5MB Docker image for monitoring internal services behind firewalls
- **Alerting** — Email, Slack, Discord, webhook, WhatsApp, PagerDuty, OpsGenie, Grafana OnCall
- **OpenTelemetry** — Export synthetic check metrics to any OTLP endpoint
- **SDK** — Node.js SDK on JSR (@openstatus/sdk-node)
- **MCP server** — Streamable-HTTP MCP at https://api.openstatus.dev/mcp with OAuth 2.1, for status reports, maintenance windows, and monitor reads; every mutation lands in the audit log
- **Open-source** — AGPL-3.0-licensed, self-hostable, 8k+ GitHub stars

## Key Differentiators

- Built for humans and agents: MCP server, --json CLI output, typed API, read-only or read-write API key scopes
- Open-source and bootstrapped (no VC funding)
- Parallel scheduling — all selected regions check simultaneously (vs. round-robin competitors)
- Unlimited team members on paid plans
- Status page subscribers included (not a paid add-on)
- Private status pages included in the team plan (not an additional charge)
- Self-hosting option with full feature parity`;
