# Status Report Proto Implementation Plan

## Overview

Create proto definitions for Status Report CRUD operations, following the existing patterns in `packages/proto/api/openstatus/monitor/v1/`.

## Directory Structure

```
packages/proto/api/openstatus/status_report/
└── v1/
    ├── status_report.proto    # Message definitions
    └── service.proto          # Service and RPC definitions
```

## Database Schema Reference

From `packages/db/src/schema/status_reports/status_reports.ts`:

### StatusReport Table
| Field | Type | Constraints |
|-------|------|-------------|
| id | integer | primary key |
| status | enum | "investigating", "identified", "monitoring", "resolved" |
| title | text(256) | not null |
| workspaceId | integer | foreign key |
| pageId | integer | foreign key (cascade delete) |
| createdAt | timestamp | default now |
| updatedAt | timestamp | default now |

### StatusReportUpdate Table
| Field | Type | Constraints |
|-------|------|-------------|
| id | integer | primary key |
| status | enum | same as above |
| date | timestamp | not null |
| message | text | not null |
| statusReportId | integer | foreign key, not null (cascade delete) |
| createdAt | timestamp | default now |
| updatedAt | timestamp | default now |

### Relationships
- StatusReport has many StatusReportUpdates
- StatusReport belongs to Workspace
- StatusReport can be linked to multiple PageComponents (via `statusReportsToPageComponents` junction table)
- Legacy: StatusReport belongs to Page (deprecated, use page components instead)
- Legacy: StatusReport can be linked to Monitors (via `monitorsToStatusReport`, deprecated)

---

## Proto Definitions

### File 1: `status_report.proto`

```protobuf
syntax = "proto3";

package openstatus.status_report.v1;

option go_package = "github.com/openstatushq/openstatus/packages/proto/openstatus/status_report/v1;statusreportv1";

// StatusReportStatus represents the current state of a status report.
enum StatusReportStatus {
  STATUS_REPORT_STATUS_UNSPECIFIED = 0;
  STATUS_REPORT_STATUS_INVESTIGATING = 1;
  STATUS_REPORT_STATUS_IDENTIFIED = 2;
  STATUS_REPORT_STATUS_MONITORING = 3;
  STATUS_REPORT_STATUS_RESOLVED = 4;
}

// StatusReportUpdate represents a single update entry in a status report timeline.
message StatusReportUpdate {
  // Unique identifier for the update.
  string id = 1;

  // Status at the time of this update.
  StatusReportStatus status = 2;

  // Timestamp when this update occurred (RFC 3339 format).
  string date = 3;

  // Message describing the update.
  string message = 4;

  // Timestamp when the update was created (RFC 3339 format).
  string created_at = 5;
}

// StatusReportSummary represents metadata for a status report (used in list responses).
message StatusReportSummary {
  // Unique identifier for the status report.
  string id = 1;

  // Current status of the report.
  StatusReportStatus status = 2;

  // Title of the status report.
  string title = 3;

  // IDs of affected page components.
  repeated string page_component_ids = 4;

  // Timestamp when the report was created (RFC 3339 format).
  string created_at = 5;

  // Timestamp when the report was last updated (RFC 3339 format).
  string updated_at = 6;
}

// StatusReport represents an incident or maintenance report with full details.
message StatusReport {
  // Unique identifier for the status report.
  string id = 1;

  // Current status of the report.
  StatusReportStatus status = 2;

  // Title of the status report.
  string title = 3;

  // IDs of affected page components.
  repeated string page_component_ids = 4;

  // Timeline of updates for this report (only included in GetStatusReport).
  repeated StatusReportUpdate updates = 5;

  // Timestamp when the report was created (RFC 3339 format).
  string created_at = 6;

  // Timestamp when the report was last updated (RFC 3339 format).
  string updated_at = 7;
}
```

### File 2: `service.proto`

```protobuf
syntax = "proto3";

package openstatus.status_report.v1;

import "buf/validate/validate.proto";
import "openstatus/status_report/v1/status_report.proto";

option go_package = "github.com/openstatushq/openstatus/packages/proto/openstatus/status_report/v1;statusreportv1";

// StatusReportService provides CRUD operations for status reports.
service StatusReportService {
  // CreateStatusReport creates a new status report.
  rpc CreateStatusReport(CreateStatusReportRequest) returns (CreateStatusReportResponse);

  // GetStatusReport retrieves a specific status report by ID (includes full update timeline).
  rpc GetStatusReport(GetStatusReportRequest) returns (GetStatusReportResponse);

  // ListStatusReports returns all status reports for the workspace (metadata only).
  rpc ListStatusReports(ListStatusReportsRequest) returns (ListStatusReportsResponse);

  // UpdateStatusReport updates the metadata of a status report (title, page, monitors).
  rpc UpdateStatusReport(UpdateStatusReportRequest) returns (UpdateStatusReportResponse);

  // DeleteStatusReport removes a status report and all its updates.
  rpc DeleteStatusReport(DeleteStatusReportRequest) returns (DeleteStatusReportResponse);

  // AddStatusReportUpdate adds a new update to an existing status report timeline.
  rpc AddStatusReportUpdate(AddStatusReportUpdateRequest) returns (AddStatusReportUpdateResponse);
}

// --- Create Status Report ---

message CreateStatusReportRequest {
  // Title of the status report (required).
  string title = 1 [(buf.validate.field).string.min_len = 1];

  // Initial status (required).
  StatusReportStatus status = 2 [(buf.validate.field).enum.defined_only = true];

  // Initial message describing the incident (required).
  string message = 3 [(buf.validate.field).string.min_len = 1];

  // Date when the event occurred (RFC 3339 format, required).
  string date = 4 [(buf.validate.field).string.min_len = 1];

  // Page component IDs to associate with this report (required).
  repeated string page_component_ids = 5 [(buf.validate.field).repeated.min_items = 1];
}

message CreateStatusReportResponse {
  // The created status report.
  StatusReport status_report = 1;
}

// --- Get Status Report ---

message GetStatusReportRequest {
  // ID of the status report to retrieve (required).
  string id = 1 [(buf.validate.field).string.min_len = 1];
}

message GetStatusReportResponse {
  // The requested status report.
  StatusReport status_report = 1;
}

// --- List Status Reports ---

message ListStatusReportsRequest {
  // Maximum number of reports to return (1-100, defaults to 50).
  optional int32 limit = 1 [(buf.validate.field).int32 = {
    gte: 1
    lte: 100
  }];

  // Number of reports to skip for pagination (defaults to 0).
  optional int32 offset = 2 [(buf.validate.field).int32.gte = 0];

  // Filter by status (optional). If empty, returns all statuses.
  repeated StatusReportStatus statuses = 3;
}

message ListStatusReportsResponse {
  // List of status reports (metadata only, use GetStatusReport for full details).
  repeated StatusReportSummary status_reports = 1;

  // Total number of reports matching the filter.
  int32 total_size = 2;
}

// --- Update Status Report ---

message UpdateStatusReportRequest {
  // ID of the status report to update (required).
  string id = 1 [(buf.validate.field).string.min_len = 1];

  // New title for the report (optional).
  optional string title = 2;

  // New list of page component IDs (optional, replaces existing list).
  repeated string page_component_ids = 3;
}

message UpdateStatusReportResponse {
  // The updated status report.
  StatusReport status_report = 1;
}

// --- Delete Status Report ---

message DeleteStatusReportRequest {
  // ID of the status report to delete (required).
  string id = 1 [(buf.validate.field).string.min_len = 1];
}

message DeleteStatusReportResponse {
  // Whether the deletion was successful.
  bool success = 1;
}

// --- Add Status Report Update ---

message AddStatusReportUpdateRequest {
  // ID of the status report to update (required).
  string status_report_id = 1 [(buf.validate.field).string.min_len = 1];

  // New status for the report (required).
  StatusReportStatus status = 2 [(buf.validate.field).enum.defined_only = true];

  // Message describing what changed (required).
  string message = 3 [(buf.validate.field).string.min_len = 1];

  // Optional date for the update. Defaults to current time if not provided.
  optional string date = 4;
}

message AddStatusReportUpdateResponse {
  // The updated status report with the new update included.
  StatusReport status_report = 1;
}
```

---

## Questions Resolved

Based on the database schema:

1. **Status Report Structure**: Uses `id`, `status`, `title`, `workspaceId`, `createdAt`, `updatedAt`
2. **Updates**: Separate table `status_report_update` with timeline entries (id, status, date, message, statusReportId)
3. **Status Values**: `investigating`, `identified`, `monitoring`, `resolved`
4. **Relationships**: Links to PageComponents (many-to-many via `statusReportsToPageComponents` junction table)

---

## Implementation Notes

1. **Workspace ID**: Not included in request/response as it should be derived from the authenticated context (API key belongs to workspace)
2. **Timestamps**: Use RFC 3339 format strings for interoperability
3. **Pagination**: Uses offset-based pagination with `limit` and `offset` parameters
4. **Validation**: Use `buf.validate` for field validation

---

## Decisions Made

1. **Delete Operation**: Yes - `DeleteStatusReport` RPC added (cascade deletes all updates)
2. **Update Status Report**: Yes - `UpdateStatusReport` RPC added to modify title/page/monitors without creating a timeline entry
3. **Filtering**: `ListStatusReports` supports filtering by status only (via `statuses` field)
4. **Include Updates**: `ListStatusReports` returns `StatusReportSummary` (metadata only), `GetStatusReport` returns full `StatusReport` with update timeline
