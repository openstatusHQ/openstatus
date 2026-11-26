import type { ServiceImpl } from "@connectrpc/connect";
import type { PlaybookService } from "@openstatus/proto/playbook/v1";
import {
  clearPlaybook,
  getPlaybook,
  listPlaybooks,
  savePlaybook,
} from "@openstatus/services/playbook";

import { toConnectError, toServiceCtx } from "../../adapter";
import { getRpcContext } from "../../interceptors";
import { playbookSummaryToProto, playbookToProto } from "./converters";
import { playbookNotFoundError } from "./errors";

export const playbookServiceImpl: ServiceImpl<typeof PlaybookService> = {
  async listPlaybooks(_req, ctx) {
    try {
      const rows = await listPlaybooks({
        ctx: toServiceCtx(getRpcContext(ctx)),
      });
      return { playbooks: rows.map(playbookSummaryToProto) };
    } catch (err) {
      toConnectError(err);
    }
  },

  async getPlaybook(req, ctx) {
    try {
      const row = await getPlaybook({
        ctx: toServiceCtx(getRpcContext(ctx)),
        input: { slug: req.slug },
      });
      if (!row) throw playbookNotFoundError(req.slug);
      return { playbook: playbookToProto(row) };
    } catch (err) {
      toConnectError(err);
    }
  },

  async updatePlaybook(req, ctx) {
    try {
      const row = await savePlaybook({
        ctx: toServiceCtx(getRpcContext(ctx)),
        input: {
          slug: req.slug,
          title: req.title,
          description: req.description,
          content: req.content,
          variables: req.variables,
        },
      });
      return { playbook: playbookToProto(row) };
    } catch (err) {
      toConnectError(err);
    }
  },

  async deletePlaybook(req, ctx) {
    try {
      await clearPlaybook({
        ctx: toServiceCtx(getRpcContext(ctx)),
        input: { slug: req.slug },
      });
      return { success: true };
    } catch (err) {
      toConnectError(err);
    }
  },
};
