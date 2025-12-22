import { existsSync } from "node:fs";
import { join } from "node:path";
import { cn } from "@/lib/utils";
import { Button } from "@openstatus/ui";
import { MDXRemote, type MDXRemoteProps } from "next-mdx-remote/rsc";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { Tweet, type TweetProps } from "react-tweet";
import { highlight } from "sugar-high";
import { CopyButton } from "./copy-button";
import { HighlightText } from "./highlight-text";
import { ImageZoom } from "./image-zoom";
import { LatencyChartTable } from "./latency-chart-table";

function Table({
  data,
}: {
  data: { headers: React.ReactNode[]; rows: React.ReactNode[][] };
}) {
  const headers = data.headers.map((header: React.ReactNode, index: number) => (
    <th key={index}>{header}</th>
  ));
  const rows = data.rows.map((row: React.ReactNode[], index: number) => (
    <tr key={index}>
      {row.map((cell: React.ReactNode, cellIndex: number) => (
        <td key={cellIndex}>{cell}</td>
      ))}
    </tr>
  ));

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>{headers}</tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

function Grid({
  cols = 2,
  children,
  className,
}: {
  cols?: 1 | 2 | 3 | 4 | 5;
  children: React.ReactNode;
  className?: string;
}) {
  const colsClass = {
    1: "md:grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
    5: "md:grid-cols-5",
  };

  // Remove top border from all except first row
  const topBorderClass = {
    1: "[&>*]:border-t-0 [&>*:first-child]:border-t",
    2: "[&>*]:border-t-0 [&>*:first-child]:border-t md:[&>*:nth-child(-n+2)]:border-t",
    3: "[&>*]:border-t-0 [&>*:first-child]:border-t md:[&>*:nth-child(-n+3)]:border-t",
    4: "[&>*]:border-t-0 [&>*:first-child]:border-t md:[&>*:nth-child(-n+4)]:border-t",
    5: "[&>*]:border-t-0 [&>*:first-child]:border-t md:[&>*:nth-child(-n+5)]:border-t",
  };

  // Remove left border from all except first column (only on md+ screens)
  const leftBorderClass = {
    1: "",
    2: "md:[&>*]:border-l-0 md:[&>*:nth-child(2n+1)]:border-l",
    3: "md:[&>*]:border-l-0 md:[&>*:nth-child(3n+1)]:border-l",
    4: "md:[&>*]:border-l-0 md:[&>*:nth-child(4n+1)]:border-l",
    5: "md:[&>*]:border-l-0 md:[&>*:nth-child(5n+1)]:border-l",
  };

  return (
    <div
      className={cn(
        "my-4 grid grid-cols-1",
        "[&>*]:border [&>*]:border-border [&>*]:p-4",
        // NOTE: remove extra margin from prose grid cells of first and last element
        "[&>*>*:first-child]:!mt-0 [&>*>*:last-child]:!mb-0",
        colsClass[cols],
        topBorderClass[cols],
        leftBorderClass[cols],
        className,
      )}
    >
      {children}
    </div>
  );
}

function CustomLink(props: React.ComponentProps<"a">) {
  const href = props.href ?? "";

  if (href.startsWith("/")) {
    return (
      <Link href={href} {...props}>
        {props.children}
      </Link>
    );
  }

  if (href.startsWith("#")) {
    return <a {...props} />;
  }

  return <a target="_blank" rel="noopener noreferrer" {...props} />;
}

function ButtonLink(
  props: React.ComponentProps<typeof Button> & { href: string },
) {
  return (
    <Button
      variant="outline"
      size="lg"
      className="no-underline! h-auto rounded-none px-4 py-4 text-base"
      asChild
      {...props}
    >
      <CustomLink href={props.href}>{props.children}</CustomLink>
    </Button>
  );
}

function Code({ children, className, ...props }: React.ComponentProps<"code">) {
  // Only apply syntax highlighting if a language is specified (className contains "language-")
  const hasLanguage = className?.includes("language-");

  if (hasLanguage) {
    const codeHTML = highlight(children?.toString() ?? "");
    return (
      <code
        // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
        dangerouslySetInnerHTML={{ __html: codeHTML }}
        className={className}
        {...props}
      />
    );
  }

  // Plain code block without language - render as-is
  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}

function extractTextFromReactNode(node: React.ReactNode): string {
  if (typeof node === "string") {
    return node;
  }
  if (typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractTextFromReactNode).join("");
  }
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    if (props.children) {
      return extractTextFromReactNode(props.children);
    }
  }
  return "";
}

function Pre({ children, ...props }: React.ComponentProps<"pre">) {
  const textContent = extractTextFromReactNode(children);
  return (
    <div className="relative">
      <pre {...props}>{children}</pre>
      <CopyButton
        copyText={textContent}
        className="absolute top-px right-px backdrop-blur-xs"
      />
    </div>
  );
}

function slugify(str: string) {
  return str
    .toString()
    .toLowerCase()
    .trim() // Remove whitespace from both ends of a string
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/&/g, "-and-") // Replace & with 'and'
    .replace(/[^\w-]+/g, "") // Remove all non-word characters except for -
    .replace(/--+/g, "-"); // Replace multiple - with single -
}

function createHeading(level: number) {
  const Heading = ({ children }: { children: React.ReactNode }) => {
    const slug = slugify(children?.toString() ?? "");
    return React.createElement(
      `h${level}`,
      { id: slug },
      [
        React.createElement("a", {
          href: `#${slug}`,
          key: `link-${slug}`,
          className: "anchor",
        }),
      ],
      children,
    );
  };

  Heading.displayName = `Heading${level}`;

  return Heading;
}

function Details({
  children,
  summary,
  open = false,
}: {
  children: React.ReactNode;
  summary: string;
  open?: boolean;
}) {
  return (
    <details open={open}>
      <summary>{summary}</summary>
      {React.isValidElement(children)
        ? // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          React.cloneElement(children, { hidden: "until-found" } as any)
        : children}
    </details>
  );
}

function CustomImage({
  className,
  ...props
}: React.ComponentProps<typeof Image>) {
  const { src, alt, width, height, ...rest } = props;

  if (!src || typeof src !== "string") {
    return (
      <figure>
        <ImageZoom
          backdropClassName={cn(
            '[&_[data-rmiz-modal-overlay="visible"]]:bg-background/80',
          )}
          zoomMargin={16}
        >
          <Image
            className={className}
            src={src}
            alt={alt ?? "image"}
            width={0}
            height={0}
            sizes="100vw"
            style={{ width: "100%", height: "auto" }}
            {...rest}
          />
        </ImageZoom>
        <figcaption>{alt}</figcaption>
      </figure>
    );
  }

  // Generate dark mode image path by adding .dark before extension
  const getDarkImagePath = (path: string) => {
    const match = path.match(/^(.+)(\.[^.]+)$/);
    if (match) {
      return `${match[1]}.dark${match[2]}`;
    }
    return path;
  };

  // Check if dark image exists, fallback to light version if not
  const checkDarkImageExists = (darkPath: string) => {
    // If path starts with /, it's in the public directory
    if (darkPath.startsWith("/")) {
      const publicPath = join(process.cwd(), "public", darkPath);
      return existsSync(publicPath);
    }
    // For relative paths, check relative to public
    const publicPath = join(process.cwd(), "public", darkPath);
    return existsSync(publicPath);
  };

  const darkSrc = getDarkImagePath(src);
  const useDarkImage = checkDarkImageExists(darkSrc);

  return (
    <figure>
      <ImageZoom
        backdropClassName={cn(
          '[&_[data-rmiz-modal-overlay="visible"]]:bg-black/80',
        )}
        zoomMargin={16}
      >
        <Image
          {...rest}
          src={src}
          alt={alt ?? ""}
          width={0}
          height={0}
          sizes="100vw"
          style={{ width: "100%", height: "auto" }}
          className={cn("block dark:hidden", className)}
        />
      </ImageZoom>
      <ImageZoom
        backdropClassName={cn(
          '[&_[data-rmiz-modal-overlay="visible"]]:bg-black/80',
        )}
        zoomMargin={16}
      >
        <Image
          {...rest}
          src={useDarkImage ? darkSrc : src}
          alt={alt ?? ""}
          width={0}
          height={0}
          sizes="100vw"
          style={{ width: "100%", height: "auto" }}
          className={cn("hidden dark:block", className)}
        />
      </ImageZoom>
      {alt && <figcaption>{alt}</figcaption>}
    </figure>
  );
}

export const components = {
  h1: createHeading(1),
  h2: createHeading(2),
  h3: createHeading(3),
  h4: createHeading(4),
  h5: createHeading(5),
  h6: createHeading(6),
  Image: CustomImage,
  a: CustomLink,
  ButtonLink: ButtonLink,
  code: Code,
  pre: Pre,
  Table,
  Grid,
  Details, // Capital D for JSX usage with props
  details: Details, // lowercase for HTML tag replacement
  SimpleChart: LatencyChartTable,
  Tweet: (props: TweetProps) => {
    return (
      <div data-theme="light" className="not-prose [&>div]:mx-auto">
        <Tweet {...props} />
      </div>
    );
  },
};

export function CustomMDX(props: MDXRemoteProps) {
  return (
    <React.Suspense>
      <HighlightText>
        <MDXRemote
          {...props}
          components={
            {
              ...components,
              ...(props.components || {}),
            } as MDXRemoteProps["components"]
          }
        />
      </HighlightText>
    </React.Suspense>
  );
}
