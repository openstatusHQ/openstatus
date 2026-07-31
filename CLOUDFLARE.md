# Anedot Cloudflare fork

This repository is Anedot's **public AGPL fork** of [openstatusHQ/openstatus](https://github.com/openstatusHQ/openstatus), adapted for a **Cloudflare-native** deployment.

## Purpose

Replace the upstream Docker / Tinybird / LibSQL control plane with:

- **Workers** — control plane API, probe execution, scheduling
- **D1** — relational domain data (monitors, pages, incidents)
- **Queues** — probe job dispatch and result processing
- **R2** — raw check telemetry

Keep OpenStatus **status-page UI** and domain model; drop Tinybird, self-hosted LibSQL, Turso, and QStash/GCloud Tasks from the deployed path. Optional **Containers** only for private-location Go probes (P1+).

## Upstream pin

| Field | Value |
|---|---|
| Upstream repo | `openstatusHQ/openstatus` |
| Default branch | `main` |
| Pinned SHA | `b0b02673aa15388b76861277e57ada259ca0b94b` |
| Pinned commit | fix: add DNS monitor support to global metrics pipeline (and update dashboard) (#2515) |

Re-pin intentionally when merging upstream changes; record the new SHA here.

## Brain plan & observability docs

Execution plan and P0 acceptance criteria live in the Anedot brain repo:

- **Plan:** [paultwo/brain `projects/observability`](https://github.com/paultwo/brain/tree/main/projects/observability)
- **STATUS-CF spec:** [STATUS-CF.md](https://github.com/paultwo/brain/blob/main/projects/observability/STATUS-CF.md) (retargeted from UptimeFlare → this fork)

## AGPL-3.0

OpenStatus is licensed under **AGPL-3.0**. Operating a modified version for users (e.g. `status.anedot.com`) requires offering **corresponding source** to those users.

- This fork remains **public**.
- The production status page must link to the **deployed source tag** (not secrets or env).
- Do not combine proprietary code with AGPL-covered code without counsel review.

See upstream `LICENSE` and [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html).
