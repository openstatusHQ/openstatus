import type {
  BetterstackIncident,
  BetterstackMonitor,
  BetterstackMonitorGroup,
  BetterstackStatusPage,
  BetterstackStatusPageResource,
  BetterstackStatusPageSection,
  BetterstackStatusReport,
  BetterstackStatusUpdate,
} from "./api-types";

export const MOCK_MONITORS: BetterstackMonitor[] = [
  {
    id: "bs_mon_001",
    type: "monitor",
    attributes: {
      url: "https://api.acmecorp.com/health",
      pronounceable_name: "API Health Check",
      monitor_type: "status",
      monitor_group_id: "bs_group_001",
      http_method: "get",
      check_frequency: 180,
      request_timeout: 15,
      request_headers: [
        { id: "h1", name: "X-Custom-Header", value: "monitoring" },
      ],
      request_body: "",
      expected_status_codes: [200],
      required_keyword: null,
      verify_ssl: true,
      regions: ["us", "eu"],
      status: "up",
      paused_at: null,
      created_at: "2024-01-10T08:00:00.000Z",
      updated_at: "2024-06-01T12:00:00.000Z",
    },
  },
  {
    id: "bs_mon_002",
    type: "monitor",
    attributes: {
      url: "https://app.acmecorp.com",
      pronounceable_name: "Dashboard",
      monitor_type: "keyword",
      monitor_group_id: "bs_group_001",
      http_method: "get",
      check_frequency: 60,
      request_timeout: 30,
      request_headers: [],
      request_body: "",
      expected_status_codes: [],
      required_keyword: "Welcome",
      verify_ssl: true,
      regions: ["us", "eu", "as"],
      status: "up",
      paused_at: null,
      created_at: "2024-02-01T10:00:00.000Z",
      updated_at: "2024-06-01T12:00:00.000Z",
    },
  },
  {
    id: "bs_mon_003",
    type: "monitor",
    attributes: {
      url: "https://cdn.acmecorp.com",
      pronounceable_name: "CDN Check",
      monitor_type: "expected_status_code",
      monitor_group_id: null,
      http_method: "head",
      check_frequency: 300,
      request_timeout: 10,
      request_headers: [],
      request_body: "",
      expected_status_codes: [200, 301],
      required_keyword: null,
      verify_ssl: false,
      regions: ["us", "eu", "as", "au"],
      status: "paused",
      paused_at: "2024-05-15T00:00:00.000Z",
      created_at: "2024-03-10T09:00:00.000Z",
      updated_at: "2024-05-15T00:00:00.000Z",
    },
  },
];

export const MOCK_MONITOR_GROUPS: BetterstackMonitorGroup[] = [
  {
    id: "bs_group_001",
    type: "monitor_group",
    attributes: {
      name: "Core Services",
      sort_index: 0,
      paused: false,
      created_at: "2024-01-10T08:00:00.000Z",
      updated_at: "2024-06-01T12:00:00.000Z",
    },
  },
];

export const MOCK_STATUS_PAGES: BetterstackStatusPage[] = [
  {
    id: "bs_sp_001",
    type: "status_page",
    attributes: {
      company_name: "Acme Corp",
      company_url: "https://acmecorp.com",
      subdomain: "acmecorp",
      custom_domain: "status.acmecorp.com",
      timezone: "America/New_York",
      subscribable: true,
      aggregate_state: "operational",
      created_at: "2024-01-15T10:00:00.000Z",
      updated_at: "2024-06-01T12:00:00.000Z",
    },
  },
];

export const MOCK_STATUS_PAGE_SECTIONS: BetterstackStatusPageSection[] = [
  {
    id: "100001",
    type: "status_page_section",
    attributes: {
      name: "API Services",
      position: 0,
      status_page_id: 123456789,
    },
  },
  {
    id: "100002",
    type: "status_page_section",
    attributes: {
      name: "Web Applications",
      position: 1,
      status_page_id: 123456789,
    },
  },
];

export const MOCK_STATUS_PAGE_RESOURCES: BetterstackStatusPageResource[] = [
  {
    id: "bs_res_001",
    type: "status_page_resource",
    attributes: {
      status_page_section_id: 100001,
      resource_id: 1001,
      resource_type: "Monitor",
      public_name: "API Gateway",
      explanation: "Main API endpoint health",
      position: 0,
      widget_type: "history",
      status: "operational",
    },
  },
  {
    id: "bs_res_002",
    type: "status_page_resource",
    attributes: {
      status_page_section_id: 100001,
      resource_id: 1002,
      resource_type: "Monitor",
      public_name: "Authentication Service",
      explanation: null,
      position: 1,
      widget_type: "history",
      status: "operational",
    },
  },
  {
    id: "bs_res_003",
    type: "status_page_resource",
    attributes: {
      status_page_section_id: null,
      resource_id: 1003,
      resource_type: "Monitor",
      public_name: "CDN",
      explanation: null,
      position: 2,
      widget_type: "plain",
      status: "degraded",
    },
  },
];

export const MOCK_STATUS_REPORTS: BetterstackStatusReport[] = [
  {
    id: "bs_report_001",
    type: "status_report",
    attributes: {
      title: "API Gateway Elevated Error Rates",
      report_type: "manual",
      starts_at: "2024-06-10T14:00:00.000Z",
      ends_at: "2024-06-10T16:30:00.000Z",
      status_page_id: 123456789,
      affected_resources: [
        { status_page_resource_id: "bs_res_001", status: "downtime" },
      ],
      aggregate_state: "Downtime",
    },
  },
  {
    id: "bs_report_002",
    type: "status_report",
    attributes: {
      title: "Dashboard Slow Responses",
      report_type: "manual",
      starts_at: "2024-06-11T09:00:00.000Z",
      ends_at: null,
      status_page_id: 123456789,
      affected_resources: [
        { status_page_resource_id: "bs_res_002", status: "degraded" },
      ],
      aggregate_state: "Degraded",
    },
  },
  {
    id: "bs_report_003",
    type: "status_report",
    attributes: {
      title: "Scheduled Database Maintenance",
      report_type: "maintenance",
      starts_at: "2024-06-15T02:00:00.000Z",
      ends_at: "2024-06-15T06:00:00.000Z",
      status_page_id: 123456789,
      affected_resources: [
        { status_page_resource_id: "bs_res_001", status: "maintenance" },
        { status_page_resource_id: "bs_res_002", status: "maintenance" },
      ],
      aggregate_state: "Maintenance",
    },
  },
];

export const MOCK_STATUS_UPDATES_REPORT_001: BetterstackStatusUpdate[] = [
  {
    id: "bs_update_001",
    type: "status_update",
    attributes: {
      message: "We are investigating elevated error rates on the API Gateway.",
      published_at: "2024-06-10T14:05:00.000Z",
      affected_resources: [
        { status_page_resource_id: "bs_res_001", status: "downtime" },
      ],
      status_report_id: 1,
    },
  },
  {
    id: "bs_update_002",
    type: "status_update",
    attributes: {
      message:
        "The root cause has been identified as an upstream provider issue.",
      published_at: "2024-06-10T14:30:00.000Z",
      affected_resources: [
        { status_page_resource_id: "bs_res_001", status: "downtime" },
      ],
      status_report_id: 1,
    },
  },
  {
    id: "bs_update_003",
    type: "status_update",
    attributes: {
      message: "The issue has been resolved. All systems are operational.",
      published_at: "2024-06-10T16:30:00.000Z",
      affected_resources: [
        { status_page_resource_id: "bs_res_001", status: "resolved" },
      ],
      status_report_id: 1,
    },
  },
];

export const MOCK_STATUS_UPDATES_REPORT_002: BetterstackStatusUpdate[] = [
  {
    id: "bs_update_004",
    type: "status_update",
    attributes: {
      message: "We are aware of slow response times on the dashboard.",
      published_at: "2024-06-11T09:10:00.000Z",
      affected_resources: [
        { status_page_resource_id: "bs_res_002", status: "degraded" },
      ],
      status_report_id: 2,
    },
  },
];

export const MOCK_STATUS_UPDATES_REPORT_003: BetterstackStatusUpdate[] = [
  {
    id: "bs_update_005",
    type: "status_update",
    attributes: {
      message: "Scheduled database maintenance will begin shortly.",
      published_at: "2024-06-15T01:55:00.000Z",
      affected_resources: [
        { status_page_resource_id: "bs_res_001", status: "maintenance" },
        { status_page_resource_id: "bs_res_002", status: "maintenance" },
      ],
      status_report_id: 3,
    },
  },
  {
    id: "bs_update_006",
    type: "status_update",
    attributes: {
      message: "Maintenance completed successfully.",
      published_at: "2024-06-15T05:30:00.000Z",
      affected_resources: [
        { status_page_resource_id: "bs_res_001", status: "resolved" },
        { status_page_resource_id: "bs_res_002", status: "resolved" },
      ],
      status_report_id: 3,
    },
  },
];

export const MOCK_INCIDENTS: BetterstackIncident[] = [
  {
    id: "bs_inc_001",
    type: "incident",
    attributes: {
      name: "API Gateway Outage",
      url: "https://api.acmecorp.com/health",
      cause: "Upstream provider failure caused 502 errors",
      started_at: "2024-06-10T14:00:00.000Z",
      acknowledged_at: "2024-06-10T14:15:00.000Z",
      resolved_at: "2024-06-10T16:30:00.000Z",
      status: "resolved",
      regions: ["us", "eu"],
    },
  },
  {
    id: "bs_inc_002",
    type: "incident",
    attributes: {
      name: "Dashboard Slow Responses",
      url: "https://app.acmecorp.com",
      cause: "Database connection pool exhaustion",
      started_at: "2024-06-11T09:00:00.000Z",
      acknowledged_at: "2024-06-11T09:30:00.000Z",
      resolved_at: null,
      status: "acknowledged",
      regions: ["us"],
    },
  },
  {
    id: "bs_inc_003",
    type: "incident",
    attributes: {
      name: null,
      url: "https://cdn.acmecorp.com",
      cause: null,
      started_at: "2024-06-12T06:00:00.000Z",
      acknowledged_at: null,
      resolved_at: "2024-06-12T06:05:00.000Z",
      status: "resolved",
      regions: ["au"],
    },
  },
];
