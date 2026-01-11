# Page Components Specification

## Overview

This specification outlines the implementation of **page_components** - a new system to decouple status page elements from monitors. This allows for:

1. **External components**: Manual status updates without monitoring data
2. **Monitor-linked components**: Status derived from monitor data with custom display names/descriptions
3. **Third-party components** (future): Integration with external status providers

## Goals

- Enable non-monitor related components on status pages
- Allow manual status updates for external services
- Support different workspace limits for components vs monitors
- Improve pricing flexibility between status pages and monitors

---

## Database Schema

### New Table: `page_components`

```sql
CREATE TABLE page_components (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  page_id TEXT NOT NULL REFERENCES pages(id),

  -- Component type (third_party added via migration when implemented)
  type TEXT NOT NULL CHECK (type IN ('external', 'monitor')),

  -- Monitor link (nullable, required if type = 'monitor')
  monitor_id TEXT REFERENCES monitors(id),

  -- Display properties
  name TEXT NOT NULL,
  description TEXT,

  -- Ordering and grouping (preserved from monitors_to_pages)
  "order" INTEGER NOT NULL DEFAULT 0,
  group_id TEXT REFERENCES page_groups(id),

  -- Timestamps (auto-managed by Drizzle)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT monitor_required_for_monitor_type
    CHECK (type != 'monitor' OR monitor_id IS NOT NULL)
);
```

### Relationship Tables

#### `status_reports_to_page_components`

```sql
CREATE TABLE status_reports_to_page_components (
  status_report_id TEXT NOT NULL REFERENCES status_reports(id),
  page_component_id TEXT NOT NULL REFERENCES page_components(id),
  PRIMARY KEY (status_report_id, page_component_id)
);
```

#### `maintenances_to_page_components`

```sql
CREATE TABLE maintenances_to_page_components (
  maintenance_id TEXT NOT NULL REFERENCES maintenances(id),
  page_component_id TEXT NOT NULL REFERENCES page_components(id),
  PRIMARY KEY (maintenance_id, page_component_id)
);
```

### Validation

- **Database level**: CHECK constraint ensures `monitor_id` is defined when `type = 'monitor'`
- **Application level**: Drizzle schema validation before insert/update
- Both layers provide defense in depth

---

## Component Types

### 1. External Components

- **Purpose**: Manual status management without monitoring
- **Status updates**: Always require an explicit status report with user-provided message
- **History**: Derived entirely from linked status reports (no separate storage)
- **Visibility**: Always public when added to a page
- **Incidents**: Not applicable - use status reports only

### 2. Monitor-Linked Components

- **Purpose**: Display monitor data with custom naming on status pages
- **Status computation**: Configurable via page-level configuration
- **Override behavior**: "Worst-of" logic - displays whichever is worse between computed monitor status and active status report severity
- **One-to-many relationship**: A single monitor can be linked to multiple page_components across different pages
- **Maintenance behavior**: Scheduled maintenance overrides all - takes precedence and controls component status

### 3. Third-Party Components (Future)

- **Purpose**: Integration with external status providers (Vercel, Resend, Incidentio, Atlassian Statuspage, Betterstack)
- **Schema**: Added via DB migration when implemented (`type = 'third_party'` + `provider_config JSONB`)
- **Implementation**: Deferred to future release

---

## Status Management

### External Component Status Flow

1. User initiates status change
2. **Must create status report** with explicit user input (title/message required)
3. Status report is linked to component
4. Notifications triggered via same notification system as monitors
5. Status reflected on status page

### Monitor-Linked Component Status

1. Monitor computes status from ping data
2. If active status report exists, compare severities
3. Display "worst-of" - whichever status is more severe
4. Configuration for computation comes from page-level settings

### Status Display

- No "last updated" timestamp shown for external components
- Configuration (card-type, absolute vs manual display) remains at page-level only
- External components cannot show request numbers (only status)

---

## Lifecycle & Relationships

### Independence

- Components and monitors have **fully independent lifecycles**
- Deleting a monitor does NOT cascade to delete linked components
- Components can be archived/deleted while keeping the underlying monitor active

### Deletion Behavior

- **Hard delete** (no soft delete)
- When deleting a component with linked status reports:
  - Reports are **reassigned to page level** (lose component association but remain visible)
- No separate audit trail required (status reports serve as history)

### Unlinking Monitors

- When unlinking a monitor from a component with active status reports:
  - Reports stay linked to page
  - No affected monitor - reports become page-level only

---

## API Design

### New Resource: `/page-components`

Add new endpoints alongside existing monitor-page endpoints:

```
GET    /api/v1/page-components
POST   /api/v1/page-components
GET    /api/v1/page-components/:id
PATCH  /api/v1/page-components/:id
DELETE /api/v1/page-components/:id
```

### Creating Components

When creating a page_component with `type: 'monitor'`:
- **Auto-link existing** status reports already associated with that monitor
- Inherits all historical data from monitor's relationships

### Existing Endpoints

- Keep existing monitor-page endpoints working during migration
- Deprecate after migration complete

---

## UI/UX

### Dashboard Location

- Components managed **within status page editor** (not a separate section)
- Accessed when editing a specific status page

### Status Page Display

- External components live within status-page only
- No separate `/monitors` page for external components
- Keep existing `/monitors` behavior for monitor details

### Grouping

- **Mixed groups allowed**: External and monitor-linked components can coexist in same group
- **Ordering**: Keep current implementation (preserve existing behavior)

### Empty Pages

- Status pages can exist with zero components

---

## Migration Strategy

### Approach: Dual-Write with Feature Flag

1. **Dual-write period**: Write to both old (`monitors_to_pages`) and new (`page_components`) tables
2. **Feature flag controlled**: Toggle between old/new system per workspace
3. **No fixed timeline**: Migrate workspaces as needed
4. **Rollback**: If issues arise, disable feature flag to revert to old system

### Migration Scope

- Create page_components for **ALL existing monitor-to-page relationships**
- Includes both public and private monitors
- Includes paused/inactive monitors

### Data Preservation

- **Order/position data**: Preserved from `monitors_to_pages`
- **Group assignments**: Preserved from existing relationships
- **Status reports**: Auto-linked to new components

---

## Workspace Limits

### Separate Limits

- Monitors and components have **separate quotas**
- Example: Free tier could have 10 monitors + 20 external components
- External components are less resource-intensive (no periodic pinging)

### Rationale

- Allows generous free tier for components (low resource usage)
- Maintains appropriate limits on monitors (high resource usage)

---

## Notifications

### Trigger Behavior

- External component status changes trigger **same notification system** as monitor incidents
- No separate subscription mechanism
- Subscribers receive alerts through existing channels

---

## Rollout Plan

### Incremental Release

1. **Phase 1**: Ship external + monitor component types
2. **Phase 2**: Add third-party integrations (future release)

### Feature Flags

- Per-workspace toggle for new component system
- Gradual rollout possible

---

## Technical Considerations

### Table Naming

- Use verbose naming: `status_reports_to_page_components`, `maintenances_to_page_components`
- Consistent with existing naming patterns

### Timestamps

- Auto-managed by Drizzle
- `created_at` and `updated_at` fields

---

## Summary of Key Decisions

| Decision | Choice |
|----------|--------|
| Status changes | Always require status report with explicit user input |
| Data conflict resolution | Configurable per component (from page config) |
| Migration strategy | Dual-write with feature flag control |
| Component/monitor lifecycle | Fully independent |
| Third-party support | Add via DB migration when implemented |
| Ordering | Keep current implementation |
| API design | New `/page-components` resource |
| Historical data | Derived from linked status reports |
| Notifications | Same system as monitors |
| Status page UI | Components within status-page only |
| Workspace limits | Separate for monitors vs components |
| Dashboard UI | Within status page editor |
| Monitor linking | One-to-many (one monitor, multiple components) |
| Maintenance behavior | Overrides all component status |
| Configuration scope | Page-level only |
| Validation | Both database and application layers |
| Delete behavior | Hard delete, reassign reports to page |
| Visibility | External components always public |
| Incidents for external | Status reports only |
| Status override | Worst-of logic |
| Grouping | Mixed groups allowed |
| Report limits | Unlimited |
| Unlink safety | Reports stay linked to page |
| Freshness display | No timestamp shown |
| Migration scope | All relationships |
| API creation | Auto-link existing reports |
| Table names | Verbose (full names) |
| Timestamps | Auto-managed by Drizzle |

---

## Related Issues

- [Original Issue](https://github.com/openstatusHQ/roadmap/issues/1) - (external) page components
