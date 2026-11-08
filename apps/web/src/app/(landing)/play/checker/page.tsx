import type { Metadata } from "next";

import { CustomMDX } from "../../../../content/mdx";
import { getToolsPage } from "../../../../content/utils";
import { mockCheckAllRegions } from "../../../../lib/checker/mock";
import { getCheckerDataById } from "../../../../lib/checker/utils";
import { JsonLd } from "../../../../lib/metadata/json-ld";
import {
  BASE_URL,
  getPageMetadata,
} from "../../../../lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDBreadcrumbList,
  getJsonLDFAQPage,
  getJsonLDHowTo,
  getJsonLDWebPage,
} from "../../../../lib/metadata/structured-data";
import {
  CheckerProvider,
  DetailsButtonLink,
  ExportToCSVButton,
  Form,
  MonitorCta,
  ResponseStatus,
  ResultTable,
} from "./client";
import { searchParamsCache } from "./search-params";

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];

function safeUrl(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function generateMetadata(): Metadata {
  const page = getToolsPage("checker");
  return getPageMetadata(page, "play");
}

export default async function Page(props: {
  searchParams: Promise<{ id?: string; url?: string; method?: string }>;
}) {
  const page = getToolsPage("checker");

  const searchParams = await props.searchParams;
  const { id, url, method } = searchParamsCache.parse(searchParams);
  const prefillUrl = safeUrl(url);
  const prefillMethod =
    method && METHODS.includes(method.toUpperCase())
      ? method.toUpperCase()
      : undefined;

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
    getJsonLDHowTo(page),
  ]);

  return (
    <section className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
      <h1>{page.metadata.hero ?? page.metadata.title}</h1>
      <p className="text-lg">{page.metadata.description}</p>
      <CheckerProvider
        defaultValues={data?.checks.sort((a, b) => a.latency - b.latency)}
        defaultUrl={data?.url}
      >
        <Form
          defaultMethod={data?.method ?? prefillMethod}
          defaultUrl={data?.url ?? prefillUrl}
        />
        <ResponseStatus />
        <ResultTable />
        <div className="flex w-full gap-2">
          <ExportToCSVButton />
          <DetailsButtonLink />
        </div>
        <MonitorCta />
      </CheckerProvider>
      <CustomMDX source={page.content} />
    </section>
  );
}
