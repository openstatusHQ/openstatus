import { createMDX } from "fumadocs-mdx/next";

const config = {
  reactStrictMode: true,
};

const withMDX = createMDX();

export default withMDX(config);
