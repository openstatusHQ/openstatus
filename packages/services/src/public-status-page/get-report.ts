import { dbOnlyContext, type DB, getReadDb } from "../context";
import { requirePageAccess, type PageVisitor } from "../page-access";
import { findPageBySlug } from "./internal";
import { PublicPageEntityInput } from "./schemas";

export async function getPublicStatusReport(args: {
  input: PublicPageEntityInput;
  visitor: PageVisitor;
  db?: DB;
}) {
  const input = PublicPageEntityInput.parse(args.input);
  const db = getReadDb(dbOnlyContext(args.db));

  const page = await findPageBySlug(db, input.slug);
  if (!page) return null;
  await requirePageAccess(page, args.visitor);

  const row = await db.query.statusReport.findFirst({
    where: { id: input.id, pageId: page.id },
    with: {
      statusReportsToPageComponents: {
        with: { pageComponent: { with: { monitor: true } } },
      },
      statusReportUpdates: {
        orderBy: (reports, { desc }) => desc(reports.date),
        with: { statusReportUpdateToPageComponents: true },
      },
    },
  });
  return row ?? null;
}
