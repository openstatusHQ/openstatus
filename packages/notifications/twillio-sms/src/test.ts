import { sendTextMessage } from ".";

await sendTextMessage({
  monitor: {
    id: 0,
    name: "Localhost",
    jobType: "website",
    periodicity: "other",
    status: "active",
    active: null,
    regions: [],
    url: "http://localhost:3000",
    description: "",
    headers: [],
    body: "",
    method: "GET",
    createdAt: null,
    updatedAt: null,
    workspaceId: null,
  },
  notification: {
    id: 0,
    name: "",
    data: '{"phoneNumber":"+33651831127"}',
    createdAt: null,
    updatedAt: null,
    workspaceId: null,
    provider: "email",
  },
  region: "Johannesburg, South Africa.",
  statusCode: 418,
});
