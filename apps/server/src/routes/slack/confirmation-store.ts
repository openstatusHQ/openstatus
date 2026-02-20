import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import { nanoid } from "nanoid";

type CreateStatusReportAction = {
  type: "createStatusReport";
  params: {
    title: string;
    status: "investigating" | "identified" | "monitoring" | "resolved";
    message: string;
    pageId: number;
    pageComponentIds?: string[];
  };
};

type AddStatusReportUpdateAction = {
  type: "addStatusReportUpdate";
  params: {
    statusReportId: number;
    status: "investigating" | "identified" | "monitoring" | "resolved";
    message: string;
  };
};

type UpdateStatusReportAction = {
  type: "updateStatusReport";
  params: {
    statusReportId: number;
    title?: string;
    pageComponentIds?: string[];
  };
};

type ResolveStatusReportAction = {
  type: "resolveStatusReport";
  params: {
    statusReportId: number;
    message: string;
  };
};

export type PendingAction = {
  id: string;
  workspaceId: number;
  limits: Limits;
  channelId: string;
  threadTs: string;
  messageTs: string;
  userId: string;
  createdAt: number;
  action:
    | CreateStatusReportAction
    | AddStatusReportUpdateAction
    | UpdateStatusReportAction
    | ResolveStatusReportAction;
};

const TTL_MS = 5 * 60 * 1000;

const actions = new Map<string, PendingAction>();
const threadIndex = new Map<string, string>();

function cleanup() {
  const now = Date.now();
  for (const [id, action] of actions) {
    if (now - action.createdAt > TTL_MS) {
      actions.delete(id);
      if (threadIndex.get(action.threadTs) === id) {
        threadIndex.delete(action.threadTs);
      }
    }
  }
}

export function store(action: Omit<PendingAction, "id" | "createdAt">): string {
  cleanup();
  const id = nanoid();
  const pending: PendingAction = { ...action, id, createdAt: Date.now() };
  actions.set(id, pending);
  threadIndex.set(action.threadTs, id);
  return id;
}

export function retrieve(actionId: string): PendingAction | undefined {
  const action = actions.get(actionId);
  if (!action) return undefined;
  if (Date.now() - action.createdAt > TTL_MS) {
    actions.delete(actionId);
    if (threadIndex.get(action.threadTs) === actionId) {
      threadIndex.delete(action.threadTs);
    }
    return undefined;
  }
  actions.delete(actionId);
  if (threadIndex.get(action.threadTs) === actionId) {
    threadIndex.delete(action.threadTs);
  }
  return action;
}

export function findByThread(threadTs: string): PendingAction | undefined {
  const actionId = threadIndex.get(threadTs);
  if (!actionId) return undefined;
  const action = actions.get(actionId);
  if (!action) {
    threadIndex.delete(threadTs);
    return undefined;
  }
  if (Date.now() - action.createdAt > TTL_MS) {
    actions.delete(actionId);
    threadIndex.delete(threadTs);
    return undefined;
  }
  return action;
}

export function replace(
  actionId: string,
  newAction: PendingAction["action"],
): void {
  const existing = actions.get(actionId);
  if (!existing) return;
  existing.action = newAction;
  existing.createdAt = Date.now();
}
