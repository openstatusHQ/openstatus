// This code is copy pasta from umami <3

export const DESKTOP_OS = [
  "BeOS",
  "Chrome OS",
  "Linux",
  "Mac OS",
  "Open BSD",
  "OS/2",
  "QNX",
  "Sun OS",
  "Windows 10",
  "Windows 2000",
  "Windows 3.11",
  "Windows 7",
  "Windows 8",
  "Windows 8.1",
  "Windows 95",
  "Windows 98",
  "Windows ME",
  "Windows Server 2003",
  "Windows Vista",
  "Windows XP",
];

export const MOBILE_OS = [
  "Amazon OS",
  "Android OS",
  "BlackBerry OS",
  "iOS",
  "Windows Mobile",
];

export const DESKTOP_SCREEN_WIDTH = 1920;
export const LAPTOP_SCREEN_WIDTH = 1024;
export const MOBILE_SCREEN_WIDTH = 479;

export function getDevice(screen: string, os: string) {
  if (!screen) return;

  const [width] = screen.split("x");

  if (DESKTOP_OS.includes(os)) {
    if (os === "Chrome OS" || +width < DESKTOP_SCREEN_WIDTH) {
      return "laptop";
    }
    return "desktop";
  }
  if (MOBILE_OS.includes(os)) {
    if (os === "Amazon OS" || +width > MOBILE_SCREEN_WIDTH) {
      return "tablet";
    }
    return "mobile";
  }

  if (+width >= DESKTOP_SCREEN_WIDTH) {
    return "desktop";
  }
  if (+width >= LAPTOP_SCREEN_WIDTH) {
    return "laptop";
  }
  if (+width >= MOBILE_SCREEN_WIDTH) {
    return "tablet";
  }
  return "mobile";
}
