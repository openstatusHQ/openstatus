# OpenStatus Docs

The documentation website for [OpenStatus](https://www.openstatus.dev), built with [Fumadocs](https://fumadocs.dev) and [Next.js](https://nextjs.org).

## Getting Started

1. Copy the environment file:
   ```sh
   cp .env.example .env.local
   ```

2. Update `.env.local` with your values:
   - `NEXT_PUBLIC_OPENPANEL_CLIENT_ID` — Your [OpenPanel](https://openpanel.dev) client ID (optional, for analytics)

3. Install dependencies and run the dev server:
   ```sh
   pnpm install
   pnpm dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
apps/docs/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (providers, analytics)
│   ├── [[...slug]]/        # Dynamic docs page route
│   └── api/search/         # Search API endpoint
├── content/docs/           # MDX documentation content
│   ├── concept/            # Conceptual explanations
│   ├── tutorial/           # Step-by-step tutorials
│   ├── guides/             # How-to guides
│   ├── reference/          # Technical reference
│   └── sdk/                # SDK documentation
├── components/             # MDX component registry
├── lib/                    # Source loader & layout config
├── public/                 # Static assets (fonts, images)
└── source.config.ts        # Fumadocs MDX collection config
```

## Adding Content

Create MDX files in `content/docs/`. Each file needs frontmatter:

```mdx
---
title: "Page Title"
description: "Page description"
sidebar_label: "Short Sidebar Label"  # optional, defaults to title
---

Your content here.
```

Control sidebar ordering with `meta.json` files in each directory.

## Building

```sh
pnpm build
```
