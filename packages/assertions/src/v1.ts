import { JSONPath } from "jsonpath-plus";
import { z } from "zod";

import { isDnsAssertionRequest, isHttpAssertionRequest } from "./type-guards";
import type { Assertion, AssertionRequest, AssertionResult } from "./types";

export const stringCompare = z.enum([
  "contains",
  "not_contains",
  "eq",
  "not_eq",
  "empty",
  "not_empty",
  "gt",
  "gte",
  "lt",
  "lte",
]);
export const numberCompare = z.enum(["eq", "not_eq", "gt", "gte", "lt", "lte"]);

export const recordCompare = z.enum([
  "contains",
  "not_contains",
  "eq",
  "not_eq",
]);

function evaluateNumber(
  value: number,
  compare: z.infer<typeof numberCompare>,
  target: number,
): AssertionResult {
  switch (compare) {
    case "eq":
      if (value !== target) {
        return {
          success: false,
          message: `Expected ${value} to be equal to ${target}`,
        };
      }
      break;
    case "not_eq":
      if (value === target) {
        return {
          success: false,
          message: `Expected ${value} to not be equal to ${target}`,
        };
      }
      break;
    case "gt":
      if (value <= target) {
        return {
          success: false,
          message: `Expected ${value} to be greater than ${target}`,
        };
      }
      break;
    case "gte":
      if (value < target) {
        return {
          success: false,
          message: `Expected ${value} to be greater than or equal to ${target}`,
        };
      }
      break;
    case "lt":
      if (value >= target) {
        return {
          success: false,
          message: `Expected ${value} to be less than ${target}`,
        };
      }
      break;
    case "lte":
      if (value > target) {
        return {
          success: false,
          message: `Expected ${value} to be less than or equal to ${target}`,
        };
      }
      break;
  }
  return { success: true };
}

function evaluateString(
  value: string,
  compare: z.infer<typeof stringCompare>,
  target: string,
): AssertionResult {
  switch (compare) {
    case "contains":
      if (!value.includes(target)) {
        return {
          success: false,
          message: `Expected ${value} to contain ${target}`,
        };
      }
      break;
    case "not_contains":
      if (value.includes(target)) {
        return {
          success: false,
          message: `Expected ${value} to not contain ${target}`,
        };
      }
      break;
    case "empty":
      if (value !== "") {
        return { success: false, message: `Expected ${value} to be empty` };
      }
      break;
    case "not_empty":
      if (value === "") {
        return { success: false, message: `Expected ${value} to not be empty` };
      }
      break;
    case "eq":
      if (value !== target) {
        return {
          success: false,
          message: `Expected ${value} to be equal to ${target}`,
        };
      }
      break;
    case "not_eq":
      if (value === target) {
        return {
          success: false,
          message: `Expected ${value} to not be equal to ${target}`,
        };
      }
      break;
    case "gt":
      if (value <= target) {
        return {
          success: false,
          message: `Expected ${value} to be greater than ${target}`,
        };
      }
      break;
    case "gte":
      if (value < target) {
        return {
          success: false,
          message: `Expected ${value} to be greater than or equal to ${target}`,
        };
      }
      break;
    case "lt":
      if (value >= target) {
        return {
          success: false,
          message: `Expected ${value} to be less than ${target}`,
        };
      }
      break;
    case "lte":
      if (value > target) {
        return {
          success: false,
          message: `Expected ${value} to be less than or equal to ${target}`,
        };
      }
      break;
  }
  return { success: true };
}

function evaluateRecord(
  values: string[],
  compare: z.infer<typeof recordCompare>,
  target: string,
): AssertionResult {
  const valuesString = values.join(", ");

  switch (compare) {
    case "contains":
      if (!values.some((v) => v.includes(target))) {
        return {
          success: false,
          message: `Expected DNS records [${valuesString}] to contain ${target}`,
        };
      }
      break;
    case "not_contains":
      if (values.some((v) => v.includes(target))) {
        return {
          success: false,
          message: `Expected DNS records [${valuesString}] to not contain ${target}`,
        };
      }
      break;
    case "eq":
      if (!values.includes(target)) {
        return {
          success: false,
          message: `Expected DNS records [${valuesString}] to equal ${target}`,
        };
      }
      break;
    case "not_eq":
      if (values.includes(target)) {
        return {
          success: false,
          message: `Expected DNS records [${valuesString}] to not equal ${target}`,
        };
      }
      break;
  }
  return { success: true };
}

export const base = z.looseObject({
  version: z.enum(["v1"]).prefault("v1"),
  type: z.string(),
});
export const statusAssertion = base.extend(
  z.object({
    type: z.literal("status"),
    compare: numberCompare,
    target: z.int().positive(),
  }).shape,
);

export const headerAssertion = base.extend(
  z.object({
    type: z.literal("header"),
    compare: stringCompare,
    key: z.string(),
    target: z.string(),
  }).shape,
);

export const textBodyAssertion = base.extend(
  z.object({
    type: z.literal("textBody"),
    compare: stringCompare,
    target: z.string(),
  }).shape,
);

export const jsonBodyAssertion = base.extend(
  z.object({
    type: z.literal("jsonBody"),
    path: z.string(), // https://www.npmjs.com/package/jsonpath-plus
    compare: stringCompare,
    target: z.string(),
  }).shape,
);

export const dnsRecords = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"] as const;

export const recordAssertion = base.extend(
  z.object({
    type: z.literal("dnsRecord"),
    key: z.enum(dnsRecords),
    compare: recordCompare,
    target: z.string(),
  }).shape,
);

export const assertion = z.discriminatedUnion("type", [
  statusAssertion,
  headerAssertion,
  textBodyAssertion,
  jsonBodyAssertion,
  recordAssertion,
]);

export class StatusAssertion implements Assertion {
  readonly schema: z.infer<typeof statusAssertion>;

  constructor(schema: z.infer<typeof statusAssertion>) {
    this.schema = schema;
  }

  public assert(req: AssertionRequest): AssertionResult {
    if (!isHttpAssertionRequest(req)) {
      return {
        success: false,
        message: "Invalid request type for status assertion",
      };
    }
    const { success, message } = evaluateNumber(
      req.status,
      this.schema.compare,
      this.schema.target,
    );
    if (success) {
      return { success };
    }
    return { success, message: `Status: ${message}` };
  }
}

export class HeaderAssertion implements Assertion {
  readonly schema: z.infer<typeof headerAssertion>;

  constructor(schema: z.infer<typeof headerAssertion>) {
    this.schema = schema;
  }

  public assert(req: AssertionRequest): AssertionResult {
    if (!isHttpAssertionRequest(req)) {
      return {
        success: false,
        message: "Invalid request type for header assertion",
      };
    }
    const { success, message } = evaluateString(
      req.header[this.schema.key],
      this.schema.compare,
      this.schema.target,
    );
    if (success) {
      return { success };
    }
    return { success, message: `Header ${this.schema.key}: ${message}` };
  }
}

export class TextBodyAssertion implements Assertion {
  readonly schema: z.infer<typeof textBodyAssertion>;

  constructor(schema: z.infer<typeof textBodyAssertion>) {
    this.schema = schema;
  }

  public assert(req: AssertionRequest): AssertionResult {
    if (!isHttpAssertionRequest(req)) {
      return {
        success: false,
        message: "Invalid request type for text body assertion",
      };
    }
    const { success, message } = evaluateString(
      req.body,
      this.schema.compare,
      this.schema.target,
    );
    if (success) {
      return { success };
    }
    return { success, message: `Body: ${message}` };
  }
}
export class JsonBodyAssertion implements Assertion {
  readonly schema: z.infer<typeof jsonBodyAssertion>;

  constructor(schema: z.infer<typeof jsonBodyAssertion>) {
    this.schema = schema;
  }

  public assert(req: AssertionRequest): AssertionResult {
    if (!isHttpAssertionRequest(req)) {
      return {
        success: false,
        message: "Invalid request type for JSON body assertion",
      };
    }
    try {
      const json = JSON.parse(req.body);
      const value = JSONPath({ path: this.schema.path, json });
      const { success, message } = evaluateString(
        value,
        this.schema.compare,
        this.schema.target,
      );
      if (success) {
        return { success };
      }
      return { success, message: `Body: ${message}` };
    } catch (_e) {
      console.error("Unable to parse json");
      return { success: false, message: "Unable to parse json" };
    }
  }
}

export class DnsRecordAssertion implements Assertion {
  readonly schema: z.infer<typeof recordAssertion>;

  constructor(schema: z.infer<typeof recordAssertion>) {
    this.schema = schema;
  }

  public assert(req: AssertionRequest): AssertionResult {
    if (!isDnsAssertionRequest(req)) {
      return {
        success: false,
        message: "Invalid request type for DNS record assertion",
      };
    }
    const records = req.records[this.schema.key] || [];
    const { success, message } = evaluateRecord(
      records,
      this.schema.compare,
      this.schema.target,
    );
    if (success) {
      return { success };
    }
    return { success, message: `DNS Record ${this.schema.key}: ${message}` };
  }
}
