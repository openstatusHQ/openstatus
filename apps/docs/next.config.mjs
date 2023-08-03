// const withNextra = require("nextra")({
//   theme: "nextra-theme-docs",
//   themeConfig: "./theme.config.tsx",
//   rootDir: __dirname,
// });

// module.exports = withNextra();

import nextra from "nextra";

const withNextra = nextra({
  theme: "nextra-theme-docs",
  themeConfig: "./theme.config.tsx",

  flexsearch: {
    codeblock: false,
  },
});

export default withNextra({
  reactStrictMode: true,
});
