import { Header } from "@/components/dashboard/header";
import { SearchParamsPreset } from "@/components/monitor-dashboard/search-params-preset"; // TOO: move to shared components
import { Feed } from "@/components/status-page/feed";
import { api } from "@/trpc/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { formatter } from "./utils";

const searchParamsSchema = z.object({
  filter: z.enum(["all", "maintenances", "reports"]).optional().default("all"),
});

type Props = {
  params: { domain: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export const revalidate = 120;

export default async function Page({ params, searchParams }: Props) {
  const page = await api.page.getPageBySlug.query({ slug: params.domain });
  const search = searchParamsSchema.safeParse(searchParams);

  if (!page) return notFound();

  const filter = search.success ? search.data.filter : "all";

  return (
    <div className="grid gap-8">
      <Header
        title={page.title}
        description={page.description}
        actions={
          <SearchParamsPreset
            searchParam="filter"
            defaultValue={filter}
            values={["all", "maintenances", "reports"]}
            className="w-auto sm:w-[150px]"
            formatter={formatter}
          />
        }
        className="text-left"
      />
      <Feed
        monitors={page.monitors}
        maintenances={
          ["all", "maintenances"].includes(filter) ? page.maintenances : []
        }
        statusReports={
          ["all", "reports"].includes(filter) ? page.statusReports : []
        }
      />
    </div>
  );
}
