import type { CSSProperties } from "react";

type Rgb = {
  r: number;
  g: number;
  b: number;
};

type ThemeColorStyle = CSSProperties &
  Record<
    | "--user-color-light-bg"
    | "--user-color-light-text"
    | "--user-color-light-border"
    | "--user-color-light-accent"
    | "--user-color-dark-bg"
    | "--user-color-dark-text"
    | "--user-color-dark-border"
    | "--user-color-dark-accent",
    string
  >;

const LIGHT_FOREGROUND = "#111319";
const LIGHT_SURFACE = "#FFFFFF";
const LIGHT_BORDER = "#A2B2C3";
const DARK_FOREGROUND = "#E6E6E6";
const DARK_SURFACE = "#111319";
const DARK_BORDER = "#66778F";

function clamp(value: number, min = 0, max = 255): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(value: string | null | undefined): string {
  const input = value?.trim() ?? "";

  if (/^#[0-9a-f]{6}$/i.test(input)) {
    return input.toUpperCase();
  }

  if (/^#[0-9a-f]{3}$/i.test(input)) {
    const [r, g, b] = input.slice(1).split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  return LIGHT_BORDER;
}

function hexToRgb(value: string): Rgb {
  const normalized = normalizeHex(value);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b]
    .map((channel) => Math.round(clamp(channel)).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

function mix(source: string, target: string, targetAmount: number): string {
  const from = hexToRgb(source);
  const to = hexToRgb(target);
  const amount = Math.min(1, Math.max(0, targetAmount));

  return rgbToHex({
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount,
  });
}

function relativeLuminance(value: string): number {
  const { r, g, b } = hexToRgb(value);
  const channels = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function readableText(
  background: string,
  preferred: string | null | undefined,
  lightText: string,
  darkText: string
): string {
  const normalizedPreferred = preferred ? normalizeHex(preferred) : null;

  if (
    normalizedPreferred &&
    contrastRatio(background, normalizedPreferred) >= 4.5
  ) {
    return normalizedPreferred;
  }

  return contrastRatio(background, darkText) >= contrastRatio(background, lightText)
    ? darkText
    : lightText;
}

function lightBackground(base: string): string {
  const luminance = relativeLuminance(base);

  if (luminance < 0.035) return mix(base, LIGHT_SURFACE, 0.16);
  if (luminance > 0.94) return LIGHT_SURFACE;
  return base;
}

function darkBackground(base: string): string {
  const luminance = relativeLuminance(base);

  if (luminance < 0.035) return mix(base, DARK_FOREGROUND, 0.18);
  if (luminance > 0.72) return mix(base, DARK_SURFACE, 0.48);
  if (luminance > 0.38) return mix(base, DARK_SURFACE, 0.34);
  return mix(base, DARK_SURFACE, 0.18);
}

function lightBorder(base: string, background: string): string {
  if (contrastRatio(background, LIGHT_SURFACE) < 1.25) return LIGHT_BORDER;
  return mix(base, LIGHT_FOREGROUND, 0.24);
}

function darkBorder(base: string, background: string): string {
  if (contrastRatio(background, DARK_SURFACE) < 1.35) return DARK_BORDER;
  return mix(base, DARK_FOREGROUND, 0.26);
}

/**
 * Keeps the user-selected HEX value as the source of truth and derives
 * readable surfaces for Outline light and dark themes at render time.
 */
export function getThemeColorStyle(
  color: string | null | undefined,
  preferredTextColor?: string | null
): ThemeColorStyle {
  const base = normalizeHex(color);
  const lightBg = lightBackground(base);
  const darkBg = darkBackground(base);
  const lightAccent = lightBorder(base, lightBg);
  const darkAccent = darkBorder(base, darkBg);

  return {
    "--user-color-light-bg": lightBg,
    "--user-color-light-text": readableText(
      lightBg,
      preferredTextColor,
      LIGHT_SURFACE,
      LIGHT_FOREGROUND
    ),
    "--user-color-light-border": lightAccent,
    "--user-color-light-accent": lightAccent,
    "--user-color-dark-bg": darkBg,
    "--user-color-dark-text": readableText(
      darkBg,
      preferredTextColor,
      DARK_FOREGROUND,
      LIGHT_FOREGROUND
    ),
    "--user-color-dark-border": darkAccent,
    "--user-color-dark-accent": darkAccent,
  };
}
