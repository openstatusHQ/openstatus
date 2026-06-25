import type { Graph } from "schema-dts";

export function JsonLd({ graph }: { graph: Graph }) {
  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      // oxlint-disable-next-line react/no-danger -- jsonLd
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(graph).replace(/</g, "\\u003c"),
      }}
    />
  );
}
