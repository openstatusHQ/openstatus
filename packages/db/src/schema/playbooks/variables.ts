/** A flat name → value map: the shape a Handlebars context takes. */
export type PlaybookVariables = Record<string, string>;

export const PLAYBOOK_VARIABLE_NAME = /^[a-z0-9_]{1,64}$/;
export const PLAYBOOK_VARIABLE_VALUE_MAX_CHARS = 500;

// `{{name}}` only, the subset that means the same in Handlebars. Build a fresh
// regex per call: a shared `g` regex carries `lastIndex` between callers.
const pattern = () => /\{\{\s*([a-z0-9_]{1,64})\s*\}\}/g;

/** Names used in the text, each once, in order of first use. */
export function playbookVariableNames(content: string): string[] {
  const names = new Set<string>();
  for (const match of content.matchAll(pattern())) {
    if (match[1]) names.add(match[1]);
  }
  return [...names];
}

// own keys only, so `{{constructor}}` never resolves to a prototype member
export function playbookVariableValue(
  variables: PlaybookVariables | null | undefined,
  name: string,
): string | undefined {
  return variables && Object.prototype.hasOwnProperty.call(variables, name)
    ? variables[name]
    : undefined;
}

/** Replaces `{{name}}` by its value; a variable without one stays as written. */
export function renderPlaybook(
  content: string,
  variables: PlaybookVariables | null | undefined,
  /** How a filled-in value is written, e.g. marked up for a preview. */
  format: (value: string) => string = (value) => value,
): string {
  if (!variables) return content;
  return content.replace(pattern(), (match: string, name: string) => {
    const value = playbookVariableValue(variables, name);
    return value ? format(value) : match;
  });
}
