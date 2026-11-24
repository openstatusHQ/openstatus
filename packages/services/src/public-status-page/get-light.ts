import { dbOnlyContext, type DB, getReadDb } from "../context";
import { type PageVisitor, checkPageAccess } from "../page-access";
import {
  findPageTree,
  type PublicPageTree,
  withoutGatedContent,
} from "./internal";
import { PublicPageInput } from "./schemas";

export async function getPublicStatusPageLight(args: {
  input: PublicPageInput;
  visitor: PageVisitor;
  db?: DB;
}): Promise<PublicPageTree | null> {
  const input = PublicPageInput.parse(args.input);
  const db = getReadDb(dbOnlyContext(args.db));

  const tree = await findPageTree(db, input.slug);
  if (!tree) return null;
  return (await checkPageAccess(tree, args.visitor)).ok
    ? tree
    : withoutGatedContent(tree);
}
