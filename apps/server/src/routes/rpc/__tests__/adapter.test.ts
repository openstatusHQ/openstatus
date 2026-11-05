import { Code, ConnectError } from "@connectrpc/connect";
import {
  BadRequestSchema,
  ErrorInfoSchema,
} from "@openstatus/proto/google/rpc";
import {
  ConcurrentUpdateError,
  ConflictError,
  ForbiddenError,
  InternalServiceError,
  LimitExceededError,
  NotFoundError,
  PreconditionFailedError,
  UnauthorizedError,
  ValidationError,
} from "@openstatus/services";
import { describe, expect, test } from "vitest";
import { z } from "zod";

import { ErrorReason } from "@/libs/errors/rpc";

import { toConnectError } from "../adapter";

function capture(err: unknown): unknown {
  try {
    toConnectError(err);
  } catch (e) {
    return e;
  }
  throw new Error("expected toConnectError to throw");
}

const info = (err: ConnectError) => err.findDetails(ErrorInfoSchema)[0];

describe("toConnectError", () => {
  test("passes a ConnectError through by identity", () => {
    const original = new ConnectError("x", Code.NotFound);
    expect(capture(original)).toBe(original);
  });

  test("rethrows unclassified errors untouched for the interceptor", () => {
    const raw = new Error("Failed query: select * from secret");
    expect(capture(raw)).toBe(raw);
  });

  test("turns a ZodError into VALIDATION_FAILED with readable message and field violations", () => {
    const schema = z.object({
      url: z.string().url(),
      periodicity: z.enum(["1m", "5m"]),
    });
    const result = schema.safeParse({ url: "nope", periodicity: "2m" });
    if (result.success) throw new Error("expected zod failure");

    const err = capture(result.error) as ConnectError;
    expect(err.code).toBe(Code.InvalidArgument);
    expect(err.rawMessage.startsWith("Invalid request: ")).toBe(true);
    // not the raw JSON dump zod puts in `message`
    expect(err.rawMessage).not.toContain('"code"');
    expect(info(err).reason).toBe(ErrorReason.VALIDATION_FAILED);
    const [bad] = err.findDetails(BadRequestSchema);
    expect(bad.fieldViolations.map((v) => v.field).sort()).toEqual([
      "periodicity",
      "url",
    ]);
    expect(err.cause).toBe(result.error);
  });

  test("NotFoundError of a known entity → resource-specific reason with the id", () => {
    const err = capture(new NotFoundError("maintenance", 12)) as ConnectError;
    expect(err.code).toBe(Code.NotFound);
    expect(err.rawMessage).toBe("maintenance 12 not found");
    expect(info(err)).toMatchObject({
      reason: ErrorReason.MAINTENANCE_NOT_FOUND,
      metadata: { resource: "maintenance", maintenanceId: "12" },
    });
  });

  test("NotFoundError of another entity → generic NOT_FOUND", () => {
    const err = capture(new NotFoundError("workspace")) as ConnectError;
    expect(info(err)).toMatchObject({
      reason: ErrorReason.NOT_FOUND,
      metadata: { resource: "workspace" },
    });
    expect(info(err).metadata).not.toHaveProperty("id");
  });

  test("LimitExceededError → permission_denied PLAN_LIMIT_REACHED with limit/max/current", () => {
    const err = capture(
      new LimitExceededError("monitors", 5, 5),
    ) as ConnectError;
    expect(err.code).toBe(Code.PermissionDenied);
    expect(info(err)).toMatchObject({
      reason: ErrorReason.PLAN_LIMIT_REACHED,
      metadata: { limit: "monitors", max: "5", current: "5" },
    });
    const noCurrent = capture(
      new LimitExceededError("monitors", 5),
    ) as ConnectError;
    expect(info(noCurrent).metadata).not.toHaveProperty("current");
  });

  test("LimitExceededError with max 0 → PLAN_FEATURE_NOT_AVAILABLE", () => {
    const err = capture(
      new LimitExceededError("password-protection", 0),
    ) as ConnectError;
    expect(err.code).toBe(Code.PermissionDenied);
    expect(info(err)).toMatchObject({
      reason: ErrorReason.PLAN_FEATURE_NOT_AVAILABLE,
      metadata: { feature: "password-protection" },
    });
  });

  test("ConflictError → failed_precondition with reason CONFLICT", () => {
    const err = capture(new ConflictError("mixed pages")) as ConnectError;
    expect(err.code).toBe(Code.FailedPrecondition);
    expect(info(err).reason).toBe(ErrorReason.CONFLICT);
  });

  test("ConcurrentUpdateError → aborted with reason CONFLICT", () => {
    const err = capture(
      new ConcurrentUpdateError("changed concurrently"),
    ) as ConnectError;
    expect(err.code).toBe(Code.Aborted);
    expect(info(err).reason).toBe(ErrorReason.CONFLICT);
  });

  test("maps the remaining service errors", () => {
    const cases: [Error, Code, string][] = [
      [new ForbiddenError("no"), Code.PermissionDenied, ErrorReason.FORBIDDEN],
      [
        new UnauthorizedError("no"),
        Code.Unauthenticated,
        ErrorReason.UNAUTHORIZED,
      ],
      [
        new ValidationError("bad"),
        Code.InvalidArgument,
        ErrorReason.VALIDATION_FAILED,
      ],
      [
        new PreconditionFailedError("later"),
        Code.FailedPrecondition,
        ErrorReason.UNPROCESSABLE_ENTITY,
      ],
      [
        new InternalServiceError("boom"),
        Code.Internal,
        ErrorReason.INTERNAL_SERVER_ERROR,
      ],
    ];
    for (const [input, code, reason] of cases) {
      const err = capture(input) as ConnectError;
      expect(err.code).toBe(code);
      expect(info(err).reason).toBe(reason);
      expect(info(err).domain).toBe("openstatus.dev");
    }
  });
});
