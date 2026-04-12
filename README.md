<p align="center" style="margin-top: 120px">

  <h3 align="center">openstatus</h3>

  <p align="center">The open-source status page and uptime monitoring platform.
    <br />
    <a href="https://www.openstatus.dev"><strong>Learn more »</strong></a>
    <br />
    <br />
    <a href="https://docs.openstatus.dev">Documentation</a>
    ·
    <a href="https://www.openstatus.dev">Website</a>
    ·
    <a href="https://www.openstatus.dev/discord">Discord</a>
  </p>

  <p align="center">
  <a href="https://status.openstatus.dev"><img src="https://status.openstatus.dev/badge/v2?variant=outline" alt="openstatus status"></a>

  </p>
  <p align="center">
      <a href="https://github.com/openstatushq/openstatus/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" alt="License"></a>
      <a href="https://github.com/openstatushq/openstatus/stargazers"><img src="https://img.shields.io/github/stars/openstatushq/openstatus?style=social" alt="GitHub stars"></a>
      <a href="https://www.openstatus.dev/discord"><img src="https://img.shields.io/discord/1129008226264940625?color=7289da&logo=discord&logoColor=white" alt="Discord"></a>
</p>

## About openstatus

openstatus is an open-source platform that combines **status pages** and **uptime monitoring** in a single tool. Keep your users informed and your services reliable. Available as a managed service or self-hosted.

<p align="center">
  <img src="https://www.openstatus.dev/assets/landing/statuspage-meow.png" alt="openstatus status page" width="720" />
</p>

## Why openstatus?

- **Status pages + monitoring in one tool** — no need to wire up a separate monitoring service
- **28 global regions** checking in parallel across 3 cloud providers
- **Flat pricing, unlimited members** — no per-seat or per-subscriber charges
- **Open source & self-hostable** — AGPL-3.0, private-locations run in a single 8.5MB Docker image
- **Monitoring as code** — YAML config, CLI, GitHub Actions, Terraform
- **Incident communication** — subscriber notifications via email, RSS, and webhooks

### Status pages

Beautiful, customizable status pages with custom domains, password protection, maintenance windows, and subscriber notifications via email and RSS. Build trust and keep your users informed during incidents.

### Uptime Monitoring

Monitor your servers, websites and APIs from 28 regions across multiple cloud providers globally. Get notified via Slack, Discord, PagerDuty, email, and more when your services are down or slow.

## Recognitions

<a href="https://trendshift.io/repositories/1780" target="_blank"><img src="https://trendshift.io/api/badge/repositories/1780" alt="openstatus | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
<a href="https://news.ycombinator.com/item?id=37740870"><img alt="Featured on Hacker News" src="https://hackerbadge.now.sh/api?id=37740870" style="width: 250px; height: 55px;" width="250" height="55" /></a>
<a href="https://www.producthunt.com/posts/openstatus-2?utm_source=badge-top-post-badge&utm_medium=badge" target="_blank"><img alt="openstatus - #2 Product of the Day on Product Hunt" src="https://api.producthunt.com/widgets/embed-image/v1/top-post-badge.svg?post_id=openstatus-2&theme=light&period=daily" style="width: 250px; height: 55px;" width="250" height="55" /></a>

## Getting Started

### With Docker (Recommended)

The fastest way to get started for both development and self-hosting:

```sh
# 1. Copy environment file
cp .env.docker.example .env.docker

# 2. Start all services
docker compose up -d

# 3. Access the application
open http://localhost:3002  # Dashboard
open http://localhost:3003  # Status Pages
```

Full guide: [DOCKER.md](DOCKER.md)

### Self-Hosting with Coolify

We provide pre-built Docker images for easy deployment:

```bash
ghcr.io/openstatushq/openstatus-server:latest
ghcr.io/openstatushq/openstatus-dashboard:latest
ghcr.io/openstatushq/openstatus-workflows:latest
ghcr.io/openstatushq/openstatus-private-location:latest
ghcr.io/openstatushq/openstatus-status-page:latest
ghcr.io/openstatushq/openstatus-checker:latest
```

[Complete Coolify Deployment Guide](./COOLIFY_DEPLOYMENT.md)

### Manual Setup

#### Requirements

- [Node.js](https://nodejs.org/en/) >= 20.0.0
- [pnpm](https://pnpm.io/) >= 8.6.2
- [Bun](https://bun.sh/)
- [Turso CLI](https://docs.turso.tech/quickstart)

#### Setup

1. Clone the repository

```sh
git clone https://github.com/openstatushq/openstatus.git
```

2. Install dependencies

```sh
pnpm install
```

3. Initialize the development environment

Launch the database in one terminal:

```sh
turso dev --db-file openstatus-dev.db
```

In another terminal, run the following command:

```sh
pnpm dx
```

4. Launch whatever app you wish to:

```sh
pnpm dev:web
pnpm dev:status-page
pnpm dev:dashboard
```

The above commands will automatically run the libSQL client on `8080` so you might want to kill the turso command from step 3.

5. See the results:

- open [http://localhost:3000](http://localhost:3000) (default port)

## Tech Stack

- [Next.js](https://nextjs.org/) - Dashboard
- [Hono](https://hono.dev/) - API server
- [Go](https://go.dev/) - Checker
- [Turso](https://turso.tech/) - Database
- [Drizzle](https://orm.drizzle.team/) - ORM
- [Tinybird](https://tinybird.co/?ref=openstatus.dev) - Analytics
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - UI components

## Contributing

If you want to help us build the best status page and monitoring platform, check our [contributing guidelines](https://github.com/openstatusHQ/openstatus/blob/main/CONTRIBUTING.MD).

<a href="https://github.com/openstatushq/openstatus/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=openstatushq/openstatus" />
</a>

![openstatus repository activity](https://repobeats.axiom.co/api/embed/180eee159c0128f683a30f15f51ac35bdbd9fa44.svg "Repobeats analytics image")

## Contact

Interested in our enterprise plan or need special features? Email us at [ping@openstatus.dev](mailto:ping@openstatus.dev) or book a call.

<a href="https://cal.com/team/openstatus/30min"><img alt="Book us with Cal.com" src="https://cal.com/book-with-cal-dark.svg" /></a>

## License

Distributed under the [AGPL-3.0 License](LICENSE).
