<p align="center" style="margin-top: 120px">

  <h3 align="center">The Open-source Status Page and Alerting System
   </h3>

  <p align="center">
    The Statuspage Open Source Alternative.
    <br />
    <a href="https://www.openstatus.dev"><strong>Learn more »</strong></a>
    <br />
    <br />
    <a href="https://discord.gg/dHD4JtSfsn">Discord</a>
    ·
    <a href="https://www.openstatus.dev">Website</a>
    ·
    <a href="https://github.com/openstatushq/openstatus/issues">Issues</a>
    ·
    <a href="https://openstatus.productlane.com/roadmap">Roadmap</a>
  </p>
</p>

# OpenStatus

## About this project

OpenStatus is a free and open-source status page and alerting system.

## Contributing

Coming soon

## Contact us

If you want to learn more about this project or have any questions, send us an
email at [hello@openstatus.dev](mailto:hello@openstatus.dev) <br/> or <br/>
<a href="https://cal.com/thibault-openstatus/30min"><img alt="Book us with Cal.com" src="https://cal.com/book-with-cal-dark.svg" /></a>

## Built with

- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [tinybird](http://tinybird.co/?ref=openstatus.dev)
- [planetscale](http://planetscale.com/)
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

## Roadmap

Here's our [roadmap](https://openstatus.productlane.com/roadmap) feel free to
contribute to it.

## Contributors

<a href="https://github.com/openstatushq/openstatus/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=openstatushq/openstatus" />
</a>
