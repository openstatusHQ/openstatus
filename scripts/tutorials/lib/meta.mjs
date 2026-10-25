// What a tutorial exports as `meta`: the copy around its video and what it
// needs to run. The recorder checks it and copies it into the timeline.
export const REQUIREMENTS = ["checker"];

export function validateMeta(meta, name) {
  const problems = [];
  if (!meta || typeof meta !== "object")
    return [`${name}: export a meta object`];
  if (!Number.isInteger(meta.order) || meta.order < 1)
    problems.push(`${name}: meta.order must be a positive integer`);
  for (const key of [
    "label",
    "title",
    "subtitle",
    "outroTitle",
    "outroSubtitle",
  ])
    if (typeof meta[key] !== "string" || meta[key].trim() === "")
      problems.push(`${name}: meta.${key} must be a non-empty string`);
  if (typeof meta.label === "string" && /\s/.test(meta.label.trim()))
    problems.push(`${name}: meta.label must be one word`);
  // The thumbnail shows "01 · Label", title and subtitle unless these replace
  // them.
  for (const key of ["thumbEyebrow", "thumbTitle", "thumbSubtitle"])
    if (
      meta[key] !== undefined &&
      (typeof meta[key] !== "string" || meta[key].trim() === "")
    )
      problems.push(`${name}: meta.${key} must be a non-empty string if set`);
  if (
    meta.viewport !== undefined &&
    !["width", "height"].every(
      (k) => Number.isInteger(meta.viewport?.[k]) && meta.viewport[k] > 0,
    )
  )
    problems.push(
      `${name}: meta.viewport needs a positive integer width and height`,
    );
  if (meta.requires !== undefined && !Array.isArray(meta.requires))
    problems.push(`${name}: meta.requires must be an array`);
  for (const r of Array.isArray(meta.requires) ? meta.requires : [])
    if (!REQUIREMENTS.includes(r))
      problems.push(`${name}: unknown requirement "${r}"`);
  return problems;
}
