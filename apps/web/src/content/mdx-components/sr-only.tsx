import type React from "react";

/** A demo's text alternative: visually hidden on the page, read by screen readers, plain copy in the markdown. */
export function SrOnly(props: { children?: React.ReactNode }) {
  return <div className="sr-only" {...props} />;
}
