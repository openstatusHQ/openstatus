import type {
  InstatusComponent,
  InstatusIncident,
  InstatusMaintenance,
  InstatusPage,
  InstatusSubscriber,
} from "./api-types";

export const MOCK_PAGES: InstatusPage[] = [
  {
    id: "in_page_001",
    name: "Acme Corp Status",
    subdomain: "acmecorp",
    customDomain: "status.acmecorp.com",
    status: "UP",
    logoUrl: "https://instatus.com/logo.png",
    faviconUrl: "https://instatus.com/favicon.png",
    websiteUrl: "https://acmecorp.com",
    language: "en",
    createdAt: "2024-01-15T10:00:00.000Z",
    updatedAt: "2024-06-01T12:00:00.000Z",
  },
];

export const MOCK_COMPONENTS: InstatusComponent[] = [
  {
    id: "in_comp_group_001",
    name: "Core Services",
    description: "Core infrastructure services",
    status: "OPERATIONAL",
    order: 0,
    group: null,
    showUptime: true,
    grouped: false,
  },
  {
    id: "in_comp_001",
    name: "API Gateway",
    description: "Main API gateway for all services",
    status: "OPERATIONAL",
    order: 1,
    group: "in_comp_group_001",
    showUptime: true,
    grouped: true,
  },
  {
    id: "in_comp_002",
    name: "Authentication Service",
    description: "Handles user authentication and authorization",
    status: "OPERATIONAL",
    order: 2,
    group: "in_comp_group_001",
    showUptime: true,
    grouped: true,
  },
  {
    id: "in_comp_003",
    name: "Dashboard",
    description: "Web dashboard application",
    status: "DEGRADEDPERFORMANCE",
    order: 3,
    group: null,
    showUptime: true,
    grouped: false,
  },
  {
    id: "in_comp_004",
    name: "CDN",
    description: null,
    status: "OPERATIONAL",
    order: 4,
    group: null,
    showUptime: false,
    grouped: false,
  },
];

export const MOCK_INCIDENTS: InstatusIncident[] = [
  {
    id: "in_incident_001",
    name: "API Gateway Elevated Error Rates",
    status: "RESOLVED",
    started: "2024-06-10T14:00:00.000Z",
    resolved: "2024-06-10T16:45:00.000Z",
    updates: [
      {
        id: "in_update_001",
        message:
          "We are investigating elevated error rates on the API Gateway.",
        messageHtml:
          "<p>We are investigating elevated error rates on the API Gateway.</p>",
        status: "INVESTIGATING",
        notify: true,
        started: "2024-06-10T14:00:00.000Z",
        createdAt: "2024-06-10T14:00:00.000Z",
      },
      {
        id: "in_update_002",
        message:
          "The issue has been identified as a misconfigured load balancer rule.",
        messageHtml:
          "<p>The issue has been identified as a misconfigured load balancer rule.</p>",
        status: "IDENTIFIED",
        notify: true,
        started: "2024-06-10T14:30:00.000Z",
        createdAt: "2024-06-10T14:30:00.000Z",
      },
      {
        id: "in_update_003",
        message: "A fix has been deployed and we are monitoring the results.",
        messageHtml:
          "<p>A fix has been deployed and we are monitoring the results.</p>",
        status: "MONITORING",
        notify: true,
        started: "2024-06-10T16:00:00.000Z",
        createdAt: "2024-06-10T16:00:00.000Z",
      },
      {
        id: "in_update_004",
        message:
          "The issue has been fully resolved. Error rates are back to normal.",
        messageHtml:
          "<p>The issue has been fully resolved. Error rates are back to normal.</p>",
        status: "RESOLVED",
        notify: true,
        started: "2024-06-10T16:45:00.000Z",
        createdAt: "2024-06-10T16:45:00.000Z",
      },
    ],
    components: ["in_comp_001"],
  },
  {
    id: "in_incident_002",
    name: "Dashboard Slow Response Times",
    status: "IDENTIFIED",
    started: "2024-06-11T09:00:00.000Z",
    resolved: null,
    updates: [
      {
        id: "in_update_005",
        message:
          "We are investigating reports of slow response times on the Dashboard.",
        messageHtml:
          "<p>We are investigating reports of slow response times on the Dashboard.</p>",
        status: "INVESTIGATING",
        notify: true,
        started: "2024-06-11T09:00:00.000Z",
        createdAt: "2024-06-11T09:00:00.000Z",
      },
      {
        id: "in_update_006",
        message:
          "The issue has been traced to a slow database query affecting the main dashboard view.",
        messageHtml:
          "<p>The issue has been traced to a slow database query affecting the main dashboard view.</p>",
        status: "IDENTIFIED",
        notify: true,
        started: "2024-06-11T09:45:00.000Z",
        createdAt: "2024-06-11T09:45:00.000Z",
      },
    ],
    components: ["in_comp_003"],
  },
];

export const MOCK_MAINTENANCES: InstatusMaintenance[] = [
  {
    id: "in_maint_001",
    name: "Scheduled Database Maintenance",
    status: "NOTSTARTEDYET",
    start: "2024-06-20T02:00:00.000Z",
    duration: 240,
    updates: [
      {
        id: "in_maint_update_001",
        message:
          "We will be performing scheduled database maintenance. Some services may experience brief interruptions.",
        messageHtml:
          "<p>We will be performing scheduled database maintenance. Some services may experience brief interruptions.</p>",
        status: "NOTSTARTEDYET",
        notify: true,
        started: "2024-06-12T10:00:00.000Z",
      },
    ],
    components: ["in_comp_001", "in_comp_002"],
  },
  {
    id: "in_maint_002",
    name: "CDN Cache Purge",
    status: "COMPLETED",
    start: "2024-06-15T03:00:00.000Z",
    duration: 30,
    updates: [
      {
        id: "in_maint_update_002",
        message: "Starting CDN cache purge.",
        messageHtml: "<p>Starting CDN cache purge.</p>",
        status: "INPROGRESS",
        notify: true,
        started: "2024-06-15T03:00:00.000Z",
      },
      {
        id: "in_maint_update_003",
        message: "Cache purge completed successfully.",
        messageHtml: "<p>Cache purge completed successfully.</p>",
        status: "COMPLETED",
        notify: true,
        started: "2024-06-15T03:25:00.000Z",
      },
    ],
    components: ["in_comp_004"],
  },
];

export const MOCK_SUBSCRIBERS: InstatusSubscriber[] = [
  {
    id: "in_sub_001",
    email: "alice@acmecorp.com",
    phone: null,
    webhook: null,
    confirmed: true,
    all: true,
    components: [],
  },
  {
    id: "in_sub_002",
    email: "bob@acmecorp.com",
    phone: null,
    webhook: null,
    confirmed: true,
    all: false,
    components: ["in_comp_001", "in_comp_003"],
  },
  {
    id: "in_sub_003",
    email: null,
    phone: "+15551234567",
    webhook: null,
    confirmed: true,
    all: true,
    components: [],
  },
  {
    id: "in_sub_004",
    email: null,
    phone: null,
    webhook: "https://hooks.acmecorp.com/instatus",
    confirmed: true,
    all: true,
    components: [],
  },
  {
    id: "in_sub_005",
    email: null,
    phone: null,
    webhook: null,
    confirmed: true,
    all: true,
    components: [],
  },
];
