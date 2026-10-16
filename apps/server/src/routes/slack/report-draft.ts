import { getLogger } from "@logtape/logtape";
import type { ServiceContext } from "@openstatus/services";
import { listPages } from "@openstatus/services/page";
import { listPageComponents } from "@openstatus/services/page-component";
import { nanoid } from "nanoid";
import { z } from "zod";

import { redis } from "@/libs/clients";

import type { ChannelMessage } from "./channel-context";
import { generateReportDraft } from "./report-draft-model";
import { formatSlackLine } from "./thread-messages";

const logger = getLogger(["api-server", "slack", "report-draft"]);

const DRAFT_PREFIX = "slack:report-draft:";
const DRAFT_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_BACKDATE_MS = 30 * 24 * 60 * 60 * 1000;

const reportDraftSchema = z.object({
  pageId: z.number().int(),
  componentIds: z.array(z.number().int()),
  impact: z.enum(["degraded_performance", "partial_outage", "major_outage"]),
  message: z.string(),
  startedAt: z.number().int().optional(),
  startedAtSource: z.string().optional(),
});

export type ReportDraft = z.infer<typeof reportDraftSchema>;

export type DraftCandidates = {
  pages: { id: number; title: string }[];
  components: {
    id: number;
    pageId: number;
    name: string;
    failing: boolean;
  }[];
};

export async function loadDraftCandidates(
  ctx: ServiceContext,
): Promise<DraftCandidates> {
  const [pages, components] = await Promise.all([
    listPages({ ctx, input: { order: "asc" } }),
    listPageComponents({ ctx, input: { order: "asc" } }),
  ]);
  return {
    pages: pages.map((p) => ({ id: p.id, title: p.title })),
    components: components.map((c) => ({
      id: c.id,
      pageId: c.pageId,
      name: c.name,
      failing: !!c.monitor && c.monitor.status !== "active",
    })),
  };
}

function buildPrompt(args: {
  incident: { title: string; summary: string | null; startedAt: Date };
  sourceMessages: ChannelMessage[];
  candidates: DraftCandidates;
}): string {
  const { incident, sourceMessages, candidates } = args;
  const pages = candidates.pages
    .map((p) => {
      const components = candidates.components
        .filter((c) => c.pageId === p.id)
        .map(
          (c) =>
            `  - ${c.id}: ${c.name}${c.failing ? " (monitor failing)" : ""}`,
        );
      return [`- page ${p.id}: ${p.title}`, ...components].join("\n");
    })
    .join("\n");
  const conversation = sourceMessages.length
    ? sourceMessages.map(formatSlackLine).join("\n")
    : "(no channel messages)";
  return `Incident: ${incident.title}
Summary: ${incident.summary ?? "(none)"}
Declared start: ${incident.startedAt.toISOString()}

Status pages and their components:
${pages}

Channel messages before the incident was declared (oldest first, UTC):
${conversation}`;
}

const SYSTEM = `You draft the first public status report for an incident that was just declared.
- message: 1-3 short, factual sentences for customers: what is affected and that the team is investigating. No speculation about causes, no internal names, ids or people.
- pageId and componentIds: pick only from the list. Prefer components whose monitor is failing; add others only when the incident or messages clearly name them. Use an empty list when unsure, and null pageId when no page fits.
- impact: major_outage when it is down, degraded_performance when slow, partial_outage otherwise.
- startedAt: the earliest time the messages show users were affected, as ISO 8601 UTC, or null. startedAtSource says where it comes from in a few words.`;

/** Never throws: a failed draft is a card without a quote. */
export async function draftStatusReport(args: {
  incident: { title: string; summary: string | null; startedAt: Date };
  sourceMessages: ChannelMessage[];
  candidates: DraftCandidates;
}): Promise<ReportDraft | undefined> {
  const { incident, sourceMessages, candidates } = args;
  if (!candidates.pages.length) return undefined;
  try {
    const draft = await generateReportDraft({
      system: SYSTEM,
      prompt: buildPrompt({ incident, sourceMessages, candidates }),
    });
    return validateDraft(draft, candidates, incident.startedAt);
  } catch (error) {
    logger.warn("slack report draft failed", { error });
    return undefined;
  }
}

export function validateDraft(
  draft: {
    pageId: number | null;
    componentIds: number[];
    impact: ReportDraft["impact"];
    message: string;
    startedAt: string | null;
    startedAtSource: string | null;
  },
  candidates: DraftCandidates,
  incidentStartedAt: Date,
  now = new Date(),
): ReportDraft | undefined {
  // The model saw every page: its "no page fits" must not become a preselection.
  if (draft.pageId === null) return undefined;
  const failingPage = candidates.components.find((c) => c.failing)?.pageId;
  const pageId =
    candidates.pages.find((p) => p.id === draft.pageId)?.id ??
    failingPage ??
    candidates.pages[0]?.id;
  if (pageId === undefined) return undefined;
  const onPage = new Set(
    candidates.components.filter((c) => c.pageId === pageId).map((c) => c.id),
  );
  const startedAt = draft.startedAt ? new Date(draft.startedAt) : undefined;
  const backdated =
    startedAt &&
    !Number.isNaN(startedAt.getTime()) &&
    startedAt < incidentStartedAt &&
    startedAt <= now &&
    now.getTime() - startedAt.getTime() <= MAX_BACKDATE_MS;
  return {
    pageId,
    componentIds: [...new Set(draft.componentIds)].filter((id) =>
      onPage.has(id),
    ),
    impact: draft.impact,
    message: draft.message.trim(),
    ...(backdated
      ? {
          startedAt: Math.floor(startedAt.getTime() / 1000),
          ...(draft.startedAtSource
            ? { startedAtSource: draft.startedAtSource.slice(0, 200) }
            : {}),
        }
      : {}),
  };
}

export async function storeDraft(draft: ReportDraft): Promise<string> {
  const id = nanoid();
  await redis.set(`${DRAFT_PREFIX}${id}`, JSON.stringify(draft), {
    ex: DRAFT_TTL_SECONDS,
  });
  return id;
}

export async function loadDraft(id: string): Promise<ReportDraft | undefined> {
  const raw = await redis.get<string>(`${DRAFT_PREFIX}${id}`);
  if (!raw) return undefined;
  const parsed = reportDraftSchema.safeParse(
    typeof raw === "string" ? JSON.parse(raw) : raw,
  );
  return parsed.success ? parsed.data : undefined;
}
