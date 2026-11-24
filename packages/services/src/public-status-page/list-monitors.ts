import { dbOnlyContext, type DB, getReadDb } from "../context";
import { requirePageAccess, type PageVisitor } from "../page-access";
import { bySlugOrDomain } from "./internal";
import { PublicPageInput } from "./schemas";

/** The page's components with their monitors; the caller filters for public ones. */
export async function listPublicStatusPageMonitors(args: {
  input: PublicPageInput;
  visitor: PageVisitor;
  db?: DB;
}) {
  const input = PublicPageInput.parse(args.input);
  const db = getReadDb(dbOnlyContext(args.db));

  const page = await db.query.page.findFirst({
    where: bySlugOrDomain(input.slug),
    with: { pageComponents: { with: { monitor: true } } },
  });
  if (!page) return null;
  await requirePageAccess(page, args.visitor);
  return page.pageComponents;
}
