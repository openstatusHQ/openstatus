import { randomBytes } from "node:crypto";
import { apiKey, db, eq } from "@openstatus/db";

export const createApiKey = async ({
  name,
  workspaceId,
  createdById,
}: {
  name: string;
  workspaceId: string;
  createdById: string;
}) => {
  const token = `os_${randomBytes(16).toString("hex")}`;
  const [newKey] = await db
    .insert(apiKey)
    .values({
      name,
      token,
      workspaceId,
      createdById,
    })
    .returning();
  return newKey;
};

export const revokeApiKey = async ({ id }: { id: string }) => {
  await db.delete(apiKey).where(eq(apiKey.id, id));
};

export const getApiKeys = async ({ workspaceId }: { workspaceId: string }) => {
  return db.select().from(apiKey).where(eq(apiKey.workspaceId, workspaceId));
};

export const getApiKey = async ({ token }: { token: string }) => {
  const [key] = await db.select().from(apiKey).where(eq(apiKey.token, token));
  return key;
};
