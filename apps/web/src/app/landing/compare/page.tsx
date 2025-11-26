import { components } from "@/content/mdx";
import { getComparePages } from "@/content/utils";
import {
  ContentBoxDescription,
  ContentBoxLink,
  ContentBoxTitle,
  ContentBoxUrl,
} from "../content-box";

export default function Page() {
  return (
    <section className="prose dark:prose-invert max-w-none">
      <h1>Compare openstatus with uptime and status page solutions</h1>
      <components.Grid cols={2}>
        {getComparePages().map((page) => (
          <ContentBoxLink
            key={page.slug}
            href={`/landing/compare/${page.slug}`}
          >
            <ContentBoxTitle>{page.metadata.title}</ContentBoxTitle>
            <ContentBoxDescription>
              {page.metadata.description}
            </ContentBoxDescription>
            <ContentBoxUrl url="Read more" />
          </ContentBoxLink>
        ))}
      </components.Grid>
    </section>
  );
}
