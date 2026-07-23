import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Agent Skills Discovery v0.2.0 index.
// SKILL.md files live in `public/.well-known/agent-skills/<name>/SKILL.md` and are
// hashed at request time so the `digest` can never drift from the served content.

export const runtime = "nodejs";

type SkillEntry = {
  name: string;
  type: "skill";
  description: string;
  slug: string;
};

const SKILLS: SkillEntry[] = [
  {
    name: "openstatus-mcp",
    type: "skill",
    description:
      "Connect a Model Context Protocol client (Claude, ChatGPT, Cursor) to an openstatus workspace and drive status pages, status reports, and maintenance windows from chat.",
    slug: "openstatus-mcp",
  },
  {
    name: "openstatus-api",
    type: "skill",
    description:
      "Call the openstatus ConnectRPC API to manage monitors, status pages, and incidents from scripts, CI/CD, and custom integrations.",
    slug: "openstatus-api",
  },
];

const PUBLIC_DIR = join(process.cwd(), "public", ".well-known", "agent-skills");
const SITE_ORIGIN = "https://www.openstatus.dev";

async function digestFor(slug: string): Promise<string | null> {
  try {
    const buf = await readFile(join(PUBLIC_DIR, slug, "SKILL.md"));
    return `sha256:${createHash("sha256").update(buf).digest("hex")}`;
  } catch (err) {
    console.warn(`[agent-skills] could not hash ${slug}/SKILL.md`, err);
    return null;
  }
}

export async function GET() {
  const resolved = await Promise.all(
    SKILLS.map(async (s) => {
      const digest = await digestFor(s.slug);
      if (!digest) return null;
      return {
        name: s.name,
        type: s.type,
        description: s.description,
        url: `${SITE_ORIGIN}/.well-known/agent-skills/${s.slug}/SKILL.md`,
        digest,
      };
    }),
  );
  const skills = resolved.filter((s): s is NonNullable<typeof s> => s !== null);

  const body = JSON.stringify({
    $schema: "https://agentskills.io/schemas/discovery/v0.2.0.json",
    version: "0.2.0",
    publisher: { name: "Openstatus", url: SITE_ORIGIN },
    skills,
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
