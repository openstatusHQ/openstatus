import { statusDict } from "@/data/incidents-dictionary";
import { api } from "@/trpc/server";
import { Feed } from "feed";
import { notFound, unauthorized } from "next/navigation";
import { getBaseUrl } from "../../utils";

export const revalidate = 60;

export async function GET(
  _request: Request,
  props: { params: Promise<{ domain: string; type: string }> },
) {
  const { domain, type } = await props.params;
  if (!["rss", "atom"].includes(type)) return notFound();

  const page = await api.page.getPageBySlug.query({ slug: domain });
  if (!page) return notFound();
  if (page.passwordProtected) return unauthorized();

  const baseUrl = getBaseUrl({
    slug: page.slug,
    customDomain: page.customDomain,
  });

  const feed = new Feed({
    id: `${baseUrl}/feed/${type}`,
    title: page.title,
    description: page.description,
    generator: "OpenStatus - Status Page updates",
    feedLinks: {
      rss: `${baseUrl}/feed/rss`,
      atom: `${baseUrl}/feed/atom`,
    },
    link: baseUrl,
    author: {
      name: "OpenStatus Team",
      email: "ping@openstatus.dev",
      link: "https://openstatus.dev",
    },
    copyright: `Copyright ${new Date().getFullYear().toString()}, OpenStatus`,
    language: "en-US",
    updated: new Date(),
    ttl: 60,
  });

  for (const maintenance of page.maintenances) {
    const maintenanceUrl = `${baseUrl}/events?filter=maintenances`;
    feed.addItem({
      id: maintenanceUrl,
      title: `Maintenance - ${maintenance.title}`,
      link: maintenanceUrl,
      description: maintenance.message,
      date: maintenance.updatedAt ?? maintenance.createdAt ?? new Date(),
    });
  }

  for (const statusReport of page.statusReports) {
    const statusReportUrl = `${baseUrl}/events/report/${statusReport.id}`;
    const status = statusDict[statusReport.status].label;
    const statusReportUpdates = statusReport.statusReportUpdates
      .map((update) => {
        const updateStatus = statusDict[update.status].label;
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

  feed.items.sort(
    (a, b) => (a.date as Date).getTime() - (b.date as Date).getTime(),
  );

  const res = type === "atom" ? feed.atom1() : feed.rss2();

  return new Response(res, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
