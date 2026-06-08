import React from "react";

export function slugify(str: string) {
  return str
    .toString()
    .toLowerCase()
    .trim() // Remove whitespace from both ends of a string
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/&/g, "-and-") // Replace & with 'and'
    .replace(/[^\w-]+/g, "") // Remove all non-word characters except for -
    .replace(/--+/g, "-"); // Replace multiple - with single -
}

function flattenChildren(children: React.ReactNode): string {
  if (children == null || typeof children === "boolean") return "";
  if (typeof children === "string" || typeof children === "number")
    return String(children);
  if (Array.isArray(children)) return children.map(flattenChildren).join("");
  if (React.isValidElement(children))
    return flattenChildren(
      (children.props as { children?: React.ReactNode }).children,
    );
  return "";
}

export function createHeading(level: number) {
  const Heading = ({ children }: { children: React.ReactNode }) => {
    const text = flattenChildren(children);
    const slug = slugify(text);
    return React.createElement(
      `h${level}`,
      { id: slug },
      [
        React.createElement("a", {
          href: `#${slug}`,
          key: `link-${slug}`,
          className: "anchor",
          "aria-label": `Link to section: ${text}`,
        }),
      ],
      children,
    );
  };

  Heading.displayName = `Heading${level}`;

  return Heading;
}
