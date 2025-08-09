import { Mdx } from "@/components/content/mdx";
import { allUnrelateds } from "content-collections";

const blockYaml = allUnrelateds.find(
  (unrelated) => unrelated.slug === "yaml-file",
);

const blockCLI = allUnrelateds.find(
  (unrelated) => unrelated.slug === "cli-block",
);

export function Code() {
  if (!blockYaml) {
    throw new Error("Yaml block not found");
  }

  if (!blockCLI) {
    throw new Error("CLI block not found");
  }

  return (
    <div className="flex flex-col gap-4">
      <Mdx
        code={blockCLI.mdx}
        className="max-w-none prose-pre:overflow-hidden"
      />
      <Mdx
        code={blockYaml.mdx}
        className="max-w-none prose-pre:overflow-hidden"
      />
    </div>
  );
}
