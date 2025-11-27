import { getPageMetadata } from "@/app/shared-metadata";
import { CustomMDX } from "@/content/mdx";
import { getToolsPage } from "@/content/utils";
import type { Metadata } from "next";
import {
  CheckerProvider,
  DetailsButtonLink,
  Form,
  ResponseStatus,
  ResultTable,
} from "./client";
import { mockCheckAllRegions } from "@/app/(pages)/(content)/play/checker/api/mock";
import { getCheckerDataById } from "@/components/ping-response-analysis/utils";
import { searchParamsCache } from "./search-params";

export function generateMetadata(): Metadata {
  const page = getToolsPage("checker");
  return getPageMetadata(page);
}

export default async function Page(props: {
  searchParams: Promise<{ id: string }>;
}) {
  const page = getToolsPage("checker");

  const searchParams = await props.searchParams;
  const { id } = searchParamsCache.parse(searchParams);

  const data = id
    ? process.env.NODE_ENV === "development"
      ? await mockCheckAllRegions()
      : await getCheckerDataById(id)
    : null;

  return (
    <section className="prose dark:prose-invert max-w-none">
      <h1>{page.metadata.title}</h1>
      <p className="text-lg">{page.metadata.description}</p>
      <CheckerProvider
        defaultValues={data?.checks.sort((a, b) => a.latency - b.latency)}
      >
        <Form defaultMethod={data?.method} defaultUrl={data?.url} />
        <ResponseStatus />
        <ResultTable />
        <DetailsButtonLink />
      </CheckerProvider>
      <CustomMDX source={page.content} />
    </section>
  );
}
