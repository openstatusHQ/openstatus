import { CustomMDX } from "@/content/mdx";
import { getToolsPage } from "@/content/utils";
import {
  CheckerProvider,
  DetailsButtonLink,
  Form,
  ResponseStatus,
  ResultTable,
} from "./client";

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
