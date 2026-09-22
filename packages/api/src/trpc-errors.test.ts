import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";
import { TRPCError } from "@trpc/server";

import {
  EXPECTED_TRPC_CODES,
  createTRPCOnError,
  isExpectedTRPCError,
  isExpectedTRPCErrorCode,
} from "./trpc-errors";

// Simulates the cross-bundle case: a TRPCError from the app bundle whose class
// identity differs from this module's `@trpc/server`, so only name + code match.
function fakeTRPCError(code: string): unknown {
  return Object.assign(new Error("boom"), { name: "TRPCError", code });
}

function captureConsole(fn: () => void): { error: number; log: number } {
  const origError = console.error;
  const origLog = console.log;
  let error = 0;
  let log = 0;
  console.error = () => {
    error++;
  };
  console.log = () => {
    log++;
  };
  try {
    fn();
  } finally {
    console.error = origError;
    console.log = origLog;
  }
  return { error, log };
}

describe("isExpectedTRPCErrorCode", () => {
  test("true for every expected client code", () => {
    for (const code of EXPECTED_TRPC_CODES) {
      expect(isExpectedTRPCErrorCode(code)).toBe(true);
    }
  });

  test("false for server errors", () => {
    expect(isExpectedTRPCErrorCode("INTERNAL_SERVER_ERROR")).toBe(false);
    expect(isExpectedTRPCErrorCode("TIMEOUT")).toBe(false);
  });
});

describe("isExpectedTRPCError", () => {
  test("true for a real TRPCError with an expected code", () => {
    const err = new TRPCError({ code: "NOT_FOUND", message: "not found" });
    expect(isExpectedTRPCError(err)).toBe(true);
  });

  test("false for a real TRPCError with a server-error code", () => {
    const err = new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    expect(isExpectedTRPCError(err)).toBe(false);
  });

  test("true for a cross-bundle TRPCError matched by name + code", () => {
    expect(isExpectedTRPCError(fakeTRPCError("NOT_FOUND"))).toBe(true);
  });

  test("false for a cross-bundle TRPCError with a server-error code", () => {
    expect(isExpectedTRPCError(fakeTRPCError("INTERNAL_SERVER_ERROR"))).toBe(
      false,
    );
  });

  test("false for a plain Error that is not a TRPCError", () => {
    expect(isExpectedTRPCError(new Error("NOT_FOUND"))).toBe(false);
  });

  test("false for non-error values", () => {
    expect(isExpectedTRPCError(null)).toBe(false);
    expect(isExpectedTRPCError(undefined)).toBe(false);
    expect(isExpectedTRPCError("NOT_FOUND")).toBe(false);
    expect(isExpectedTRPCError({ code: "NOT_FOUND" })).toBe(false);
  });
});

describe("createTRPCOnError", () => {
  test("does not log expected client errors", () => {
    const onError = createTRPCOnError("lambda");
    const counts = captureConsole(() =>
      onError({ error: { code: "NOT_FOUND", message: "not found" } }),
    );
    expect(counts.error).toBe(0);
    expect(counts.log).toBe(0);
  });

  test("logs genuine server errors", () => {
    const onError = createTRPCOnError("lambda");
    const counts = captureConsole(() =>
      onError({ error: { code: "INTERNAL_SERVER_ERROR", message: "boom" } }),
    );
    expect(counts.error).toBe(1);
    expect(counts.log).toBe(1);
  });
});
