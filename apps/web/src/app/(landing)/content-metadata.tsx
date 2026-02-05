import { type MDXData, formatDate } from "@/content/utils";
import { getAuthor } from "@/data/author";

export function ContentMetadata({ data }: { data: MDXData }) {
  return (
    <p className="flex flex-wrap items-center gap-2.5 divide-x divide-border text-muted-foreground">
      {formatDate(data.metadata.publishedAt)} | by{" "}
      <Author author={data.metadata.author} /> | [{data.metadata.category}]
    </p>
  );
}

function Author({ author }: { author: string }) {
  const authorData = getAuthor(author);
  if (typeof authorData === "string") {
    return author;
  }

  return (
    <a href={authorData.url} target="_blank" rel="noopener noreferrer">
      {authorData.name}
    </a>
  );
}
