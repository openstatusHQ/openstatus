import { Header } from "@/components/dashboard/header";
import { SearchParamsPreset } from "@/components/monitor-dashboard/search-params-preset"; // TOO: move to shared components
import { Feed } from "@/components/status-page/feed";
import { api } from "@/trpc/server";
import { notFound } from "next/navigation";
import { searchParamsCache } from "./search-params";
import { formatter } from "./utils";

type Props = {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const revalidate = 120;

export default async function Page(props: Props) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const { filter } = searchParamsCache.parse(searchParams);
  const page = await api.page.getPageBySlug.query({ slug: params.domain });

  if (!page) return notFound();

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
