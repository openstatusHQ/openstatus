import { auth } from "@/lib/auth";
import { getQueryClient, trpc } from "@/lib/trpc/server";
import { notFound, unauthorized } from "next/navigation";

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

    if (_page.accessType === "password") {
      const url = new URL(_request.url);
      const password = url.searchParams.get("pw");
      console.log({ url, _page, password });
      if (password !== _page.password) return unauthorized();
    }

    if (_page.accessType === "email-domain") {
      const session = await auth();
      const user = session?.user;
      const allowedDomains = _page.authEmailDomains ?? [];
      if (!user || !user.email) return unauthorized();
      if (!allowedDomains.includes(user.email.split("@")[1]))
        return unauthorized();
    }

    const page = await queryClient.fetchQuery(
      trpc.statusPage.get.queryOptions({ slug: domain }),
    );

    if (!page) return notFound();

    const res = {
      title: page.title,
      description: page.description,
      status: page.status,
      updatedAt: new Date(),
      // @deprecated Use pageComponents instead
      monitors: page.monitors.map((monitor) => ({
        id: monitor.id,
        name: monitor.name,
        description: monitor.description,
        status: monitor.status,
      })),
      // New field - exposes the page component structure
      pageComponents: page.pageComponents.map((component) => ({
        id: component.id,
        name: component.name,
        description: component.description,
        monitorId: component.monitorId,
        order: component.order,
        groupId: component.groupId,
        groupOrder: component.groupOrder,
      })),
      pageComponentGroups: page.pageComponentGroups.map((group) => ({
        id: group.id,
        name: group.name,
      })),
      maintenances: page.maintenances.map((maintenance) => ({
        id: maintenance.id,
        name: maintenance.title,
        message: maintenance.message,
        from: maintenance.from,
        to: maintenance.to,
        updatedAt: maintenance.updatedAt,
        // @deprecated Use components instead - returning monitor IDs for backwards compatibility
        monitors: maintenance.maintenancesToPageComponents
          .map((item) => item.pageComponent.monitorId)
          .filter((id): id is number => id !== null),
        // New field - references page component IDs
        pageComponents: maintenance.maintenancesToPageComponents.map(
          (item) => item.pageComponentId,
        ),
      })),
      statusReports: page.statusReports.map((report) => ({
        id: report.id,
        title: report.title,
        updatedAt: report.updatedAt,
        status: report.status,
        // @deprecated Use components instead - returning monitor IDs for backwards compatibility
        monitors: report.statusReportsToPageComponents
          .map((item) => item.pageComponent.monitorId)
          .filter((id): id is number => id !== null),
        // New field - references page component IDs
        pageComponents: report.statusReportsToPageComponents.map(
          (item) => item.pageComponentId,
        ),
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
