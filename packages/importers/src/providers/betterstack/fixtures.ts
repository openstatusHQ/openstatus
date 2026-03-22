import type {
  BetterstackIncident,
  BetterstackMonitor,
  BetterstackMonitorGroup,
  BetterstackStatusPage,
  BetterstackStatusPageSection,
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
    id: "bs_sec_001",
    type: "status_page_section",
    attributes: {
      name: "API Services",
      position: 0,
      status_page_id: 123456789,
    },
  },
  {
    id: "bs_sec_002",
    type: "status_page_section",
    attributes: {
      name: "Web Applications",
      position: 1,
      status_page_id: 123456789,
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
