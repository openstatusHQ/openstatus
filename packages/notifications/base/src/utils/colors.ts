type Color = "red" | "yellow" | "green" | "blue";

export const COLORS = {
  red: "#e7000b", // Alert/Error - red left border
  yellow: "#f49f1e", // Degraded/Warning - yellow/orange left border
  green: "#20c45f", // Recovery/Success - green left border
  blue: "#3a81f6", // Monitoring - blue left border
} as const satisfies Record<Color, string>;

export const COLOR_DECIMALS = {
  red: 15138827, // Alert/Error - red left border
  yellow: 16031518, // Degraded/Warning - yellow/orange left border
  green: 2147423, // Recovery/Success - green left border
  blue: 3834358, // Monitoring - blue left border
} as const satisfies Record<Color, number>;
