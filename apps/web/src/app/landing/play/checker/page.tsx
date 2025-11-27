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

export function generateMetadata(): Metadata {
  const page = getToolsPage("checker");
  return getPageMetadata(page);
}

export default function Page() {
  const page = getToolsPage("checker");
  return (
    <section className="prose dark:prose-invert max-w-none">
      <h1>{page.metadata.title}</h1>
      <p className="text-lg">{page.metadata.description}</p>
      <CheckerProvider>
        <Form />
        <ResponseStatus />
        <ResultTable />
        <DetailsButtonLink />
      </CheckerProvider>
      <CustomMDX source={page.content} />
    </section>
  );
}
