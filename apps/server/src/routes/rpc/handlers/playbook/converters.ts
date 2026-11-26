import type { PlaybookType as DbPlaybookType } from "@openstatus/db/src/schema/playbooks/constants";
import type { PlaybookVariables } from "@openstatus/db/src/schema/playbooks/variables";
import {
  type Playbook,
  type PlaybookSummary,
  PlaybookType,
} from "@openstatus/proto/playbook/v1";

import { invalidPlaybookTypeError } from "./errors";

const TYPE_TO_PROTO: Record<DbPlaybookType, PlaybookType> = {
  incident_response: PlaybookType.INCIDENT_RESPONSE,
  status_page: PlaybookType.STATUS_PAGE,
  maintenance_windows: PlaybookType.MAINTENANCE_WINDOWS,
  postmortem: PlaybookType.POSTMORTEM,
};

const TYPE_TO_DB: Partial<Record<PlaybookType, DbPlaybookType>> = {
  [PlaybookType.INCIDENT_RESPONSE]: "incident_response",
  [PlaybookType.STATUS_PAGE]: "status_page",
  [PlaybookType.MAINTENANCE_WINDOWS]: "maintenance_windows",
  [PlaybookType.POSTMORTEM]: "postmortem",
};

export function protoTypeToDb(type: PlaybookType): DbPlaybookType {
  const value = TYPE_TO_DB[type];
  if (!value) throw invalidPlaybookTypeError();
  return value;
}

type DBPlaybook = {
  type: DbPlaybookType;
  content: string;
  variables: PlaybookVariables | null;
  createdAt: Date;
  updatedAt: Date;
};

export function playbookSummaryToProto(row: DBPlaybook): PlaybookSummary {
  return {
    $typeName: "openstatus.playbook.v1.PlaybookSummary" as const,
    type: TYPE_TO_PROTO[row.type],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function playbookToProto(row: DBPlaybook): Playbook {
  return {
    $typeName: "openstatus.playbook.v1.Playbook" as const,
    type: TYPE_TO_PROTO[row.type],
    content: row.content,
    variables: row.variables ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
