// Test double for src/routes/slack/page-urls.ts (which hits the db), swapped in
// via --import-map so slack presenter tests get deterministic URLs.
export const getPageUrl = (_pageId: number): Promise<string | null> =>
  Promise.resolve("https://example.openstatus.dev");

export const getReportUrl = (
  _pageId: number,
  reportId: number,
): Promise<string | null> =>
  Promise.resolve(`https://example.openstatus.dev/events/report/${reportId}`);

export const getPageDashboardLink = (
  _workspaceId: number,
  pageId: number,
): Promise<{ title: string; url: string } | null> =>
  Promise.resolve({
    title: `Page ${pageId}`,
    url: `https://app.openstatus.dev/status-pages/${pageId}`,
  });

export const getComponentNames = (
  _workspaceId: number,
  ids: number[],
): Promise<Map<number, string>> =>
  Promise.resolve(new Map(ids.map((id) => [id, `Component ${id}`])));
