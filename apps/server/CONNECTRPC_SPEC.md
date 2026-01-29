# ConnectRPC API Specification

## Overview

This document specifies the implementation of a ConnectRPC API for OpenStatus server. ConnectRPC will be used for **new features only** while the existing REST API remains for current functionality.

## Architecture Decisions

### Transport & Protocol
- **Protocol**: Connect protocol only (HTTP/1.1 compatible)
- **Streaming**: Unary calls only (request-response, no streaming)
- **Mounting**: Same port as REST, mounted at `/rpc/*` path prefix on the existing Hono app

### Schema Management
- **Approach**: Schema-first with `.proto` files
- **Tooling**: Buf (buf.yaml, buf.gen.yaml)
- **Location**: `packages/proto` (shared package for monorepo consumption)
- **Package naming**: `openstatus.<domain>.v1` (e.g., `openstatus.monitor.v1`)

### Code Generation Targets
- TypeScript (`@bufbuild/protobuf` + `@connectrpc/connect`)
- Go (for potential backend service consumers)

---

## Authentication & Authorization

### Supported Methods
Both authentication methods resolve to the same workspace context:

1. **API Key** (existing system)
   - Header: `x-openstatus-key`
   - Formats: `os_[32-char-hex]` (custom) or Unkey keys
   - Super admin: `sa_` prefix


### Workspace Context
- Workspace ID inferred from authenticated credentials
- **Super-admin override**: Tokens with `sa_` prefix can specify target workspace via `x-workspace-id` metadata header

---

## Error Handling

### Error Model
Use ConnectRPC error codes with Google ErrorInfo for structured details:

```protobuf
// Error codes used: NOT_FOUND, INVALID_ARGUMENT, PERMISSION_DENIED,
// UNAUTHENTICATED, RESOURCE_EXHAUSTED, INTERNAL, UNAVAILABLE

// Include ErrorInfo details:
// - domain: "openstatus.com"
// - reason: Machine-readable error reason (e.g., "MONITOR_NOT_FOUND")
// - metadata: Additional context (requestId, resourceId, etc.)
```

### Mapping to Existing Errors
Reuse `OpenStatusApiError` codes, map to ConnectRPC equivalents in interceptor.

---

## First Service: Monitor Management

### Service Definition

```protobuf
syntax = "proto3";

package openstatus.monitor.v1;

import "buf/validate/validate.proto";
import "google/protobuf/timestamp.proto";

// MonitorService provides CRUD and operational commands for monitors.
service MonitorService {
  // CreateMonitor creates a new monitor in the workspace.
  rpc CreateMonitor(CreateMonitorRequest) returns (CreateMonitorResponse);

  // GetMonitor retrieves a single monitor by ID.
  rpc GetMonitor(GetMonitorRequest) returns (GetMonitorResponse);

  // ListMonitors returns a paginated list of monitors.
  rpc ListMonitors(ListMonitorsRequest) returns (ListMonitorsResponse);

  // DeleteMonitor removes a monitor.
  rpc DeleteMonitor(DeleteMonitorRequest) returns (DeleteMonitorResponse);

  // TriggerMonitor initiates an immediate check.
  rpc TriggerMonitor(TriggerMonitorRequest) returns (TriggerMonitorResponse);

}
```

### Monitor Type Modeling

Separate message types for each monitor kind:

```protobuf
// HttpMonitor configuration for HTTP/HTTPS endpoint monitoring.
message HttpMonitor {
  // The URL to monitor (required).
  string url = 1 [(buf.validate.field).string.uri = true];

  // HTTP method to use.
  HttpMethod method = 2;

  // Request headers to include.
  map<string, string> headers = 3;

  // Request body for POST/PUT/PATCH.
  optional string body = 4;

  // Timeout in milliseconds (default: 30000).
  int32 timeout_ms = 5 [(buf.validate.field).int32 = {gte: 1000, lte: 60000}];

  // Assertions to validate the response.
  repeated HttpAssertion assertions = 6;
}

// TcpMonitor configuration for TCP connection monitoring.
message TcpMonitor {
  // Host to connect to (required).
  string host = 1 [(buf.validate.field).string.min_len = 1];

  // Port number (required).
  int32 port = 2 [(buf.validate.field).int32 = {gte: 1, lte: 65535}];

  // Timeout in milliseconds.
  int32 timeout_ms = 3;
}

// DnsMonitor configuration for DNS record monitoring.
message DnsMonitor {
  // Domain name to query (required).
  string domain = 1 [(buf.validate.field).string.hostname = true];

  // DNS record type to check.
  DnsRecordType record_type = 2;

  // Expected values for the record.
  repeated string expected_values = 3;
}
```

### Pagination

Offset-based pagination for list operations (page_token is the numeric offset):

```protobuf
message ListMonitorsRequest {
  // Maximum number of monitors to return (default: 50, max: 100).
  int32 page_size = 1 [(buf.validate.field).int32 = {gte: 1, lte: 100}];

  // Token from previous response for pagination.
  optional string page_token = 2;

  // Filter by monitor status.
  optional MonitorStatus status_filter = 3;

  // Filter by monitor type.
  optional MonitorType type_filter = 4;
}

message ListMonitorsResponse {
  // The monitors in this page.
  repeated Monitor monitors = 1;

  // Token for retrieving the next page, empty if no more results.
  string next_page_token = 2;

  // Total count of monitors matching the filter.
  int32 total_count = 3;
}
```

---

## Validation

### Approach
Use **protovalidate** (Buf ecosystem) for request validation:

- Validation rules defined in proto annotations
- Runs before handler via interceptor
- Returns `INVALID_ARGUMENT` with field-level details on failure

### Example Annotations
```protobuf
message CreateMonitorRequest {
  string name = 1 [(buf.validate.field).string = {min_len: 1, max_len: 256}];
  string description = 2 [(buf.validate.field).string.max_len = 1024];
  int32 periodicity = 3 [(buf.validate.field).int32 = {in: [60, 300, 600, 1800, 3600]}];
  repeated string regions = 4 [(buf.validate.field).repeated = {min_items: 1, max_items: 35}];
}
```

---

## Code Organization

### Shared Service Layer

Both REST and RPC handlers call the same business logic:

```
packages/proto/                    # Shared proto definitions
├── buf.yaml                       # Buf configuration
├── buf.gen.yaml                   # Code generation config
├── openstatus/
│   └── monitor/
│       └── v1/
│           ├── monitor.proto      # Message definitions
│           └── service.proto      # Service definition
└── gen/                           # Generated code
    ├── ts/                        # TypeScript output
    └── go/                        # Go output

apps/server/src/
├── services/                      # Shared business logic (NEW)
│   └── monitor/
│       ├── create.ts
│       ├── get.ts
│       ├── list.ts
│       ├── update.ts
│       ├── delete.ts
│       └── operations.ts          # trigger, pause, resume
├── routes/
│   └── v1/                        # REST handlers (existing)
│       └── monitors/
└── rpc/                           # ConnectRPC handlers (NEW)
    ├── index.ts                   # Mount point
    ├── interceptors/
    │   ├── auth.ts                # Auth interceptor
    │   ├── logging.ts             # Request logging
    │   └── error.ts               # Error mapping
    └── handlers/
        └── monitor.ts             # MonitorService implementation
```

### Handler Pattern

```typescript
// apps/server/src/rpc/handlers/monitor.ts
import type { ConnectRouter } from "@connectrpc/connect";
import { MonitorService } from "@openstatus/proto/gen/ts/openstatus/monitor/v1/service_connect";
import * as monitorService from "../../services/monitor";

export default (router: ConnectRouter) =>
  router.service(MonitorService, {
    async createMonitor(req, ctx) {
      const workspace = ctx.values.get(workspaceKey);
      return await monitorService.create(workspace, req);
    },
    // ... other methods
  });
```

---

## Interceptors

### Authentication Interceptor
```typescript
// Extracts and validates auth from headers
// Sets workspace context for downstream handlers
// Supports both API key and Bearer token
```

### Logging Interceptor
```typescript
// Integrates with existing LogTape setup
// Logs: method, duration, status, workspace, requestId
```

### Error Interceptor
```typescript
// Maps internal errors to ConnectRPC codes
// Attaches ErrorInfo details
// Reports to Sentry (filtered for client errors)
```

---

## Observability

### Logging
- Integrate with existing LogTape JSON logging
- Log fields: `rpc.method`, `rpc.status_code`, `duration_ms`, `workspace_id`, `request_id`

### Error Tracking
- Sentry integration via interceptor
- Filter client errors (INVALID_ARGUMENT, NOT_FOUND, etc.)
- Include request context in error reports

---

## Rate Limiting

Use existing infrastructure:
- Hono middleware / upstream proxy handles rate limiting
- No RPC-specific rate limiting interceptors needed

---

## Testing Strategy

### Unit Tests
- Test handlers directly with mocked service layer
- Test interceptors in isolation
- Test proto validation rules

### Integration Tests
- Spin up real server instance
- Use generated TypeScript client to make RPC calls
- Test full request lifecycle including auth

### Test File Structure
```
apps/server/src/rpc/
├── __tests__/
│   ├── handlers/
│   │   └── monitor.test.ts        # Handler unit tests
│   ├── interceptors/
│   │   └── auth.test.ts           # Interceptor tests
│   └── integration/
│       └── monitor.integration.ts # Full flow tests
```

---

## Additional Considerations

### Health Check Endpoint
Add a simple `Health` service for load balancer probes at `/rpc`:

```protobuf
service HealthService {
  rpc Check(HealthCheckRequest) returns (HealthCheckResponse);
}

message HealthCheckRequest {}

message HealthCheckResponse {
  enum ServingStatus {
    UNKNOWN = 0;
    SERVING = 1;
    NOT_SERVING = 2;
  }
  ServingStatus status = 1;
}
```

### Request ID Propagation
- Generate `x-request-id` in logging interceptor if not present in request headers
- Propagate request ID to all downstream services and log entries
- Include request ID in error responses for debugging

### Go Code Generation
- Defer Go codegen until there are concrete Go service consumers
- Reduces maintenance burden and build complexity initially
- Can be enabled later by adding Go target to `buf.gen.yaml`

### Proto Dependency Pinning
- Use `buf.lock` to pin versions of:
  - `buf.build/bufbuild/protovalidate`
  - `buf.build/googleapis/googleapis` (if using google.protobuf types)
- Run `buf mod update` to generate/update lock file

---

## Configuration Details

### CORS Handling
- `/rpc` endpoint should inherit existing CORS configuration from Hono app
- If different CORS rules needed, configure via Hono middleware before mounting RPC routes
- Connect protocol uses standard HTTP methods (POST), no special CORS requirements

### Content-Type Support
Enable both JSON and binary formats for flexibility:
- `application/json` - Human-readable, easier debugging, slightly larger payloads
- `application/proto` - Binary format, smaller payloads, better performance
- Connect clients auto-negotiate based on `Content-Type` header

### Deadline/Timeout Propagation
- Client-specified timeouts via `connect-timeout-ms` header
- Server interceptor should:
  - Read timeout from request metadata
  - Create context with deadline
  - Cancel operations if deadline exceeded
  - Return `DEADLINE_EXCEEDED` error code on timeout

---

## Dependencies

### New Packages (packages/proto)
```json
{
  "devDependencies": {
    "@bufbuild/buf": "latest",
    "@bufbuild/protoc-gen-es": "latest",
    "@connectrpc/protoc-gen-connect-es": "latest"
  },
  "dependencies": {
    "@bufbuild/protobuf": "^2.0.0",
    "@bufbuild/protobuf-conformance": "^2.0.0"
  }
}
```

### Server App Additions
```json
{
  "dependencies": {
    "@connectrpc/connect": "^2.0.0",
    "@connectrpc/connect-node": "^2.0.0",
    "@bufbuild/protovalidate": "^0.3.0",
    "@openstatus/proto": "workspace:*"
  }
}
```

---

## Migration & Rollout

### Phase 1: Foundation
1. Create `packages/proto` with Buf setup
2. Define monitor service proto
3. Generate TypeScript and Go clients
4. Add protovalidate annotations

### Phase 2: Server Integration
1. Add ConnectRPC dependencies to server
2. Implement interceptors (auth, logging, error)
3. Mount RPC routes at `/rpc` on Hono app
4. Extract shared service layer from REST handlers

### Phase 3: Handler Implementation
1. Implement MonitorService handlers
2. Write unit tests
3. Write integration tests
4. Internal testing

### Phase 4: Release
1. Documentation
2. Client SDK examples
3. Gradual rollout via feature flag (optional)

---

## Open Questions (Resolved)

| Question | Decision |
|----------|----------|
| REST replacement or parallel? | New features only |
| Transport protocol | Connect protocol only |
| Streaming | Unary only |
| Schema approach | Schema-first (.proto) |
| Auth mechanism | Both API key + JWT |
| Proto location | Shared package |
| Tooling | Buf |
| Error details | With ErrorInfo |
| Code sharing | Shared service layer |
| Client targets | TypeScript + Go |
| Validation | protovalidate |
| Type modeling | Separate messages |
| Port strategy | Same port, /rpc prefix |
| Pagination | Offset-based |
| Rate limiting | Existing infrastructure |
| Operations style | Separate methods |
| Observability | Sentry + LogTape |
| Testing | Unit + Integration |
| Health check | Yes, HealthService |
| Request ID | Generated + propagated |
| Go codegen | Deferred |
| CORS | Inherit from Hono |
| Content-Type | JSON + Binary |
| Timeouts | connect-timeout-ms header |

---

## References

- [ConnectRPC Documentation](https://connectrpc.com/docs)
- [Buf Documentation](https://buf.build/docs)
- [protovalidate](https://github.com/bufbuild/protovalidate)
- [Google Error Model](https://cloud.google.com/apis/design/errors)

## Future work


- Implement additional services and procedure: 

  // PauseMonitor suspends monitoring.
  rpc PauseMonitor(PauseMonitorRequest) returns (PauseMonitorResponse);

  // ResumeMonitor resumes a paused monitor.
  rpc ResumeMonitor(ResumeMonitorRequest) returns (ResumeMonitorResponse);


  // UpdateMonitor modifies an existing monitor.
  rpc UpdateMonitor(UpdateMonitorRequest) returns (UpdateMonitorResponse);
