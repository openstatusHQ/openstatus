import { CustomMDX } from "@/content/mdx";
import { getToolsPage } from "@/content/utils";
import { mockCheckAllRegions } from "@/lib/checker/mock";
import { getCheckerDataById } from "@/lib/checker/utils";
import { BASE_URL, getPageMetadata } from "@/lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDBreadcrumbList,
  getJsonLDFAQPage,
  getJsonLDWebPage,
} from "@/lib/metadata/structured-data";
import type { Metadata } from "next";
import {
  CheckerProvider,
  DetailsButtonLink,
  ExportToCSVButton,
  Form,
  ResponseStatus,
  ResultTable,
} from "./client";
import { searchParamsCache } from "./search-params";

export function generateMetadata(): Metadata {
  const page = getToolsPage("checker");
  return getPageMetadata(page, "play");
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

  const jsonLDGraph = createJsonLDGraph([
    getJsonLDWebPage(page),
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Playground", url: `${BASE_URL}/play` },
      { name: page.metadata.title, url: `${BASE_URL}/play/checker` },
    ]),
    getJsonLDFAQPage(page),
  ]);

  return (
    <section className="prose dark:prose-invert max-w-none">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLDGraph).replace(/</g, "\\u003c"),
        }}
      />
      <h1>{page.metadata.title}</h1>
      <p className="text-lg">{page.metadata.description}</p>
      <CheckerProvider
        defaultValues={data?.checks.sort((a, b) => a.latency - b.latency)}
      >
        <Form defaultMethod={data?.method} defaultUrl={data?.url} />
        <ResponseStatus />
        <ResultTable />
        <div className="flex w-full gap-2">
          <ExportToCSVButton />
          <DetailsButtonLink />
        </div>
      </CheckerProvider>
      <CustomMDX source={page.content} />
    </section>
  );
}
