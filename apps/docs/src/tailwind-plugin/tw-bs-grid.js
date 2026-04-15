import plugin from "tailwindcss/plugin";

module.exports = plugin.withOptions(() => {
  return ({ addComponents }) => {
    const gridColumns = 12;
    const gridGutterWidth = "1.5rem";
    const gridGutters = {
      0: "0",
      1: "0.25rem",
      2: "0.5rem",
      3: "1rem",
      4: "1.5rem",
      5: "3rem",
    };
    const respectImportant = true;
    const columns = Array.from({ length: gridColumns }, (_, i) => i + 1);
    const rowColsSteps = columns.slice(0, Math.floor(gridColumns / 2));

    // row
    addComponents(
      {
        ".row": {
          "--bs-gutter-x": gridGutterWidth,
          "--bs-gutter-y": 0,
          display: "flex",
          flexWrap: "wrap",
          marginTop: "calc(var(--bs-gutter-y) * -1)",
          marginRight: "calc(var(--bs-gutter-x) / -2)",
          marginLeft: "calc(var(--bs-gutter-x) / -2)",
          "& > *": {
            boxSizing: "border-box",
            flexShrink: 0,
            width: "100%",
            maxWidth: "100%",
            paddingRight: "calc(var(--bs-gutter-x) / 2)",
            paddingLeft: "calc(var(--bs-gutter-x) / 2)",
            marginTop: "var(--bs-gutter-y)",
          },
        },
      },
      { respectImportant },
    );

    // columns
    addComponents(
      [
        {
          ".col": { flex: "1 0 0%" },
          ".row-cols-auto": { "& > *": { flex: "0 0 auto", width: "auto" } },
        },
        ...rowColsSteps.map((num) => ({
          [`.row-cols-${num}`]: {
            "& > *": { flex: "0 0 auto", width: `${100 / num}%` },
          },
        })),
        { ".col-auto": { flex: "0 0 auto", width: "auto" } },
        ...columns.map((num) => ({
          [`.col-${num}`]: {
            flex: "0 0 auto",
            width: `${(100 / gridColumns) * num}%`,
          },
        })),
      ],
      { respectImportant },
    );

    // offset
    addComponents(
      [0, ...columns.slice(0, -1)].map((num) => ({
        [`.offset-${num}`]: { marginLeft: `${(100 / gridColumns) * num}%` },
      })),
      { respectImportant },
    );

    // gutters
    if (Object.keys(gridGutters).length) {
      const gutterComponents = Object.entries(gridGutters).reduce(
        (acc, [key, value]) => {
          acc[`.g-${key}`] = { "--bs-gutter-x": value, "--bs-gutter-y": value };
          acc[`.gx-${key}`] = { "--bs-gutter-x": value };
          acc[`.gy-${key}`] = { "--bs-gutter-y": value };
          return acc;
        },
        {},
      );
      addComponents(gutterComponents, { respectImportant });
    }

    // order
    addComponents(
      [
        {
          ".order-first": { order: "-1" },
          ".order-last": { order: gridColumns + 1 },
        },
        ...[0, ...columns].map((num) => ({
          [`.order-${num}`]: { order: String(num) },
        })),
      ],
      { respectImportant },
    );
  };
});
