import { getQueryClient, trpc } from "@/lib/trpc/server";
import { notFound, unauthorized } from "next/navigation";

const _STATUS_LABELS = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
  maintenance: "Maintenance",
} as const;

export const revalidate = 60;

export async function GET(
  _request: Request,
  props: { params: Promise<{ domain: string }> },
) {
  try {
    const queryClient = getQueryClient();
    const { domain } = await props.params;

    const _page = await queryClient.fetchQuery(
      trpc.page.getPageBySlug.queryOptions({ slug: domain }),
    );

    if (!_page) return notFound();

    if (_page.passwordProtected) {
      const url = new URL(_request.url);
      const password = url.searchParams.get("pw");
      console.log({ url, _page, password });
      if (password !== _page.password) return unauthorized();
    }

    const page = await queryClient.fetchQuery(
      trpc.statusPage.get.queryOptions({ slug: domain }),
    );

    if (!page) return notFound();

    const res = {
      status: page.status,
      updatedAt: new Date(),
      monitors: page.monitors.map((monitor) => ({
        id: monitor.id,
        name: monitor.name,
        status: monitor.status,
      })),
      maintenances: page.maintenances.map((maintenance) => ({
        id: maintenance.id,
        name: maintenance.title,
        message: maintenance.message,
        from: maintenance.from,
        to: maintenance.to,
        updatedAt: maintenance.updatedAt,
        monitors: maintenance.maintenancesToMonitors.map(
          (item) => item.monitor.id,
        ),
      })),
      statusReports: page.statusReports.map((report) => ({
        id: report.id,
        title: report.title,
        updateAt: report.updatedAt,
        status: report.status,
        monitors: report.monitorsToStatusReports.map((item) => item.monitor.id),
        statusReportUpdates: report.statusReportUpdates.map((update) => ({
          id: update.id,
          status: update.status,
          message: update.message,
          date: update.date,
          updatedAt: update.updatedAt,
        })),
      })),
    };

    return new Response(JSON.stringify(res), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error generating feed:", error);
    throw error;
  }
}
