import plugin from "tailwindcss/plugin";
import themeConfig from "../config/theme.json";

// Helper to extract a clean font name.
const findFont = (fontStr) =>
  fontStr.replace(/\+/g, " ").replace(/:[^:]+/g, "");

// Set font families dynamically, filtering out 'type' keys
const fontFamilies = Object.entries(themeConfig.fonts.font_family)
  .filter(([key]) => !key.includes("type"))
  .reduce((acc, [key, font]) => {
    acc[key] =
      `${findFont(font)}, ${themeConfig.fonts.font_family[`${key}_type`] || "sans-serif"}`;
    return acc;
  }, {});

const defaultColorGroups = [
  { colors: themeConfig.colors.default.theme_color, prefix: "" },
  { colors: themeConfig.colors.default.text_color, prefix: "" },
];
const darkColorGroups = [];
if (themeConfig.colors.lightmode?.theme_color) {
  darkColorGroups.push({
    colors: themeConfig.colors.lightmode.theme_color,
    prefix: "lightmode-",
  });
}

if (themeConfig.colors.lightmode?.text_color) {
  darkColorGroups.push({
    colors: themeConfig.colors.lightmode.text_color,
    prefix: "lightmode-",
  });
}


const getVars = (groups) => {
  const vars = {};
  groups.forEach(({ colors, prefix }) => {
    Object.entries(colors).forEach(([k, v]) => {
      const cssKey = k.replace(/_/g, "-");
      vars[`--color-${prefix}${cssKey}`] = v;
    });
  });
  return vars;
};

const defaultVars = getVars(defaultColorGroups);
const darkVars = getVars(darkColorGroups);


const baseSize = Number(themeConfig.fonts.font_size.base);
const scale = Number(themeConfig.fonts.font_size.scale);
const calculateFontSizes = (base, scale) => {
  const sizes = {};
  let currentSize = scale;
  for (let i = 6; i >= 1; i--) {
    sizes[`h${i}`] = `${currentSize}rem`;
    sizes[`h${i}-sm`] = `${currentSize * 0.9}rem`;
    currentSize *= scale;
  }
  sizes.base = `${base}px`;
  sizes["base-sm"] = `${base * 0.8}px`;
  return sizes;
};
const fontSizes = calculateFontSizes(baseSize, scale);

const fontVars = {};
Object.entries(fontSizes).forEach(([key, value]) => {
  fontVars[`--text-${key}`] = value;
});
Object.entries(fontFamilies).forEach(([key, font]) => {
  fontVars[`--font-${key}`] = font;
});

const baseVars = { ...fontVars, ...defaultVars, ...darkVars };


// Build a colorsMap including both sets
const colorsMap = {};
[...defaultColorGroups, ...darkColorGroups].forEach(({ colors, prefix }) => {
  Object.entries(colors).forEach(([key]) => {
    const cssKey = key.replace(/_/g, "-");
    colorsMap[prefix + cssKey] = `var(--color-${prefix}${cssKey})`;
  });
});


module.exports = plugin.withOptions(() => {
  return function ({ addBase, addUtilities, matchUtilities }) {
    // Default vars on :root; dark vars on .dark
    addBase({
      ":root": baseVars,
    });

    const fontUtils = {};
    Object.keys(fontFamilies).forEach((key) => {
      fontUtils[`.font-${key}`] = { fontFamily: `var(--font-${key})` };
    });
    Object.keys(fontSizes).forEach((key) => {
      fontUtils[`.text-${key}`] = { fontSize: `var(--text-${key})` };
    });
    addUtilities(fontUtils, {
      variants: ["responsive", "hover", "focus", "active", "disabled"],
    });

    matchUtilities(
      {
        bg: (value) => ({ backgroundColor: value }),
        text: (value) => ({ color: value }),
        border: (value) => ({ borderColor: value }),
        fill: (value) => ({ fill: value }),
        stroke: (value) => ({ stroke: value }),
      },
      { values: colorsMap, type: "color" },
    );

    matchUtilities(
      {
        from: (value) => ({
          "--tw-gradient-from": value,
          "--tw-gradient-via-stops":
            "var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position))",
          "--tw-gradient-stops":
            "var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position))",
        }),
        to: (value) => ({
          "--tw-gradient-to": value,
          "--tw-gradient-via-stops":
            "var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position))",
          "--tw-gradient-stops":
            "var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position))",
        }),
        via: (value) => ({
          "--tw-gradient-via": value,
          "--tw-gradient-via-stops":
            "var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-via) var(--tw-gradient-via-position), var(--tw-gradient-to) var(--tw-gradient-to-position)",
        }),
      },
      { values: colorsMap, type: "color" },
    );
  };
});