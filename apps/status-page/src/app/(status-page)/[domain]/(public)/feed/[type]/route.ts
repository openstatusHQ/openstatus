import { auth } from "@/lib/auth";
import { getBaseUrl } from "@/lib/base-url";
import { getQueryClient, trpc } from "@/lib/trpc/server";
import { Feed } from "feed";
import { notFound, unauthorized } from "next/navigation";

const STATUS_LABELS = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
  maintenance: "Maintenance",
} as const;

export const revalidate = 60;

export async function GET(
  _request: Request,
  props: { params: Promise<{ domain: string; type: string }> },
) {
  try {
    const queryClient = getQueryClient();
    const { domain, type } = await props.params;

    if (!["rss", "atom"].includes(type)) return notFound();

    const page = await queryClient.fetchQuery(
      trpc.page.getPageBySlug.queryOptions({ slug: domain }),
    );
    if (!page) return notFound();

    if (page.accessType === "password") {
      const url = new URL(_request.url);
      const password = url.searchParams.get("pw");
      console.log({ url, page, password });
      if (password !== page.password) return unauthorized();
    }

    if (page.accessType === "email-domain") {
      const session = await auth();
      const user = session?.user;
      const allowedDomains = page.authEmailDomains ?? [];
      if (!user || !user.email) return unauthorized();
      if (!allowedDomains.includes(user.email.split("@")[1]))
        return unauthorized();
    }

    const baseUrl = getBaseUrl({
      slug: page.slug,
      customDomain: page.customDomain,
    });

    const feed = new Feed({
      id: `${baseUrl}/feed/${type}`,
      title: page.title,
      description: page.description,
      generator: "OpenStatus - Status Page Updates",
      feedLinks: {
        rss: `${baseUrl}/feed/rss`,
        atom: `${baseUrl}/feed/atom`,
      },
      link: baseUrl,
      author: {
        name: page.title,
        email:
          page.contactUrl?.startsWith("mailto:") && page.contactUrl !== null
            ? page.contactUrl.slice(7)
            : undefined,
        link: page.homepageUrl || baseUrl,
      },
      copyright: `Copyright ${new Date()
        .getFullYear()
        .toString()} openstatus.dev`,
      language: "en-US",
      updated: new Date(),
      ttl: 60,
    });

    for (const maintenance of page.maintenances ?? []) {
      const maintenanceUrl = `${baseUrl}/events/maintenance/${maintenance.id}`;
      feed.addItem({
        id: maintenanceUrl,
        title: `Maintenance - ${maintenance.title}`,
        link: maintenanceUrl,
        description: maintenance.message,
        date: maintenance.updatedAt ?? maintenance.createdAt ?? new Date(),
      });
    }

    for (const statusReport of page.statusReports ?? []) {
      const statusReportUrl = `${baseUrl}/events/report/${statusReport.id}`;
      const status = STATUS_LABELS[statusReport.status] ?? statusReport.status;
      const statusReportUpdates = (statusReport.statusReportUpdates ?? [])
        .map((update) => {
          const updateStatus = STATUS_LABELS[update.status] ?? update.status;
          return `${updateStatus}: ${update.message}.`;
        })
        .join("\n\n");

      feed.addItem({
        id: statusReportUrl,
        title: `${status} - ${statusReport.title}`,
        link: statusReportUrl,
        description: statusReportUpdates,
        date: statusReport.updatedAt ?? statusReport.createdAt ?? new Date(),
      });
    }

    feed.items.sort((a, b) => a.date.getTime() - b.date.getTime());

    const res = type === "atom" ? feed.atom1() : feed.rss2();

    return new Response(res, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error generating feed:", error);
    throw error;
  }
}
