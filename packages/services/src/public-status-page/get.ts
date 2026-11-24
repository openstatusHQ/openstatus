import { dbOnlyContext, type DB, getReadDb } from "../context";
import { type PageVisitor, checkPageAccess } from "../page-access";
import {
  componentMonitorIds,
  countActivePrivateLocations,
  findPageTree,
  type PublicPageTree,
  withoutGatedContent,
} from "./internal";
import { PublicPageInput } from "./schemas";

export type PublicStatusPage = {
  page: PublicPageTree;
  /** Active private locations per monitor on the page. */
  privateLocationCounts: Map<number, number>;
};

export async function getPublicStatusPage(args: {
  input: PublicPageInput;
  visitor: PageVisitor;
  db?: DB;
}): Promise<PublicStatusPage | null> {
  const input = PublicPageInput.parse(args.input);
  const db = getReadDb(dbOnlyContext(args.db));

  const tree = await findPageTree(db, input.slug);
  if (!tree) return null;

  const page = (await checkPageAccess(tree, args.visitor)).ok
    ? tree
    : withoutGatedContent(tree);
  const privateLocationCounts = await countActivePrivateLocations(
    db,
    componentMonitorIds(page.pageComponents),
  );
  return { page, privateLocationCounts };
}
