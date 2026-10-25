// What a tutorial exports as `meta`: the copy around its video and what it
// needs to run. The recorder checks it and copies it into the timeline.
export const REQUIREMENTS = ["checker"];

export function validateMeta(meta, name) {
  const problems = [];
  if (!meta || typeof meta !== "object")
    return [`${name}: export a meta object`];
  if (!Number.isInteger(meta.order) || meta.order < 1)
    problems.push(`${name}: meta.order must be a positive integer`);
  for (const key of ["title", "subtitle", "outroTitle", "outroSubtitle"])
    if (typeof meta[key] !== "string" || meta[key].trim() === "")
      problems.push(`${name}: meta.${key} must be a non-empty string`);
  for (const r of meta.requires ?? [])
    if (!REQUIREMENTS.includes(r))
      problems.push(`${name}: unknown requirement "${r}"`);
  return problems;
}
