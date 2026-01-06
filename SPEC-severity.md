# Status Report Severity Feature Specification

## Overview
Add severity levels to status reports to communicate the impact level of incidents to users and subscribers.

**Status:** ✅ Core implementation complete (2026-01-06)
**Version:** 1.0
**Author:** Based on product interview

---

## 1. Severity Levels

### 1.1 Enumeration
```typescript
type StatusReportSeverity = "informational" | "low" | "moderate" | "high" | "critical"
```

### 1.2 Definitions
- **Informational**: Announcements, planned maintenance notices, non-impacting updates
- **Low**: Minor issues with minimal user impact
- **Moderate**: Issues affecting some users or non-critical features (DEFAULT)
- **High**: Major functionality impacted, significant user impact
- **Critical**: Complete service outage or critical functionality unavailable

### 1.3 Default Value
- All new status reports default to `moderate`
- Existing reports (pre-migration) receive `moderate` as default
- Default is **not configurable** per workspace or monitor type

---

## 2. Data Model

### 2.1 Database Schema
```sql
ALTER TABLE `status_report` ADD `severity` text DEFAULT 'moderate' NOT NULL;
```

**Migration:** `packages/db/drizzle/0052_opposite_bushwacker.sql`

### 2.2 Storage Location
- Severity stored **only** on `status_report` table
- **Not** stored on `status_report_update` table
- Rationale: Severity is a property of the overall incident, not individual updates

### 2.3 Timestamp Behavior
- Changing severity **updates** `updatedAt` timestamp
- Treated as a content modification, not just metadata

### 2.4 Audit Trail
- **No automatic audit trail** for severity changes
- Changes are silent updates to the `severity` field
- No validation or rate limiting on frequency of changes

---

## 3. API Specifications

### 3.1 Request Schema
```json
POST /v1/status_report
{
  "status": "investigating",
  "severity": "high",
  "title": "Database Outage",
  "message": "Investigating connection issues",
  "date": "2026-01-06T10:00:00Z",
  "pageId": 1,
  "monitorIds": [1, 2]
}
```

### 3.2 Response Schema
```json
{
  "id": 123,
  "status": "investigating",
  "severity": "high",
  "title": "Database Outage",
  "statusReportUpdateIds": [456],
  "monitorIds": [1, 2],
  "pageId": 1
}
```

### 3.3 Backwards Compatibility
- Severity field **optional** in POST requests
- Omitted severity defaults to `moderate`
- Old API clients continue to work without modification

### 3.4 Endpoints Affected
- `POST /v1/status_report` - Accepts and stores severity
- `GET /v1/status_report/:id` - Returns severity
- `GET /v1/status_report` - Returns severity in list
- Status report update endpoints - **Do not** accept severity changes

### 3.5 OpenAPI Documentation
- Update all schema examples to include severity
- Document severity enum values
- Mark as optional field with default value

---

## 4. User Interface

### 4.1 Creation Form
**Location:** `apps/dashboard/src/components/forms/status-report/form.tsx`

**Field Order:**
1. Title
2. Status
3. **Severity** ← New field
4. Date
5. Message
6. Monitors
7. Notify Subscribers

**Component:**
- Standard Select dropdown
- Color-coded options matching severity level
- No help text or tooltips
- Mobile: Native select element (no custom optimization)

### 4.2 Edit Form
- Same as creation form
- Shows current severity value in dropdown
- No special preview or confirmation on change
- Severity changes do **not** create status updates

### 4.3 Status Reports Data Table
**Location:** `apps/dashboard/src/components/data-table/status-reports/`

**Column Order:**
```
Title | Severity | Status | Date | Monitors | Actions
```

**Display:**
- Severity shown as colored pill/badge (separate from status badge)
- **View-only** (no inline editing)
- No column sorting or filtering for severity
- Click severity badge → no action (must edit report to change)

**Color Scheme:**
```typescript
{
  informational: "text-muted-foreground/80 bg-muted/10",
  low: "text-info/80 bg-info/10",
  moderate: "text-warning/80 bg-warning/10",
  high: "text-destructive/80 bg-destructive/10",
  critical: "text-destructive bg-destructive/20 font-semibold"
}
```

### 4.4 Status Report Updates Form
- **Does not** include severity field
- Severity can only be changed by editing the parent status report
- Rationale: Severity belongs to the incident, not individual updates

---

## 5. Public Status Page

### 5.1 Display Layout
```
Database Outage [Critical] [Investigating]
└── Title      └── Severity └── Status
```

**Spacing:** Badges side by side with space separator

### 5.2 Badge Styling
- Text only with colored background (no icons/emojis)
- Same color scheme as dashboard
- Consistent pill/badge design with status indicator

### 5.3 Ordering
- **Chronological order** (newest first)
- **Not** sorted by severity
- Severity displayed as visual indicator, not organizational principle

### 5.4 Severity Treatment
- All severity levels treated equally in layout
- Informational severity **not** de-emphasized or grouped separately
- Severity badge always visible (not hidden for resolved reports)

### 5.5 Status Page History/Archive
- Historical incidents show severity badge
- Maintains severity through resolution for post-mortem analysis

---

## 6. Notifications & Communications

### 6.1 Email Subject Line
**Format:** `[{Severity}] {Title}`
- Title case severity (e.g., `[Critical]`, `[Moderate]`, `[Low]`)
- Square brackets
- Example: `[Critical] Database Outage`

### 6.2 Email Body
- No additional severity formatting required
- Subject line prefix is sufficient visual indicator

### 6.3 Subscriber Notification Rules
- **All subscribers receive emails regardless of severity**
- No severity-based notification channels or filtering
- Severity is informational for subscribers, not a routing mechanism

### 6.4 Webhook Payloads
- Include `severity` field in all webhook events
- Plain data (no special formatting)
- Example:
```json
{
  "event": "status_report.created",
  "data": {
    "id": 123,
    "severity": "critical",
    "status": "investigating",
    ...
  }
}
```

### 6.5 RSS/Atom Feeds
- Include severity in feed item metadata
- Display severity in item description or as category/tag

---

## 7. Business Logic & Validation

### 7.1 Status-Severity Relationship
- **No validation rules** between status and severity combinations
- Any severity can be paired with any status
- Resolved incidents retain their severity level (e.g., "resolved + critical" is valid)

### 7.2 Required vs Optional
- Severity **not required** (database default applies)
- Form defaulting sufficient for user experience
- No forced selection required

### 7.3 Monitor Relationship
- Severity **independent** of number of affected monitors
- No automatic severity suggestion based on monitor count or type
- No context-based defaults

### 7.4 SLA & Uptime Calculations
- Severity has **no impact** on SLA calculations
- Uptime metrics remain unchanged
- Severity used only for communication and categorization

---

## 8. Permissions & Security

### 8.1 Role-Based Access
- Same permissions as creating/editing status reports
- No separate permission layer for severity
- If user can edit report, they can change severity

### 8.2 Audit Logging
- Severity changes included in standard audit logs (if implemented)
- No special compliance or approval workflow for critical severity

---

## 9. Performance Considerations

### 9.1 Database
- No special indexes required for severity field
- Standard column, no performance optimization needed
- Existing pagination sufficient for large workspaces (100+ reports)

### 9.2 API
- Severity included in all responses (list and detail)
- No lazy loading or optional inclusion

---

## 10. Future Enhancements (Not in V1)

### 10.1 Analytics & Reporting
**Deferred to later release**
- Severity distribution charts
- Trend analysis over time
- Workspace-level severity metrics

### 10.2 Advanced Notifications
**Out of scope**
- Severity-based notification channels
- Subscriber preferences per severity
- Digest vs immediate delivery

### 10.3 Integration Formatting
**Plain data only initially**
- Slack message formatting with severity colors
- PagerDuty severity mapping
- Discord embed styling

### 10.4 Workflow Automation
**Not planned**
- Severity-based reminders or timers
- Required fields for critical incidents
- Auto-escalation based on severity + time

---

## 11. Implementation Checklist

### ✅ Completed (2026-01-06)
- [x] Database schema migration
- [x] Zod validation schemas
- [x] API request/response schemas (OpenAPI)
- [x] POST route handler updated
- [x] GET route handlers updated
- [x] API tests updated
- [x] Form schema with severity field
- [x] Form UI with severity select dropdown
- [x] Severity color styling system

### 🔲 Remaining Work
- [ ] Apply database migration to production
- [ ] Add severity to status reports data table view
- [ ] Add severity badge to public status page
- [ ] Update email subject line templates
- [ ] Include severity in webhook payloads
- [ ] Add severity to RSS/Atom feeds
- [ ] Update API documentation examples
- [ ] Add severity to status page history/archive view

---

## 12. Testing Strategy

### 12.1 Unit Tests
- ✅ API endpoint tests with severity
- ✅ Schema validation tests
- Form validation tests
- Badge rendering tests

### 12.2 Integration Tests
- Create status report with each severity level
- Edit severity and verify timestamp update
- Verify default severity for omitted field
- Email subject line formatting
- Webhook payload includes severity

### 12.3 Migration Tests
- Verify all existing reports have 'moderate' default
- API backwards compatibility (requests without severity)
- No breaking changes for existing clients

### 12.4 Visual Regression
- Severity badges render correctly in table
- Public page layout with severity + status badges
- Email subject line format
- Mobile form display

---

## 13. Deployment Notes

### 13.1 Database Migration
```bash
cd packages/db
bun run generate  # Already completed
bun run push      # Apply to database
```

### 13.2 Backwards Compatibility
- ✅ API clients without severity continue working
- ✅ Old reports get default 'moderate'
- ✅ No breaking changes

### 13.3 Rollout
1. Deploy backend changes (API + database)
2. Monitor for errors in production logs
3. Deploy frontend changes (dashboard + public page)
4. Update email templates
5. Monitor user feedback

---

## 14. Success Metrics

### Key Performance Indicators (Defer to analytics phase)
- Adoption rate: % of new status reports with non-default severity
- Distribution: Count of each severity level created
- User feedback: Support tickets related to severity feature
- API usage: Clients using severity field

---

## 15. Open Questions & Decisions

### Resolved
- ✅ Severity storage: Only on parent report, not updates
- ✅ Default value: Always moderate, not configurable
- ✅ Notification logic: No severity-based routing
- ✅ Public page ordering: Chronological, not severity-based
- ✅ Email format: `[Severity]` prefix in subject
- ✅ Analytics: Ship severity first, analytics later
- ✅ Edit behavior: Silent update, no audit trail

### Deferred
- Analytics implementation details
- Integration formatting (Slack, PagerDuty, etc.)
- Advanced filtering in data table
- Severity-based automations

---

## 16. References

### Implementation Files
- Schema: `packages/db/src/schema/status_reports/status_reports.ts`
- Validation: `packages/db/src/schema/status_reports/validation.ts`
- API Schema: `apps/server/src/routes/v1/statusReports/schema.ts`
- API Routes: `apps/server/src/routes/v1/statusReports/`
- Form: `apps/dashboard/src/components/forms/status-report/form.tsx`
- Colors: `apps/dashboard/src/data/status-report-updates.client.ts`
- Migration: `packages/db/drizzle/0052_opposite_bushwacker.sql`

### Related Documentation
- Status Report API: `/docs/api/v1/status-reports`
- Public Status Page: Documentation for status page customization
- Email Templates: Subscriber notification system

---

**Document Version:** 1.0
**Last Updated:** 2026-01-06
**Status:** Approved - Ready for remaining implementation
