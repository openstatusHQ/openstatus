import { getPageMetadata } from "@/app/shared-metadata";
import { CustomMDX } from "@/content/mdx";
import { getToolsPage } from "@/content/utils";
import type { Metadata } from "next";
import { Form } from "./client";

export function generateMetadata(): Metadata {
  const page = getToolsPage("curl");
  return getPageMetadata(page);
}

export default function Page() {
  const page = getToolsPage("curl");
  return (
    <section className="prose dark:prose-invert max-w-none">
      <h1>{page.metadata.title}</h1>
      <p className="text-lg">{page.metadata.description}</p>
      <Form />
      <CustomMDX source={page.content} />
    </section>
  );
}
