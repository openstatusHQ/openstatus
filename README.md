<p align="center" style="margin-top: 120px">

  <h3 align="center">OpenStatus</h3>

  <p align="center">
  <a href="https://status.openstatus.dev">
  <img src='https://status.openstatus.dev/badge'>
  </a>
  </p>

  <p align="center">The Open-Source synthetic monitoring platform.
    <br />
    <a href="https://www.openstatus.dev"><strong>Learn more »</strong></a>
    <br />
    <br />
    <a href="https://www.openstatus.dev/discord">Discord</a>
    ·
    <a href="https://www.openstatus.dev">Website</a>
    ·
    <a href="https://github.com/openstatushq/openstatus/issues">Issues</a>
  </p>
</p>

## About OpenStatus 🏓

OpenStatus is open-source synthetic monitoring monitoring platform.

- **Synthetic monitoring**: Monitor your website and APIs globally and receive
  notifications when they are down or slow.

## Recognitions 🏆

<a href="https://trendshift.io/repositories/1780" target="_blank"><img src="https://trendshift.io/api/badge/repositories/1780" alt="openstatusHQ%2Fopenstatus | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>

<a href="https://news.ycombinator.com/item?id=37740870">
  <img
    alt="Featured on Hacker News"
    src="https://hackerbadge.now.sh/api?id=37740870"
    style="width: 250px; height: 55px;" width="250" height="55"
  />
</a>

## Contact us 💌

If you are interested in our enterprise plan or need special features, please
email us at [ping@openstatus.dev](mailto:ping@openstatus.dev) or book a
call<br/><br/>
<a href="https://cal.com/team/openstatus/30min"><img alt="Book us with Cal.com" src="https://cal.com/book-with-cal-dark.svg" /></a>

## Roadmap 🗺️

Here's our [roadmap](https://openstatus.productlane.com/roadmap) feel free to
contribute to it.

## Contributing 🤝

If you want to help us building the best status page and alerting system, you
can check our
[contributing guidelines](https://github.com/openstatusHQ/openstatus/blob/main/CONTRIBUTING.MD)

### Top Contributors

<a href="https://github.com/openstatushq/openstatus/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=openstatushq/openstatus" />
</a>

Made with [Contrib.rocks](https://contrib.rocks)

### Stats

![Alt](https://repobeats.axiom.co/api/embed/180eee159c0128f683a30f15f51ac35bdbd9fa44.svg "Repobeats analytics image")

## Tech stack 🥞

- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [tinybird](https://tinybird.co/?ref=openstatus.dev)
- [turso](https://turso.tech/)
- [drizzle](https://orm.drizzle.team/)
- [Resend](https://resend.com/)

[![Built with Depot](https://depot.dev/badges/built-with-depot.svg)](https://depot.dev/?utm_source=Opource=OpenStatus)

## Getting Started 🚀

### With Devbox

You can use [Devbox](https://www.jetify.com/devbox/) and get started with the following commands:

1. Install Devbox
    ```sh
    curl -fsSL https://get.jetify.com/devbox | bash
    ```
2. Install project dependencies, build and start services
    ```sh
    devbox services up
    ```

Alternatively, follow the instructions below.

### Requirements

- [Node.js](https://nodejs.org/en/) >= 20.0.0
- [pnpm](https://pnpm.io/) >= 8.6.2
- [Bun](https://bun.sh/)
- [Turso CLI](https://docs.turso.tech/quickstart)

### Setup

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

4. Launch the web app

```sh
pnpm dev:web
```

5. See the results:

- open [http://localhost:3000](http://localhost:3000) for the web app

### Videos

Videos to better understand the OpenStatus codebase:

- [The code behind OpenStatus and how it uses Turbopack](https://youtube.com/watch?v=PYfSJATE8v8).
- [Drop Betterstack and go open source](https://www.youtube.com/watch?v=PKag0USy3eQ)
