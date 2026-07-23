/**
 * Shared column-span tokens for the login + onboarding split-shells.
 * Keeping them in one place ensures the form column has the same width
 * across both pages (onboarding form is on the left, login form is on
 * the right), so the grids feel visually aligned when navigating
 * between them.
 *
 * The grid is `xl:grid-cols-5`. Below `xl` it falls back to a 50/50
 * `md:grid-cols-2` split or single column on mobile.
 */
export const SHELL_FORM_COLUMN = "xl:col-span-2";
export const SHELL_CONTENT_COLUMN = "xl:col-span-3";
