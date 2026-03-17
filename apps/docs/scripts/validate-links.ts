import { source } from "@/lib/source";
import type { InferPageType } from "fumadocs-core/source";
import {
  type FileObject,
  printErrors,
  scanURLs,
  validateFiles,
} from "next-validate-link";

async function checkLinks() {
  const scanned = await scanURLs({
    preset: "next",
    populate: {
      "[[...slug]]": source.getPages().map((page) => {
        return {
          value: {
            slug: page.slugs,
          },
          hashes: getHeadings(page),
        };
      }),
    },
  });

  printErrors(
    await validateFiles(await getFiles(), {
      scanned,
      markdown: {
        components: {
          Card: { attributes: ["href"] },
        },
      },
      checkRelativePaths: "as-url",
    }),
    true,
  );
}

function getHeadings({ data }: InferPageType<typeof source>): string[] {
  return data.toc.map((item) => item.url.slice(1));
}

function getFiles() {
  const promises = source.getPages().map(
    async (page): Promise<FileObject> => ({
      path: page.absolutePath ?? "",
      content: await page.data.getText("raw"),
      url: page.url,
      data: page.data,
    }),
  );

  return Promise.all(promises);
}

void checkLinks();
