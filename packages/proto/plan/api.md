# Status Page Proto Service Implementation Plan

## Overview

Create a new proto service for Status Pages in `packages/proto/api/openstatus/status_page/v1/` following existing patterns from `monitor` and `status_report` services.

## File Structure

```
packages/proto/api/openstatus/status_page/v1/
├── service.proto          # RPC service definitions
├── status_page.proto      # StatusPage message and enums
├── page_component.proto   # PageComponent message and enums
└── page_subscriber.proto  # PageSubscriber message
```

## Proto Definitions

### 1. `status_page.proto` - Core Types

**Enums:**
- `PageAccessType`: PUBLIC, PASSWORD_PROTECTED, AUTHENTICATED
- `PageTheme`: SYSTEM, LIGHT, DARK
- `OverallStatus`: OPERATIONAL, DEGRADED, PARTIAL_OUTAGE, MAJOR_OUTAGE, MAINTENANCE, UNKNOWN

**Messages:**
- `StatusPage` - Full page details (id, title, description, slug, custom_domain, published, access_type, theme, homepage_url, contact_url, icon, timestamps)
- `StatusPageSummary` - List response (id, title, slug, published, timestamps)

### 2. `page_component.proto` - Component Types

**Enums:**
- `PageComponentType`: MONITOR, STATIC

**Messages:**
- `PageComponent` - Component details (id, page_id, name, description, type, monitor_id, order, group_id, group_order, timestamps)
- `PageComponentGroup` - Group details (id, page_id, name, timestamps)

### 3. `page_subscriber.proto` - Subscriber Types

**Messages:**
- `PageSubscriber` - Subscriber details (id, page_id, email, accepted_at, unsubscribed_at, timestamps)

### 4. `service.proto` - RPC Service

```protobuf
service StatusPageService {
  // Page CRUD
  rpc CreateStatusPage(CreateStatusPageRequest) returns (CreateStatusPageResponse);
  rpc GetStatusPage(GetStatusPageRequest) returns (GetStatusPageResponse);
  rpc ListStatusPages(ListStatusPagesRequest) returns (ListStatusPagesResponse);
  rpc UpdateStatusPage(UpdateStatusPageRequest) returns (UpdateStatusPageResponse);
  rpc DeleteStatusPage(DeleteStatusPageRequest) returns (DeleteStatusPageResponse);

  // Components
  rpc AddMonitorComponent(AddMonitorComponentRequest) returns (AddMonitorComponentResponse);
  rpc AddExternalComponent(AddExternalComponentRequest) returns (AddExternalComponentResponse);
  rpc RemoveComponent(RemoveComponentRequest) returns (RemoveComponentResponse);
  rpc UpdateComponent(UpdateComponentRequest) returns (UpdateComponentResponse);

  // Component Groups
  rpc CreateComponentGroup(CreateComponentGroupRequest) returns (CreateComponentGroupResponse);
  rpc DeleteComponentGroup(DeleteComponentGroupRequest) returns (DeleteComponentGroupResponse);
  rpc UpdateComponentGroup(UpdateComponentGroupRequest) returns (UpdateComponentGroupResponse);

  // Subscribers
  rpc SubscribeToPage(SubscribeToPageRequest) returns (SubscribeToPageResponse);
  rpc UnsubscribeFromPage(UnsubscribeFromPageRequest) returns (UnsubscribeFromPageResponse);
  rpc ListSubscribers(ListSubscribersRequest) returns (ListSubscribersResponse);

  // Full Content & Status
  rpc GetStatusPageContent(GetStatusPageContentRequest) returns (GetStatusPageContentResponse);
  rpc GetOverallStatus(GetOverallStatusRequest) returns (GetOverallStatusResponse);
}
```

## RPC Methods Breakdown

### Page CRUD (5 methods)
| Method | Request Fields | Response |
|--------|---------------|----------|
| `CreateStatusPage` | title, description, slug,  homepage_url?, contact_url?| StatusPage |
| `GetStatusPage` | id | StatusPage |
| `ListStatusPages` | limit?, offset? | StatusPageSummary[], total_size |
| `UpdateStatusPage` | id, title?, description?, slug?, homepage_url?, contact_url? | StatusPage |
| `DeleteStatusPage` | id | success |

### Component Management (4 methods)
| Method | Request Fields | Response |
|--------|---------------|----------|
| `AddMonitorComponent` | page_id, monitor_id, name?, description?, order?, group_id? | PageComponent |
| `AddExternalComponent` | page_id, name, description?, order?, group_id? | PageComponent |
| `RemoveComponent` | id | success |
| `UpdateComponent` | id, name?, description?, order?, group_id?, group_order? | PageComponent |

### Component Groups (3 methods)
| Method | Request Fields | Response |
|--------|---------------|----------|
| `CreateComponentGroup` | page_id, name | PageComponentGroup |
| `DeleteComponentGroup` | id | success |
| `UpdateComponentGroup` | id, name? | PageComponentGroup |

### Subscriber Management (3 methods)
| Method | Request Fields | Response |
|--------|---------------|----------|
| `SubscribeToPage` | page_id, email | PageSubscriber |
| `UnsubscribeFromPage` | page_id, email or token | success |
| `ListSubscribers` | page_id, limit?, offset?, include_unsubscribed? | PageSubscriber[], total_size |

### Full Content & Status (2 methods)
| Method | Request Fields | Response |
|--------|---------------|----------|
| `GetStatusPageContent` | id or slug | StatusPage, components[], groups[], status_reports[], maintenances[] |
| `GetOverallStatus` | id or slug | overall_status, component_statuses[] |

## Validation Rules (using buf.validate)

- `title`: min_len=1, max_len=256
- `description`: max_len=1024
- `slug`: min_len=1, max_len=256, pattern for valid slug
- `email`: email format validation
- `limit`: gte=1, lte=100
- `offset`: gte=0
- Enums: defined_only=true, not_in=[0] where appropriate

## Implementation Order

1. Create `status_page.proto` with enums and base messages
2. Create `page_component.proto` with component types
3. Create `page_subscriber.proto` with subscriber message
4. Create `service.proto` with all RPC definitions
5. Update buf.yaml if needed to include new package

## Files to Create

| File | Description |
|------|-------------|
| `packages/proto/api/openstatus/status_page/v1/status_page.proto` | Core enums and StatusPage messages |
| `packages/proto/api/openstatus/status_page/v1/page_component.proto` | PageComponent and PageComponentGroup messages |
| `packages/proto/api/openstatus/status_page/v1/page_subscriber.proto` | PageSubscriber message |
| `packages/proto/api/openstatus/status_page/v1/service.proto` | StatusPageService RPC definitions |

## Verification

1. Run `pnpm buf lint` to verify proto files are valid
2. Run `pnpm buf generate` to generate Go/TS code
3. Check generated code compiles without errors
