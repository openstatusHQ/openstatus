import { z } from "zod";

import { PAGE_TYPES } from "@/content/utils";
import { searchCorpus } from "@/content/utils/search-index";

const SearchSchema = z.object({
  p: z.enum(PAGE_TYPES).nullish(),
  q: z.string().nullish(),
});

export type SearchParams = z.infer<typeof SearchSchema>;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const params = SearchSchema.safeParse({
    p: searchParams.get("p"),
    q: searchParams.get("q"),
  });

  if (!params.success) {
    console.error(params.error);
    return new Response(JSON.stringify({ error: params.error.message }), {
      status: 400,
    });
  }

  if (!params.data.p) {
    return new Response(JSON.stringify([]), { status: 200 });
  }

  const results = searchCorpus({ p: params.data.p, q: params.data.q });

  return new Response(JSON.stringify(results), { status: 200 });
}
