# OpenStatus

The Open-source monitoring platform

## Built with

- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)



## Getting Started

### Requirements

- [Node.js](https://nodejs.org/en/) >= 18.0.0
- [pnpm](https://pnpm.io/) >= 8.6.2

### Setup

1. Clone the repository

   ```sh
   git clone https://github.com/openstatusHQ/openstatus.git
   ```

2. Install dependencies

   ```sh
   pnpm install
   ```

3- from apps/web you will find .env.example create your own 

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# TinyBird
TINY_BIRD_API_KEY=

# Resend
RESEND_API_KEY=

# Upstash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

RESEND_API_KEY='api-key'



4. Start the development server

   ```sh
    pnpm dev


    ```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.


## Authors

- [Maximilian Kaske](https://twitter.com/mxkaske)
- [Thibault Le Ouay Ducasse](https://twitter.com/thibaultleouay)
