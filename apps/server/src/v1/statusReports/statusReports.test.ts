import { expect, test } from "bun:test";

import { api } from "../index";

test("GET one status report", async () => {
  const res = await api.request("/status_report/1", {
    headers: {
      "x-openstatus-key": "1",
    },
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    id: 1,
    title: "Test Status Report",
    status: "monitoring",
    statusReportUpdateIds: [1, 3],
    monitorIds: null,
    pageIds: [1],
  });
});

test.skip("Get all status report", async () => {
  const res = await api.request("/status_report", {
    headers: {
      "x-openstatus-key": "1",
    },
  });
  expect(res.status).toBe(200);
  expect({ data: await res.json() }).toMatchObject({
    data: [
      {
        id: 1,
        title: "Test Status Report",
        status: "monitoring",
        statusReportUpdateIds: [1, 3],
        monitorIds: null,
        pageIds: [1],
      },
      {
        id: 2,
        title: "Test Status Report",
        status: "investigating",
        statusReportUpdateIds: [2],
        monitorIds: [1, 2],
        pageIds: [1],
      },
    ],
  });
});

test("Create one status report including passing optional fields", async () => {
  const res = await api.request("/status_report", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "New Status Report",
      message: "Message",
      monitorIds: [1],
      pageIds: [1],
    }),
  });
  const json = await res.json();

  expect(res.status).toBe(200);

  expect(json).toMatchObject({
    id: expect.any(Number),
    title: "New Status Report",
    status: "investigating",
    statusReportUpdateIds: [expect.any(Number)],
    monitorIds: [1],
    pageIds: [1],
  });
});

test("Create one status report without auth key should return 401", async () => {
  const res = await api.request("/status_report", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "Test Status Report",
    }),
  });
  expect(res.status).toBe(401); //unauthenticated
});

test("Create one status report with invalid data should return 403", async () => {
  const res = await api.request("/status_report", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      //passing incompelete body
      title: "Test Status Report",
    }),
  });
  expect(res.status).toBe(400);
});

test("Create status report with non existing monitor ids should return 400", async () => {
  const res = await api.request("/status_report", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "New Status Report",
      message: "Message",
      monitorIds: [100],
      pageIds: [1],
    }),
  });

  expect(res.status).toBe(400);
});

test("Create status report with non existing page ids should return 400", async () => {
  const res = await api.request("/status_report", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "New Status Report",
      message: "Message",
      monitorIds: [1],
      pageIds: [100],
    }),
  });

  expect(res.status).toBe(400);
});

test("Delete a status report", async () => {
  const res = await api.request("/status_report/3", {
    method: "DELETE",
    headers: {
      "x-openstatus-key": "1",
    },
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({});
});

// TODO: move to statusReportUpdate.test.ts
// test("create a status report update with empty body should return current report info", async () => {
//   const res = await api.request("/status_report/1/update", {
//     method: "POST",
//     headers: {
//       "x-openstatus-key": "1",
//       "content-type": "application/json",
//     },
//     body: JSON.stringify({}),
//   });

//   expect(res.status).toBe(200);
//   expect(await res.json()).toMatchObject({
//     id: 1,
//     title: "Test Status Report",
//     status: "investigating",
//     statusReportUpdates: [1, 3, 4],
//     message: "test",
//     monitorIds: null,
//     pageIds: [1],
//   });
// });

// test("Create status report update with non existing monitor ids should return 400", async () => {
//   const res = await api.request("/status_report/1/update", {
//     method: "POST",
//     headers: {
//       "x-openstatus-key": "1",
//       "content-type": "application/json",
//     },
//     body: JSON.stringify({
//       status: "investigating",
//       title: "New Status Report",
//       message: "Message",
//       monitors_id: [100],
//       pages_id: [1],
//     }),
//   });

//   expect(res.status).toBe(400);
//   expect(await res.json()).toMatchObject({
//     code: 400,
//     message: "monitor(s) with id [100] doesn't exist ",
//   });
// });

// test("Create status report update with non existing page ids should return 400", async () => {
//   const res = await api.request("/status_report/1/update", {
//     method: "POST",
//     headers: {
//       "x-openstatus-key": "1",
//       "content-type": "application/json",
//     },
//     body: JSON.stringify({
//       status: "investigating",
//       title: "New Status Report",
//       message: "Message",
//       monitors_id: [1],
//       pages_id: [100],
//     }),
//   });

//   expect(res.status).toBe(400);
//   expect(await res.json()).toMatchObject({
//     code: 400,
//     message: "page(s) with id [100] doesn't exist ",
//   });
// });

// test("Update with title, monitor & page should not create record in status_report_update table", async () => {
//   const res = await api.request("/status_report/1/update", {
//     method: "POST",
//     headers: {
//       "x-openstatus-key": "1",
//       "content-type": "application/json",
//     },
//     body: JSON.stringify({
//       title: "Doesn't add record",
//       monitors_id: [1],
//       pages_id: [],
//     }),
//   });

//   expect(res.status).toBe(200);
//   expect(await res.json()).toMatchObject({
//     id: 1,
//     title: "Doesn't add record",
//     status: "investigating",
//     status_report_updates: [1, 3, 4],
//     message: "test",
//     monitors_id: [1],
//     pages_id: null,
//   });
// });

// test("create a status report update", async () => {
//   const res = await api.request("/status_report/1/update", {
//     method: "POST",
//     headers: {
//       "x-openstatus-key": "1",
//       "content-type": "application/json",
//     },
//     body: JSON.stringify({
//       title: "Updated Status Report",
//       status: "resolved",
//       message: "New Message",
//       monitors_id: [1, 2],
//       pages_id: [],
//     }),
//   });
//   expect(res.status).toBe(200);

//   expect(await res.json()).toMatchObject({
//     id: 1,
//     title: "Updated Status Report",
//     status: "resolved",
//     status_report_updates: [1, 3, 4, 5],
//     message: "New Message",
//     monitors_id: [1, 2],
//     pages_id: null,
//   });
// });

// test("Create a status report update not in db should return 404", async () => {
//   const res = await api.request("/status_report/404/update", {
//     method: "POST",
//     headers: {
//       "x-openstatus-key": "1",
//       "content-type": "application/json",
//     },
//     body: JSON.stringify({
//       status: "investigating",
//       date: "2023-11-08T21:03:13.000Z",
//       message: "Test Status Report",
//     }),
//   });
//   expect(res.status).toBe(404);
//   expect(await res.json()).toMatchObject({
//     code: 404,
//     message: `status report with id 404 doesn't exist`,
//   });
// });

// test("Create a status report update without auth key should return 401", async () => {
//   const res = await api.request("/status_report/1/update", {
//     method: "POST",
//     headers: {
//       //not having the key returns unauthorized
//       "content-type": "application/json",
//     },
//     body: JSON.stringify({
//       status: "investigating",
//       date: "2023-11-08T21:03:13.000Z",
//       message: "Test Status Report",
//     }),
//   });
//   expect(res.status).toBe(401);
// });
