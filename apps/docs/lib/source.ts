import { docs } from "collections/server";
import { loader } from "fumadocs-core/source";

export const source = loader({
  baseUrl: "/",
  source: docs.toFumadocsSource(),
  pageTree: {
    transformers: [
      {
        file(node) {
          const file = this.storage.read(node.$ref?.file ?? "");
          if (
            file &&
            "data" in file &&
            "sidebar_label" in file.data &&
            file.data.sidebar_label
          ) {
            return {
              ...node,
              name: file.data.sidebar_label as string,
            };
          }
          return node;
        },
      },
    ],
  },
});
