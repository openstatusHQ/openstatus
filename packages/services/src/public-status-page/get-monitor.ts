import { dbOnlyContext, type DB, getReadDb } from "../context";
import { requirePageAccess, type PageVisitor } from "../page-access";
import { bySlugOrDomain } from "./internal";
import { PublicPageEntityInput } from "./schemas";

/** The page's components for monitor `id`, with the monitor; empty when it is not on the page. */
export async function getPublicStatusPageMonitor(args: {
  input: PublicPageEntityInput;
  visitor: PageVisitor;
  db?: DB;
}) {
  const input = PublicPageEntityInput.parse(args.input);
  const db = getReadDb(dbOnlyContext(args.db));

  const page = await db.query.page.findFirst({
    where: bySlugOrDomain(input.slug),
    with: {
      pageComponents: {
        where: { monitorId: input.id },
        with: { monitor: true },
      },
    },
  });
  if (!page) return null;
  await requirePageAccess(page, args.visitor);
  return page.pageComponents;
}
