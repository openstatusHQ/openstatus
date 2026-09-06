export interface TokenizeOptions {
  /** delimiter between `key:value` pairs (default: `" "`) */
  fieldDelimiter?: string;
  /** delimiter between key and value (default: `":"`) */
  keyValueDelimiter?: string;
}

/**
 * Tokenize a `key:value` filter string, respecting quoted values.
 *
 * Values are quoted with `"` or `'`; inside quotes, `\\` and `\<quote>` are
 * escapes. Keep in sync with {@link serializeFilterValue}.
 *
 * @example
 * tokenizeFilterInput('name:john regions:ams') // [["name", "john"], ["regions", "ams"]]
 * tokenizeFilterInput('name:"john doe"') // [["name", "john doe"]]
 * tokenizeFilterInput('url:https://example.com/a?b=c') // [["url", "https://example.com/a?b=c"]]
 */
export function tokenizeFilterInput(
  input: string,
  options: TokenizeOptions = {},
): Array<[string, string]> {
  // `|| ` (not a destructuring default): an empty delimiter would match at every
  // index and stall the scanner.
  const fieldDelimiter = options.fieldDelimiter || " ";
  const keyValueDelimiter = options.keyValueDelimiter || ":";
  const delimiterIsWhitespace = /^\s+$/.test(fieldDelimiter);
  const trimmed = input.trim();
  const tokens: Array<[string, string]> = [];

  const isBoundary = (index: number) =>
    delimiterIsWhitespace
      ? /\s/.test(trimmed[index])
      : trimmed.startsWith(fieldDelimiter, index);

  const skipToBoundary = (index: number) => {
    let i = index;
    while (i < trimmed.length && !isBoundary(i)) i++;
    return i;
  };

  // Hand-rolled scanner instead of a `/(\w+):(?:"([^"]*)"|(\S+))/g` regex: that
  // pattern restarts inside every word run, so a long unmatched run costs
  // O(n^2) (CodeQL: polynomial ReDoS).
  let i = 0;
  while (i < trimmed.length) {
    if (isBoundary(i)) {
      i += delimiterIsWhitespace ? 1 : fieldDelimiter.length;
      continue;
    }

    // `a:1; b:2` with a non-whitespace delimiter: the space after it is not a
    // boundary, so without this the key reads as " b" and the field is dropped.
    // Keys never contain whitespace, and values are scanned separately.
    if (!delimiterIsWhitespace && /\s/.test(trimmed[i])) {
      i++;
      continue;
    }

    const keyStart = i;
    while (
      i < trimmed.length &&
      !isBoundary(i) &&
      !trimmed.startsWith(keyValueDelimiter, i)
    ) {
      i++;
    }

    // No `key:` prefix before the next field boundary — drop the whole token.
    if (i >= trimmed.length || isBoundary(i) || i === keyStart) {
      i = skipToBoundary(i === keyStart ? i + 1 : i);
      continue;
    }

    const key = trimmed.slice(keyStart, i);
    i += keyValueDelimiter.length;

    const quote = trimmed[i];
    if (quote === '"' || quote === "'") {
      const quoted = readQuoted(trimmed, i, quote);
      if (quoted) {
        tokens.push([key, quoted.value]);
        i = skipToBoundary(quoted.end);
        continue;
      }
    }

    const valueStart = i;
    i = skipToBoundary(i);
    const value = trimmed.slice(valueStart, i).trim();
    if (value) tokens.push([key, value]);
  }

  return tokens;
}

/** Returns `null` when the quote is never closed. */
function readQuoted(
  input: string,
  start: number,
  quote: string,
): { value: string; end: number } | null {
  let value = "";
  let i = start + 1;
  while (i < input.length) {
    const char = input[i];
    if (char === "\\" && (input[i + 1] === quote || input[i + 1] === "\\")) {
      value += input[i + 1];
      i += 2;
      continue;
    }
    if (char === quote) return { value, end: i + 1 };
    value += char;
    i++;
  }
  return null;
}

/**
 * Quote/escape a value so it survives {@link tokenizeFilterInput}.
 */
export function serializeFilterValue(
  value: string,
  options: TokenizeOptions = {},
): string {
  const fieldDelimiter = options.fieldDelimiter || " ";
  const needsQuotes =
    /\s/.test(value) ||
    value.includes(fieldDelimiter) ||
    value.includes('"') ||
    value.includes("\\") ||
    value.startsWith("'");

  if (!needsQuotes) return value;

  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
