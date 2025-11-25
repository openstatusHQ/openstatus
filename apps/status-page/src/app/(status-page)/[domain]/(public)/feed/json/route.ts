import { getQueryClient, trpc } from "@/lib/trpc/server";
import { Tracker } from "@openstatus/tracker";
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

    const page = await queryClient.fetchQuery(
      trpc.page.getPageBySlug.queryOptions({ slug: domain }),
    );
    if (!page) return notFound();

    if (page.passwordProtected) {
      const url = new URL(_request.url);
      const password = url.searchParams.get("pw");
      console.log({ url, page, password });
      if (password !== page.password) return unauthorized();
    }

    const tracker = new Tracker({
      incidents: page.incidents,
      statusReports: page.statusReports,
      maintenances: page.maintenances,
    });

    const res = {
      status: tracker.currentStatus,
      updatedAt: new Date(),
      monitors: page.monitors.map((monitor) => ({
        id: monitor.id,
        name: monitor.name,
        status: monitor.status,
      })),
      maintenance: page.maintenances.map((maintenance) => ({
        id: maintenance.id,
        name: maintenance.title,
        message: maintenance.message,
        from: maintenance.from,
        to: maintenance.to,
      })),
      statusReports: page.statusReports.map((report) => ({
        id: report.id,
        title: report.title,
        updateAt: report.updatedAt,
        status: report.status,
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
