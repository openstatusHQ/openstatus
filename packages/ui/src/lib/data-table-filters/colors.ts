export function hexToRgb(hex: string): string {
  const normalizedHex = hex.trim().replace(/^#/, "");

  let rgbHex: string;

  if (/^[0-9a-fA-F]{3}$/.test(normalizedHex)) {
    rgbHex = normalizedHex
      .split("")
      .map((char) => char + char)
      .join("");
  } else if (/^[0-9a-fA-F]{6}$/.test(normalizedHex)) {
    rgbHex = normalizedHex;
  } else if (/^[0-9a-fA-F]{8}$/.test(normalizedHex)) {
    rgbHex = normalizedHex.substring(0, 6);
  } else {
    return "0, 0, 0";
  }

  const r = parseInt(rgbHex.substring(0, 2), 16);
  const g = parseInt(rgbHex.substring(2, 4), 16);
  const b = parseInt(rgbHex.substring(4, 6), 16);

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return "0, 0, 0";
  }

  return `${r}, ${g}, ${b}`;
}
