import "@/test-preload";
import { db } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";
import type { AdapterUser } from "next-auth/adapters";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createUser, normalizeEmail } from "./helpers";

describe("normalizeEmail", () => {
  it("trims whitespace and converts to lowercase", () => {
    expect(normalizeEmail("  Test.User+Tag@Example.COM  ")).toBe(
      "test.user+tag@example.com",
    );
  });
});

describe("createUser", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockAdapterUser: AdapterUser = {
    id: "1",
    email: "  NewUser@Example.Com ",
    emailVerified: null,
    name: "John Doe",
    firstName: "John",
    lastName: "Doe",
    image: "https://example.com/avatar.png",
  };

  it("atomically creates user, workspace, and owner membership in a single transaction", async () => {
    const mockUser = {
      id: 42,
      email: "newuser@example.com",
      name: "John Doe",
      firstName: "John",
      lastName: "Doe",
      photoUrl: "https://example.com/avatar.png",
    };

    const mockWorkspace = {
      id: 101,
      slug: "swift-fox",
      name: "",
    };

    const mockMembership = {
      userId: 42,
      workspaceId: 101,
      role: "owner",
    };

    const mockTx = {
      insert: vi.fn((table) => {
        if (table === user) {
          return {
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue(mockUser),
              }),
            }),
          };
        }
        if (table === workspace) {
          return {
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue(mockWorkspace),
              }),
            }),
          };
        }
        if (table === usersToWorkspaces) {
          return {
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue(mockMembership),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
      select: vi.fn(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(null), // slug is available
          }),
        }),
      })),
    };

    const transactionSpy = vi
      .spyOn(db, "transaction")
      .mockImplementation(async (callback) => {
        return await callback(mockTx as never);
      });

    const result = await createUser(mockAdapterUser);

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(mockTx.insert).toHaveBeenCalledWith(user);
    expect(mockTx.select).toHaveBeenCalled();
    expect(mockTx.insert).toHaveBeenCalledWith(workspace);
    expect(mockTx.insert).toHaveBeenCalledWith(usersToWorkspaces);
    expect(result).toEqual(mockUser);
  });

  it("retries slug generation if the generated slug already exists", async () => {
    const mockUser = { id: 42, email: "user@example.com" };
    const mockWorkspace = { id: 101, slug: "fresh-slug" };

    let slugCheckCount = 0;
    const mockTx = {
      insert: vi.fn((table) => {
        if (table === user) {
          return {
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue(mockUser),
              }),
            }),
          };
        }
        if (table === workspace) {
          return {
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue(mockWorkspace),
              }),
            }),
          };
        }
        if (table === usersToWorkspaces) {
          return {
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({}),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
      select: vi.fn(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockImplementation(async () => {
              slugCheckCount++;
              // First slug check hits an existing workspace, second is free
              if (slugCheckCount === 1) {
                return { id: 99, slug: "already-taken" };
              }
              return null;
            }),
          }),
        }),
      })),
    };

    vi.spyOn(db, "transaction").mockImplementation(async (callback) => {
      return await callback(mockTx as never);
    });

    const result = await createUser(mockAdapterUser);

    expect(slugCheckCount).toBe(2);
    expect(result).toEqual(mockUser);
  });

  it("rolls back and does not persist partial records if workspace creation fails", async () => {
    const mockUser = { id: 42, email: "newuser@example.com" };
    const dbFailure = new Error("Database disk full or constraint violation");

    const mockTx = {
      insert: vi.fn((table) => {
        if (table === user) {
          return {
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue(mockUser),
              }),
            }),
          };
        }
        if (table === workspace) {
          return {
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockReturnValue({
                get: vi.fn().mockRejectedValue(dbFailure),
              }),
            }),
          };
        }
        if (table === usersToWorkspaces) {
          return {
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({}),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
      select: vi.fn(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(null),
          }),
        }),
      })),
    };

    const transactionSpy = vi
      .spyOn(db, "transaction")
      .mockImplementation(async (callback) => {
        return await callback(mockTx as never);
      });

    await expect(createUser(mockAdapterUser)).rejects.toThrow(
      "Database disk full or constraint violation",
    );
    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(mockTx.insert).not.toHaveBeenCalledWith(usersToWorkspaces);
  });

  it("rolls back and does not persist orphaned records if membership creation fails", async () => {
    const mockUser = { id: 42, email: "newuser@example.com" };
    const mockWorkspace = { id: 101, slug: "safe-hawk" };
    const membershipFailure = new Error("Unique constraint on membership");

    const mockTx = {
      insert: vi.fn((table) => {
        if (table === user) {
          return {
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue(mockUser),
              }),
            }),
          };
        }
        if (table === workspace) {
          return {
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue(mockWorkspace),
              }),
            }),
          };
        }
        if (table === usersToWorkspaces) {
          return {
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockReturnValue({
                get: vi.fn().mockRejectedValue(membershipFailure),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
      select: vi.fn(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(null),
          }),
        }),
      })),
    };

    const transactionSpy = vi
      .spyOn(db, "transaction")
      .mockImplementation(async (callback) => {
        return await callback(mockTx as never);
      });

    await expect(createUser(mockAdapterUser)).rejects.toThrow(
      "Unique constraint on membership",
    );
    expect(transactionSpy).toHaveBeenCalledTimes(1);
  });
});
