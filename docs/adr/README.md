# Architecture Decision Records

**This set is frozen. Do not add new ADRs.**

These nine records are background on *why* a handful of architectural decisions
were made, in [MADR](https://adr.github.io/madr/) format. They are history, and
several describe a change rather than a state — ADR-0008 says
"`loadSeededWorkspace` is gone", which only makes sense against the world before
it.

Current-state truth lives in `AGENTS.md` at the repo root and in the nested
`AGENTS.md` files it links. When a decision changes, update those; do not write
a superseding ADR here.

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0000](0000-use-markdown-any-decision-records.md) | Use Markdown Any Decision Records (MADR) | accepted |
| [0001](0001-business-logic-lives-in-the-services-layer.md) | Workspace business logic lives in a framework-agnostic services layer | accepted |
| [0002](0002-use-effect-for-retry-policies.md) | Use Effect for retry policies | accepted |
| [0003](0003-shared-ui-comes-from-openstatus-ui.md) | All shared UI comes from `@openstatus/ui` | accepted |
| [0004](0004-go-for-the-probing-tier.md) | Go for the probing tier | accepted |
| [0005](0005-turso-for-app-data-tinybird-for-time-series.md) | Turso for application data, Tinybird for time-series | accepted |
| [0006](0006-persist-external-incidents-in-turso.md) | Persist external-service incidents in Turso, not Tinybird | accepted |
| [0007](0007-store-external-service-components.md) | Store external-service components in Turso, their status history in Tinybird | accepted |
| [0008](0008-isolated-test-databases.md) | One test database per package, one workspace per suite, injected route config | accepted |
