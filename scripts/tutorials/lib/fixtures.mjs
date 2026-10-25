// The seeded rows tutorials build on (packages/db/src/seed.mts). A seed
// change is an edit here, not in every tutorial.
export const workspace = 1;

export const pages = {
  // "Acme Inc.": slug `status`, carries the seeded reports and maintenances.
  main: 1,
  // "Acme Enterprise": no components, a made-up custom domain.
  enterprise: 2,
};

export const monitors = {
  api: "API",
  website: "Website",
  search: "Search",
  legacy: "Legacy Dashboard",
};

const q = (sql, ...params) => ({ q: sql, params });

// Statements that remove what a tutorial created on an earlier run, scoped to
// the seeded workspace or page so nothing else matches.
export const cleanup = {
  page: ({ slug }) => [
    q("delete from page where slug = ? and workspace_id = ?", slug, workspace),
  ],
  monitor: ({ name }) => [
    q(
      "delete from monitor where name = ? and workspace_id = ?",
      name,
      workspace,
    ),
  ],
  pageComponents: ({ pageId }) => [
    q("delete from page_component where page_id = ?", pageId),
  ],
  notification: ({ name }) => {
    const ids =
      "select id from notification where name = ? and workspace_id = ?";
    return [
      q(
        `delete from notifications_to_monitors where notification_id in (${ids})`,
        name,
        workspace,
      ),
      q(`delete from notification where id in (${ids})`, name, workspace),
    ];
  },
  statusReport: ({ title, pageId }) => {
    const ids = "select id from status_report where title = ? and page_id = ?";
    return [
      q(
        `delete from status_report_update_to_page_component where status_report_update_id in (select id from status_report_update where status_report_id in (${ids}))`,
        title,
        pageId,
      ),
      q(
        `delete from status_report_update where status_report_id in (${ids})`,
        title,
        pageId,
      ),
      q(
        `delete from status_report_to_page_component where status_report_id in (${ids})`,
        title,
        pageId,
      ),
      q(`delete from status_report where id in (${ids})`, title, pageId),
    ];
  },
  maintenance: ({ title, pageId }) => {
    const ids = "select id from maintenance where title = ? and page_id = ?";
    return [
      q(
        `delete from maintenance_update where maintenance_id in (${ids})`,
        title,
        pageId,
      ),
      q(
        `delete from maintenance_to_page_component where maintenance_id in (${ids})`,
        title,
        pageId,
      ),
      q(`delete from maintenance where id in (${ids})`, title, pageId),
    ];
  },
};
