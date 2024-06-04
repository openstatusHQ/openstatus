<p align="center" style="margin-top: 120px">

  <h3 align="center">OpenStatus</h3>

  <p align="center">
  <a href="https://status.openstatus.dev">
  <img src='https://status.openstatus.dev/badge'>
  </a>
  </p>

  <p align="center">The Open-Source performance monitoring platform.
    <br />
    <a href="https://www.openstatus.dev"><strong>Learn more »</strong></a>
    <br />
    <br />
    <a href="https://www.openstatus.dev/discord">Discord</a>
    ·
    <a href="https://www.openstatus.dev">Website</a>
    ·
    <a href="https://github.com/openstatushq/openstatus/issues">Issues</a>
    ·
    <a href="https://openstatus.productlane.com/roadmap">Roadmap</a>
  </p>
</p>

## About OpenStatus 🏓

OpenStatus is open-source performance monitoring platform.

- **Synthetic monitoring**: Monitor your website and APIs worldwide and receive
  notifications when they are down or slow.
- **Real User Monitoring**: Understand how your users are experiencing your
  website with core web vitals metrics.

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

## Built with 🛠️

- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [tinybird](http://tinybird.co/?ref=openstatus.dev)
- [turso](http://turso.tech/)
- [drizzle](https://orm.drizzle.team/)
- [Resend](https://resend.com/)

## Getting Started 🚀

### Requirements

- [Node.js](https://nodejs.org/en/) >= 20.0.0
- [pnpm](https://pnpm.io/) >= 8.6.2

### Setup

1. Clone the repository

   ```sh
   git clone https://github.com/openstatushq/openstatus.git
   ```

2. Install dependencies

   ```sh
   pnpm install
   ```

3. Set up your .env file

   From `apps/web` and `packages/db`, you will find .env.example. Create your
   own copy.

4. Follow the steps to run your sqlite database locally inside of
   [README.md](https://github.com/openstatusHQ/openstatus/blob/main/packages/db/README.md)

5. Start the development with the below command

   ```sh
    pnpm dev
   ```

   It will:

   - run the web app on port `3000`
   - run the api server on port `3001`
   - run the docs on port `3002`

6. See the results:

- open [http://localhost:3000](http://localhost:3000) for the web app
- open [http://localhost:3001/ping](http://localhost:3001/ping) for the api
  server health check
- open [http://localhost:3002](http://localhost:3002) for the docs

[Tunnelmole](https://github.com/robbie-cahill/tunnelmole-client), an open source
tunnelling tool or ngrok, a popular closed source tunnelling tool.

### Using Tunnelmole

1. Install Tunnelmole with
   `curl -O https://install.tunnelmole.com/384HK/install && sudo bash install`.
   (On Windows, download
   [tmole.exe](https://tunnelmole.com/downloads/tmole.exe))
2. Run `tmole 3000`. In the output, you'll see two URLs, one HTTP, and an HTTPS
   URL. It's best to use the HTTPS URL for privacy and security.

```
➜  ~ tmole 3000
http://bvdo5f-ip-49-183-170-144.tunnelmole.net is forwarding to localhost:3000
https://bvdo5f-ip-49-183-170-144.tunnelmole.net is forwarding to localhost:3000
```

### Videos

Videos to better understand the OpenStatus codebase:

- [The code behind OpenStatus and how it uses Turbopack](https://youtube.com/watch?v=PYfSJATE8v8).
- [Drop Betterstack and go open source](https://www.youtube.com/watch?v=PKag0USy3eQ)
