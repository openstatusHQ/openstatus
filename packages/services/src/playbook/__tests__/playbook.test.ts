import { PLAYBOOK_MAX_CHARS } from "@openstatus/db/src/schema/playbooks/constants";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  expectAuditRow,
  makeApiKeyCtx,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import {
  getPlaybookTool,
  listPlaybooksTool,
  updatePlaybookTool,
} from "../../agent-tools/playbook";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError } from "../../errors";
import { clearPlaybook } from "../clear";
import { buildPlaybookSection, loadPlaybookSection } from "../context";
import { getPlaybook, listPlaybooks } from "../list";
import { savePlaybook } from "../save";

let ctx: ServiceContext;
let otherCtx: ServiceContext;
let userId: number;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  userId = team.userId;
  ctx = makeUserCtx(team.workspace, { userId });
  const other = await createWorkspaceFixture("team");
  otherCtx = makeUserCtx(other.workspace, { userId: other.userId });
});

describe("savePlaybook", () => {
  test("creates the slot, then updates the same row", async () => {
    await withTestTransaction(async (tx) => {
      const c = { ...ctx, db: tx };
      const created = await savePlaybook({
        ctx: c,
        input: { slug: "status-page", content: "No ETAs." },
      });
      expect(created.createdBy).toBe(userId);
      expect(created.updatedBy).toBe(userId);
      await expectAuditRow({
        workspaceId: ctx.workspace.id,
        action: "playbook.create",
        entityType: "playbook",
        entityId: created.id,
        db: tx,
      });

      const updated = await savePlaybook({
        ctx: c,
        input: { slug: "status-page", content: "  No ETAs. Ever.  " },
      });
      expect(updated.id).toBe(created.id);
      expect(updated.createdBy).toBe(userId);
      expect(updated.content).toBe("No ETAs. Ever.");
      expect(await listPlaybooks({ ctx: c })).toHaveLength(1);
    });
  });

  test("the audit log keeps the full content of every version", async () => {
    await withTestTransaction(async (tx) => {
      const c = { ...ctx, db: tx };
      const row = await savePlaybook({
        ctx: c,
        input: { slug: "postmortem", content: "v1" },
      });
      await savePlaybook({
        ctx: c,
        input: { slug: "postmortem", content: "v2" },
      });
      await clearPlaybook({ ctx: c, input: { slug: "postmortem" } });

      const rows = await readAuditLog({
        workspaceId: ctx.workspace.id,
        entityType: "playbook",
        entityId: row.id,
        db: tx,
      });
      const byAction = new Map(rows.map((r) => [r.action, r]));
      expect(byAction.get("playbook.create")?.after).toMatchObject({
        content: "v1",
      });
      expect(byAction.get("playbook.update")?.before).toMatchObject({
        content: "v1",
      });
      expect(byAction.get("playbook.update")?.after).toMatchObject({
        content: "v2",
      });
      expect(byAction.get("playbook.delete")?.before).toMatchObject({
        content: "v2",
      });
    });
  });

  test("saving the same content writes nothing", async () => {
    await withTestTransaction(async (tx) => {
      const c = { ...ctx, db: tx };
      const row = await savePlaybook({
        ctx: c,
        input: { slug: "postmortem", content: "same" },
      });
      await savePlaybook({
        ctx: c,
        input: { slug: "postmortem", content: "same" },
      });
      const rows = await readAuditLog({
        workspaceId: ctx.workspace.id,
        entityType: "playbook",
        entityId: row.id,
        db: tx,
      });
      expect(rows).toHaveLength(1);
    });
  });

  test("title and description default to the slug's, keep an edit and reset when emptied", async () => {
    await withTestTransaction(async (tx) => {
      const c = { ...ctx, db: tx };
      const created = await savePlaybook({
        ctx: c,
        input: { slug: "postmortem", content: "x" },
      });
      expect(created.title).toBe("Postmortem");
      expect(created.description).toBe(
        "The sections of your postmortems and what goes in each.",
      );

      const renamed = await savePlaybook({
        ctx: c,
        input: {
          slug: "postmortem",
          content: "x",
          title: "  Reviews  ",
          description: "How we review.",
        },
      });
      expect(renamed.title).toBe("Reviews");
      expect(renamed.description).toBe("How we review.");

      // left out, both are kept
      const kept = await savePlaybook({
        ctx: c,
        input: { slug: "postmortem", content: "y" },
      });
      expect(kept.title).toBe("Reviews");
      expect(kept.description).toBe("How we review.");

      const reset = await savePlaybook({
        ctx: c,
        input: { slug: "postmortem", content: "y", description: "" },
      });
      expect(reset.title).toBe("Reviews");
      expect(reset.description).toBe(
        "The sections of your postmortems and what goes in each.",
      );
    });
  });

  test("rejects empty and oversized content", async () => {
    await withTestTransaction(async (tx) => {
      const c = { ...ctx, db: tx };
      await expect(
        savePlaybook({ ctx: c, input: { slug: "postmortem", content: "  " } }),
      ).rejects.toThrow();
      await expect(
        savePlaybook({
          ctx: c,
          input: {
            slug: "postmortem",
            content: "x".repeat(PLAYBOOK_MAX_CHARS + 1),
          },
        }),
      ).rejects.toThrow();
    });
  });

  test("rejects read-only actor", async () => {
    const readOnly = makeApiKeyCtx(ctx.workspace, {
      keyId: "k-ro",
      scopes: ["read"],
    });
    await expect(
      savePlaybook({
        ctx: readOnly,
        input: { slug: "postmortem", content: "x" },
      }),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      clearPlaybook({ ctx: readOnly, input: { slug: "postmortem" } }),
    ).rejects.toThrow(ForbiddenError);
  });

  test("rejects other-group key", async () => {
    const monitorsOnly = makeApiKeyCtx(ctx.workspace, {
      keyId: "k-mon",
      scopes: ["monitors:write"],
    });
    await expect(
      savePlaybook({
        ctx: monitorsOnly,
        input: { slug: "postmortem", content: "x" },
      }),
    ).rejects.toThrow(ForbiddenError);
    await expect(listPlaybooks({ ctx: monitorsOnly })).rejects.toThrow(
      ForbiddenError,
    );
  });
});

describe("variables", () => {
  test("keeps the values the text uses and drops the rest", async () => {
    await withTestTransaction(async (tx) => {
      const c = { ...ctx, db: tx };
      const row = await savePlaybook({
        ctx: c,
        input: {
          slug: "status-page",
          content: "Sign off as {{team_name}}. Contact {{ support_email }}.",
          variables: { team_name: "Platform", unused: "x", support_email: "" },
        },
      });
      expect(row.variables).toEqual({ team_name: "Platform" });

      const out = await getPlaybookTool.run({
        ctx: c,
        input: { slug: "status-page" },
      });
      expect(out.content).toContain("Sign off as Platform.");
      // an unset variable stays visible instead of vanishing
      expect(out.content).toContain("{{ support_email }}");
    });
  });

  test("changing only a value is an audited update", async () => {
    await withTestTransaction(async (tx) => {
      const c = { ...ctx, db: tx };
      const content = "Sign off as {{team_name}}.";
      const row = await savePlaybook({
        ctx: c,
        input: { slug: "status-page", content, variables: { team_name: "A" } },
      });
      const updated = await savePlaybook({
        ctx: c,
        input: { slug: "status-page", content, variables: { team_name: "B" } },
      });
      expect(updated.variables).toEqual({ team_name: "B" });
      const rows = await readAuditLog({
        workspaceId: ctx.workspace.id,
        entityType: "playbook",
        entityId: row.id,
        db: tx,
      });
      expect(rows.map((r) => r.action).sort()).toEqual([
        "playbook.create",
        "playbook.update",
      ]);
    });
  });

  test("the cap applies with the variables filled in", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        savePlaybook({
          ctx: { ...ctx, db: tx },
          input: {
            slug: "status-page",
            content: `${"x".repeat(PLAYBOOK_MAX_CHARS - 10)}{{a}}`,
            variables: { a: "y".repeat(100) },
          },
        }),
      ).rejects.toThrow(/10000 characters/);
    });
  });

  test("rejects a name outside the supported syntax", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        savePlaybook({
          ctx: { ...ctx, db: tx },
          input: {
            slug: "status-page",
            content: "x",
            variables: { "Team Name": "x" },
          },
        }),
      ).rejects.toThrow();
    });
  });
});

describe("reads", () => {
  test("slots are per workspace", async () => {
    await withTestTransaction(async (tx) => {
      const c = { ...ctx, db: tx };
      const o = { ...otherCtx, db: tx };
      await savePlaybook({
        ctx: c,
        input: { slug: "incident-response", content: "ours" },
      });
      expect(
        await getPlaybook({ ctx: o, input: { slug: "incident-response" } }),
      ).toBeNull();
      expect(await listPlaybooks({ ctx: o })).toHaveLength(0);

      await savePlaybook({
        ctx: o,
        input: { slug: "incident-response", content: "theirs" },
      });
      const mine = await getPlaybook({
        ctx: c,
        input: { slug: "incident-response" },
      });
      expect(mine?.content).toBe("ours");
      expect(mine?.updatedByUser?.id).toBe(userId);
    });
  });

  test("listed in slug order, whatever the write order", async () => {
    await withTestTransaction(async (tx) => {
      const c = { ...ctx, db: tx };
      for (const slug of [
        "postmortem",
        "incident-response",
        "maintenance-windows",
      ] as const) {
        await savePlaybook({ ctx: c, input: { slug, content: slug } });
      }
      expect((await listPlaybooks({ ctx: c })).map((r) => r.slug)).toEqual([
        "incident-response",
        "maintenance-windows",
        "postmortem",
      ]);
      const section = await loadPlaybookSection({ ctx: c });
      expect(section.indexOf("- incident-response:")).toBeLessThan(
        section.indexOf("- postmortem:"),
      );
    });
  });

  test("clearing an empty slot is a not-found", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        clearPlaybook({
          ctx: { ...ctx, db: tx },
          input: { slug: "postmortem" },
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});

describe("buildPlaybookSection", () => {
  test("is empty without playbooks", () => {
    expect(buildPlaybookSection([])).toBe("");
  });

  test("names the filled slugs, what each covers and the tool", () => {
    const section = buildPlaybookSection([
      { slug: "status-page", description: "Our public\n## voice" },
    ]);
    // a description stays on its line
    expect(section).toContain("- status-page: Our public ## voice\n");
    expect(section).toContain("get_playbook");
  });
});

describe("agent tools", () => {
  test("list_playbooks returns slugs without content", async () => {
    await withTestTransaction(async (tx) => {
      const c = { ...ctx, db: tx };
      await savePlaybook({
        ctx: c,
        input: { slug: "status-page", content: "SECRET-TONE" },
      });
      const out = await listPlaybooksTool.run({ ctx: c, input: {} });
      expect(out.playbooks.map((p) => p.slug)).toEqual(["status-page"]);
      expect(out.playbooks[0]?.title).toBe("Status page");
      expect(JSON.stringify(out)).not.toContain("SECRET-TONE");
    });
  });

  test("get_playbook returns the full content, delimited as team text", async () => {
    await withTestTransaction(async (tx) => {
      const c = { ...ctx, db: tx };
      const content = `# Style\n${"rule\n".repeat(1500)}`.trim();
      await savePlaybook({
        ctx: c,
        input: { slug: "status-page", content },
      });
      const out = await getPlaybookTool.run({
        ctx: c,
        input: { slug: "status-page" },
      });
      expect(out.error).toBeUndefined();
      expect(out.content).toBe(
        `<playbook slug="status-page">\n${content}\n</playbook>`,
      );
    });
  });

  test("get_playbook reports an empty slot as data", async () => {
    await withTestTransaction(async (tx) => {
      const out = await getPlaybookTool.run({
        ctx: { ...ctx, db: tx },
        input: { slug: "postmortem" },
      });
      expect(out.content).toBe("");
      expect(out.error).toContain("postmortem");
    });
  });

  test("update_playbook creates, then replaces while keeping set values", async () => {
    await withTestTransaction(async (tx) => {
      const c = { ...ctx, db: tx };
      const created = await updatePlaybookTool.run({
        ctx: c,
        input: {
          slug: "status-page",
          content: "Sign off as {{team_name}}.",
          variables: { team_name: "Platform" },
        },
      });
      expect(created.created).toBe(true);

      const read = await getPlaybookTool.run({
        ctx: c,
        input: { slug: "status-page" },
      });
      expect(read.content).toContain("Sign off as Platform.");
      // the text to edit is the one with the variable still in it
      expect(read.source).toBe("Sign off as {{team_name}}.");
      expect(read.variables).toEqual({ team_name: "Platform" });

      const updated = await updatePlaybookTool.run({
        ctx: c,
        input: {
          slug: "status-page",
          content: "No ETAs. Sign off as {{team_name}}.",
        },
      });
      expect(updated.created).toBe(false);
      const row = await getPlaybook({ ctx: c, input: { slug: "status-page" } });
      expect(row?.variables).toEqual({ team_name: "Platform" });
    });
  });

  test("get_playbook has no source without variables", async () => {
    await withTestTransaction(async (tx) => {
      const c = { ...ctx, db: tx };
      await savePlaybook({
        ctx: c,
        input: { slug: "postmortem", content: "## Summary" },
      });
      const read = await getPlaybookTool.run({
        ctx: c,
        input: { slug: "postmortem" },
      });
      expect(read.source).toBeUndefined();
      expect(read.variables).toBeUndefined();
    });
  });

  test("update_playbook rejects a read-only key", async () => {
    const readOnly = makeApiKeyCtx(ctx.workspace, {
      keyId: "k-ro-tools",
      scopes: ["read"],
    });
    await expect(
      updatePlaybookTool.run({
        ctx: readOnly,
        input: { slug: "postmortem", content: "x" },
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});
