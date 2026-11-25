// What a tutorial exports as `meta`: the copy around its video and what it
// needs to run. The recorder checks it and copies it into the timeline.
// A product update (scripts/updates) sets `format: "update"` and needs only a
// title and a tagline.
export const REQUIREMENTS = ["checker"];

// Feed copy: the title is read in under a second, so it stays short.
export const UPDATE_TITLE_MAX = 40;

function validateUpdate(meta, name) {
  const problems = [];
  for (const key of ["title", "tagline"])
    if (typeof meta[key] !== "string" || meta[key].trim() === "")
      problems.push(`${name}: meta.${key} must be a non-empty string`);
  if (typeof meta.title === "string" && meta.title.length > UPDATE_TITLE_MAX)
    problems.push(
      `${name}: meta.title is ${meta.title.length} characters, an update's title fits in ${UPDATE_TITLE_MAX}`,
    );
  if (
    meta.link !== undefined &&
    (typeof meta.link !== "string" || !/^[\w-]+(\/[\w-]+)*$/.test(meta.link))
  )
    problems.push(
      `${name}: meta.link is a path after openstatus.dev/, e.g. "changelog/saml-sso"`,
    );
  return problems;
}

export function validateMeta(meta, name) {
  if (!meta || typeof meta !== "object")
    return [`${name}: export a meta object`];
  return [
    ...(meta.format === "update"
      ? validateUpdate(meta, name)
      : validateTutorial(meta, name)),
    ...validateShared(meta, name),
  ];
}

function validateTutorial(meta, name) {
  const problems = [];
  if (meta.format !== undefined)
    problems.push(`${name}: meta.format can only be "update"`);
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
  return problems;
}

function validateShared(meta, name) {
  const problems = [];
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
