import { CustomMDX } from "@/content/mdx";
import { getUnrelatedPage } from "@/content/utils";

export default function NotFound() {
  const page = getUnrelatedPage("not-found");
  return (
    <section className="prose dark:prose-invert max-w-none">
      <h1>{page.metadata.title}</h1>
      <p className="text-lg">{page.metadata.description}</p>
      <CustomMDX source={page.content} />
    </section>
  );
}
