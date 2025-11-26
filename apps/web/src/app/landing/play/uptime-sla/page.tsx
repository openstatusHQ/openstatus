import { CustomMDX } from "@/content/mdx";
import { getToolsPage } from "@/content/utils";
import { Calculation } from "./client";

export default function Page() {
  const page = getToolsPage("uptime-sla");
  return (
    <section className="prose dark:prose-invert max-w-none space-y-4">
      <h1>{page.metadata.title}</h1>
      <p className="text-lg">{page.metadata.description}</p>
      <Calculation />
      <CustomMDX source={page.content} />
    </section>
  );
}
