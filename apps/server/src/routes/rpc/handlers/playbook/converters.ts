import {
  type PlaybookSlug,
  playbookSlugs,
} from "@openstatus/db/src/schema/playbooks/constants";
import type { PlaybookVariables } from "@openstatus/db/src/schema/playbooks/variables";
import type { Playbook, PlaybookSummary } from "@openstatus/proto/playbook/v1";

import { invalidPlaybookSlugError } from "./errors";

export function protoSlugToDb(slug: string): PlaybookSlug {
  const value = playbookSlugs.find((s) => s === slug);
  if (!value) throw invalidPlaybookSlugError(slug);
  return value;
}

type DBPlaybook = {
  slug: string;
  title: string;
  description: string;
  content: string;
  variables: PlaybookVariables | null;
  createdAt: Date;
  updatedAt: Date;
};

export function playbookSummaryToProto(row: DBPlaybook): PlaybookSummary {
  return {
    $typeName: "openstatus.playbook.v1.PlaybookSummary" as const,
    slug: row.slug,
    title: row.title,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function playbookToProto(row: DBPlaybook): Playbook {
  return {
    $typeName: "openstatus.playbook.v1.Playbook" as const,
    slug: row.slug,
    title: row.title,
    description: row.description,
    content: row.content,
    variables: row.variables ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
