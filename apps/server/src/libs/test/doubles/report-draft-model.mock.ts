// Test double for slack/report-draft-model.ts, swapped in via --import-map so
// tests never call a model. Tests set `reportDraftState.impl`.
import type { ModelDraft } from "../../../routes/slack/report-draft-model.ts";

export type { ModelDraft };

type DraftArgs = { system: string; prompt: string };

export const reportDraftState: {
  impl: (args: DraftArgs) => Promise<ModelDraft>;
  calls: DraftArgs[];
} = {
  impl: () => Promise.reject(new Error("no draft configured")),
  calls: [],
};

export function generateReportDraft(args: DraftArgs): Promise<ModelDraft> {
  reportDraftState.calls.push(args);
  return reportDraftState.impl(args);
}
