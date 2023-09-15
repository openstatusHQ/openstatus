<p align="center" style="margin-top: 120px">

  <h3 align="center">The Open-Source Uptime Monitoring with Status Page
   </h3>

  <p align="center">
    The Open-Source Serverless monitoring platform.
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

## About OpenStatus

OpenStatus is open-source monitoring system with beautiful status page. We are
building it publicly for everyone to see our progress. We believe great
softwares are built this way.

You can choose to host it yourself or use our hosted version at
[openstatus.dev](https://www.openstatus.dev)

## Contact us

If you want to learn more about this project or have any questions, book a call
with us or send us an email at
[hello@openstatus.dev](mailto:hello@openstatus.dev) <br/><br/>
<a href="https://cal.com/thibault-openstatus/30min"><img alt="Book us with Cal.com" src="https://cal.com/book-with-cal-dark.svg" /></a>

## Built with

- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [tinybird](http://tinybird.co/?ref=openstatus.dev)
- [turso](http://turso.tech/)
- [drizzle](https://orm.drizzle.team/)
- [clerk](https://clerk.com/)
- [Resend](https://resend.com/)

## Getting Started

### Requirements

- [Node.js](https://nodejs.org/en/) >= 18.0.0
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

   from `apps/web` and `packages/db` you will find .env.example create your own.

4. Follow the steps to run your sqlite database locally inside of
   [README.md](https://github.com/openstatusHQ/openstatus/blob/main/packages/db/README.md)

5. Start the development server

   ```sh
    pnpm dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) with your browser to see
   the result.

For [clerk](https://clerk.com), you will need to create a webhook endpoint. To
access the link via ngrok (free), after login, append `/api/webhook/clerk` to
the link you get after entering:

```
$ ngrok http 3000
```

### Videos

Videos to better understand the OpenStatus codebase:

- [The code behind OpenStatus and how it uses Turbopack](https://youtube.com/watch?v=PYfSJATE8v8).

## Roadmap

Here's our [roadmap](https://openstatus.productlane.com/roadmap) feel free to
contribute to it.

## Contributing

If you want to help us building the best status page and alerting system, you
can check our
[contributing guidelines](https://github.com/openstatusHQ/openstatus/blob/main/CONTRIBUTING.MD)

### Top Contributors

<a href="https://github.com/openstatushq/openstatus/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=openstatushq/openstatus" />
</a>

Made with [Contrib.rocks](https://contrib.rocks)
