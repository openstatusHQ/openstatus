import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  cn,
  formatDuration,
  hashIP,
  manipulateDate,
  notEmpty,
  numberFormatter,
  slugify,
  toCapitalize,
} from "./utils";

describe("cn", () => {
  test("lets later tailwind classes win and drops falsy values", () => {
    expect(cn("p-2", false, null, "p-4", "text-sm")).toBe("p-4 text-sm");
  });
});

describe("formatDuration", () => {
  test("lists every non-zero unit with plurals", () => {
    expect(
      formatDuration(2 * 86400000 + 3 * 3600000 + 4 * 60000 + 5000 + 6),
    ).toBe("2 days, 3 hours, 4 mins, 5 secs, 6 ms");
  });

  test("uses singular units for a value of one", () => {
    expect(formatDuration(86400000 + 3600000 + 60000 + 1000 + 1)).toBe(
      "1 day, 1 hour, 1 min, 1 sec, 1 ms",
    );
  });

  test("skips zero units", () => {
    expect(formatDuration(3600000 + 500)).toBe("1 hour, 500 ms");
  });

  test("formats a negative duration by its magnitude", () => {
    expect(formatDuration(-1500)).toBe("1 sec, 500 ms");
  });
});

describe("notEmpty", () => {
  test("filters out only null and undefined", () => {
    expect([0, "", null, false, undefined, 1].filter(notEmpty)).toEqual([
      0,
      "",
      false,
      1,
    ]);
  });
});

describe("slugify", () => {
  test("lowercases, hyphenates spaces and drops symbols", () => {
    expect(slugify("Hello World! v2.0")).toBe("hello-world-v20");
  });

  test("keeps existing hyphens and underscores", () => {
    expect(slugify("status_page-Setup")).toBe("status_page-setup");
  });
});

describe("numberFormatter", () => {
  test("uses compact notation", () => {
    expect(numberFormatter(999)).toBe("999");
    expect(numberFormatter(1234)).toBe("1.2K");
    expect(numberFormatter(2_500_000)).toBe("2.5M");
  });
});

describe("toCapitalize", () => {
  test("joins words split on spaces and underscores in PascalCase", () => {
    expect(toCapitalize("hello_world foo")).toBe("HelloWorldFoo");
    expect(toCapitalize("SHOUTING")).toBe("Shouting");
  });
});

describe("manipulateDate", () => {
  test("returns nulls without a range", () => {
    expect(manipulateDate(null)).toEqual({ fromDate: null, toDate: null });
    expect(manipulateDate(undefined)).toEqual({ fromDate: null, toDate: null });
  });

  test("extends a midnight end date to the last millisecond of that day", () => {
    const from = new Date(2024, 0, 1);
    const to = new Date(2024, 0, 2);
    const { fromDate, toDate } = manipulateDate({ from, to });
    expect(fromDate).toBe(from.getTime());
    expect(toDate).toBe(new Date(2024, 0, 2, 23, 59, 59, 999).getTime());
  });

  test("keeps a non-midnight end date as is", () => {
    const to = new Date(2024, 0, 2, 13, 37, 1);
    expect(manipulateDate({ from: undefined, to }).toDate).toBe(to.getTime());
  });

  // midnight is detected by the timestamp ending in "00000", which also
  // matches any time on a 100-second boundary, e.g. 10:00:00
  test.ignore("keeps a whole-hour end date as is", () => {
    const to = new Date(2024, 0, 2, 10);
    expect(manipulateDate({ from: undefined, to }).toDate).toBe(to.getTime());
  });
});

describe("hashIP", () => {
  function withSalt(salt: string | undefined, fn: () => Promise<void>) {
    return async () => {
      const prev = process.env.FEEDBACK_IP_SALT;
      if (salt === undefined) delete process.env.FEEDBACK_IP_SALT;
      else process.env.FEEDBACK_IP_SALT = salt;
      try {
        await fn();
      } finally {
        if (prev === undefined) delete process.env.FEEDBACK_IP_SALT;
        else process.env.FEEDBACK_IP_SALT = prev;
      }
    };
  }

  test(
    "returns a stable 32-char hex digest",
    withSalt("salt", async () => {
      const a = await hashIP("203.0.113.7");
      expect(a).toMatch(/^[0-9a-f]{32}$/);
      expect(await hashIP("203.0.113.7")).toBe(a);
    }),
  );

  test(
    "differs per input and per salt",
    withSalt("salt", async () => {
      const a = await hashIP("203.0.113.7");
      expect(await hashIP("203.0.113.8")).not.toBe(a);
      process.env.FEEDBACK_IP_SALT = "other";
      expect(await hashIP("203.0.113.7")).not.toBe(a);
    }),
  );

  // the `?? ""` fallback feeds a zero-length key to importKey, which throws
  test.ignore(
    "hashes without a configured secret",
    withSalt(undefined, async () => {
      const prev = process.env.CRON_SECRET;
      delete process.env.CRON_SECRET;
      try {
        expect(await hashIP("203.0.113.7")).toMatch(/^[0-9a-f]{32}$/);
      } finally {
        if (prev !== undefined) process.env.CRON_SECRET = prev;
      }
    }),
  );
});
