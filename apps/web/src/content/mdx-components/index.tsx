import { LatencyChartTable } from "../latency-chart-table";
import { ButtonLink } from "./button-link";
import { Code } from "./code";
import { CustomImage } from "./custom-image";
import { CustomLink } from "./custom-link";
import { Details } from "./details";
import { Grid } from "./grid";
import { createHeading } from "./heading";
import { Pre } from "./pre";
import { MDXStatusPageExample } from "./status-page-example";
import { Table } from "./table";
import { MDXTweet } from "./tweet";

export { slugify } from "./heading";

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
  table: Table,
  Grid,
  Details, // Capital D for JSX usage with props
  details: Details, // lowercase for HTML tag replacement
  SimpleChart: LatencyChartTable,
  Tweet: MDXTweet,
  StatusPageExample: MDXStatusPageExample,
};
