/**
 * Mini App color engine — the mini app owner picks exactly two colors
 * (principal/secundario); everything else (backgrounds, cards, buttons,
 * hover states, text, borders, icons, chart series, tags, shadows,
 * gradients — light AND dark mode) is generated from those two, with
 * WCAG contrast enforced automatically. Deliberately isolated with no I/O
 * (same "pure, swappable" posture as financialEngine.ts) so it can run
 * both server-side (page.tsx, once per request) and client-side (the
 * config UI's live preview) without any "server-only" boundary.
 */

export const DEFAULT_PRIMARY_COLOR = "#6c63ff";
// Distinct hue from the default primary (a violet) so the two default chart
// series/tags are never accidentally near-identical out of the box.
export const DEFAULT_SECONDARY_COLOR = "#1e7a4c";

// ---------------------------------------------------------------------------
// Color math — hex <-> RGB <-> HSL, WCAG relative luminance and contrast.
// ---------------------------------------------------------------------------

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Hsl {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(hex: string): string {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return h.toLowerCase();
}

export function isValidHexColor(hex: string): boolean {
  return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex.trim());
}

function hexToRgb(hex: string): Rgb {
  const h = normalizeHex(hex);
  const num = parseInt(h.length === 6 ? h : "6c63ff", 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const toHex = (v: number) =>
    clamp(Math.round(v), 0, 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case rN:
      h = (gN - bN) / d + (gN < bN ? 6 : 0);
      break;
    case gN:
      h = (bN - rN) / d + 2;
      break;
    default:
      h = (rN - gN) / d + 4;
  }
  return { h: h * 60, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sN = clamp(s, 0, 100) / 100;
  const lN = clamp(l, 0, 100) / 100;
  const hN = ((h % 360) + 360) % 360;

  if (sN === 0) {
    const v = lN * 255;
    return { r: v, g: v, b: v };
  }

  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((hN / 60) % 2) - 1));
  const m = lN - c / 2;
  let rP = 0;
  let gP = 0;
  let bP = 0;
  if (hN < 60) [rP, gP, bP] = [c, x, 0];
  else if (hN < 120) [rP, gP, bP] = [x, c, 0];
  else if (hN < 180) [rP, gP, bP] = [0, c, x];
  else if (hN < 240) [rP, gP, bP] = [0, x, c];
  else if (hN < 300) [rP, gP, bP] = [x, 0, c];
  else [rP, gP, bP] = [c, 0, x];

  return { r: (rP + m) * 255, g: (gP + m) * 255, b: (bP + m) * 255 };
}

function withHsl(hex: string, mutate: (hsl: Hsl) => Hsl): string {
  return rgbToHex(hslToRgb(mutate(rgbToHsl(hexToRgb(hex)))));
}

/** Blends `hex` toward `towardHex` by `amount` (0-1). */
function mix(hex: string, towardHex: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(towardHex);
  const t = clamp(amount, 0, 1);
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

function toRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

/** WCAG 2.x relative luminance — linearize each sRGB channel, weighted sum. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const linearize = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG contrast ratio between two colors, always >= 1. */
export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA) + 0.05;
  const lB = relativeLuminance(hexB) + 0.05;
  return lA > lB ? lA / lB : lB / lA;
}

const WHITE = "#ffffff";
const NEAR_BLACK = "#101828"; // matches globals.css --color-neutral-900

/** Picks whichever of white/near-black contrasts better against `bg` — the
 * guaranteed-to-pass fallback every other contrast-repair step in this file
 * bottoms out to, since one of the two always clears any realistic
 * threshold against a background that isn't itself mid-gray. */
function contrastPick(bg: string): string {
  const white = contrastRatio(WHITE, bg);
  const black = contrastRatio(NEAR_BLACK, bg);
  return white >= black ? WHITE : NEAR_BLACK;
}

const MAX_CONTRAST_STEPS = 6;
const CONTRAST_STEP_L = 8;

/** Steps `candidate`'s lightness away from `bg`'s lightness (toward white if
 * bg is dark, toward black if bg is light) until it clears `threshold`
 * against bg, capped at MAX_CONTRAST_STEPS — falls back to contrastPick(bg)
 * (always passes) if the cap is reached first. */
function ensureContrast(candidate: string, bg: string, threshold: number): string {
  if (contrastRatio(candidate, bg) >= threshold) return candidate;
  const bgIsLight = relativeLuminance(bg) > 0.5;
  let current = candidate;
  for (let i = 0; i < MAX_CONTRAST_STEPS; i++) {
    current = withHsl(current, (hsl) => ({
      ...hsl,
      l: clamp(hsl.l + (bgIsLight ? -CONTRAST_STEP_L : CONTRAST_STEP_L), 0, 100),
    }));
    if (contrastRatio(current, bg) >= threshold) return current;
  }
  return contrastPick(bg);
}

const TEXT_CONTRAST = 4.5;
const UI_CONTRAST = 3;

// ---------------------------------------------------------------------------
// Tint/shade ramp — 10 steps from one seed color, mirroring the shape of
// globals.css's own --color-accent-50..900 ramps.
// ---------------------------------------------------------------------------

export interface ColorRamp {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
}

const RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
const LIGHTEST_L = 97;
const DARKEST_L = 12;
// Lightest two tints are pulled toward neutral so "fondo"/"tarjeta" never
// read as a neon-pastel wash of the raw hue.
const DESATURATE_50 = 0.35;
const DESATURATE_100 = 0.55;

function generateRamp(seedHex: string): ColorRamp {
  const seed = rgbToHsl(hexToRgb(seedHex));
  // Anchor point for the ramp's midpoint only (step 500 always renders the
  // user's exact hex below) — keeps a near-white/near-black pick from
  // collapsing the whole ramp into one flat tone.
  const anchorL = clamp(seed.l, 18, 82);

  const ramp = {} as ColorRamp;
  for (const step of RAMP_STEPS) {
    if (step === 500) {
      ramp[step] = rgbToHex(hslToRgb(seed));
      continue;
    }
    const l =
      step < 500
        ? LIGHTEST_L + ((anchorL - LIGHTEST_L) * step) / 500
        : anchorL + ((DARKEST_L - anchorL) * (step - 500)) / 400;
    const s = step === 50 ? seed.s * DESATURATE_50 : step === 100 ? seed.s * DESATURATE_100 : seed.s;
    ramp[step] = rgbToHex(hslToRgb({ h: seed.h, s, l }));
  }
  return ramp;
}

// ---------------------------------------------------------------------------
// Full semantic palette.
// ---------------------------------------------------------------------------

export interface MiniAppSemanticSlots {
  backgroundPage: string;
  backgroundSurface: string;
  backgroundSurfaceAlt: string;
  border: string;
  borderStrong: string;
  buttonPrimaryBg: string;
  buttonPrimaryHover: string;
  buttonPrimaryText: string;
  buttonSecondaryBg: string;
  buttonSecondaryHover: string;
  buttonSecondaryText: string;
  titleColor: string;
  textColor: string;
  textMuted: string;
  iconColor: string;
  tagBg: string;
  tagText: string;
  chartSeriesPrimary: string;
  chartSeriesSecondary: string;
  shadowSm: string;
  shadowLg: string;
  gradientHero: string;
  gradientHeroText: string;
  gradientDecorative: string;
}

export interface GeneratedMiniAppPalette {
  primary: string;
  secondary: string;
  primaryRamp: ColorRamp;
  secondaryRamp: ColorRamp;
  light: MiniAppSemanticSlots;
  dark: MiniAppSemanticSlots;
}

const MIN_HUE_SEPARATION = 25;
const MIN_SERIES_CONTRAST = 1.5;

/** Two-series chart pairing needs to be tell-apart-able independent of
 * whichever raw hues the owner picked — if principal/secundario are too
 * close in hue AND contrast, this rotates a chart-only copy of secondary;
 * the real brand secondary (buttons/tags) is never touched. */
function chartSecondary(primaryHex: string, secondaryHex: string): string {
  const p = rgbToHsl(hexToRgb(primaryHex));
  const s = rgbToHsl(hexToRgb(secondaryHex));
  const hueDelta = Math.min(Math.abs(p.h - s.h), 360 - Math.abs(p.h - s.h));
  if (hueDelta >= MIN_HUE_SEPARATION && contrastRatio(primaryHex, secondaryHex) >= MIN_SERIES_CONTRAST) {
    return secondaryHex;
  }
  return rgbToHex(hslToRgb({ ...s, h: (s.h + 40) % 360 }));
}

function buildSlots(
  primaryHex: string,
  secondaryHex: string,
  primaryRamp: ColorRamp,
  secondaryRamp: ColorRamp,
  mode: "light" | "dark",
): MiniAppSemanticSlots {
  const isDark = mode === "dark";

  const backgroundPage = isDark
    ? withHsl(primaryRamp[900], (hsl) => ({ ...hsl, s: hsl.s * 0.5, l: 6 }))
    : primaryRamp[50];
  const backgroundSurface = isDark
    ? withHsl(primaryRamp[900], (hsl) => ({ ...hsl, s: hsl.s * 0.45, l: 9 }))
    : mix(primaryRamp[50], WHITE, 0.55);
  const backgroundSurfaceAlt = isDark
    ? withHsl(primaryRamp[900], (hsl) => ({ ...hsl, s: hsl.s * 0.4, l: 14 }))
    : primaryRamp[100];
  const border = isDark
    ? withHsl(primaryRamp[700], (hsl) => ({ ...hsl, l: 24 }))
    : withHsl(primaryRamp[200], (hsl) => ({ ...hsl, s: hsl.s * 0.8 }));
  const borderStrong = isDark ? withHsl(primaryRamp[700], (hsl) => ({ ...hsl, l: 32 })) : primaryRamp[300];

  const buttonPrimaryBg = primaryHex;
  const buttonPrimaryHover = withHsl(primaryHex, (hsl) => ({ ...hsl, l: clamp(hsl.l - 10, 8, 100) }));
  const buttonPrimaryText = contrastPick(buttonPrimaryBg);

  const buttonSecondaryBg = secondaryHex;
  const buttonSecondaryHover = withHsl(secondaryHex, (hsl) => ({ ...hsl, l: clamp(hsl.l - 10, 8, 100) }));
  const buttonSecondaryText = contrastPick(buttonSecondaryBg);

  const titleColor = contrastPick(backgroundPage);
  const textColorTinted = mix(titleColor, primaryRamp[900], 0.15);
  const textColor = contrastRatio(textColorTinted, backgroundPage) >= TEXT_CONTRAST ? textColorTinted : titleColor;
  const textMuted = ensureContrast(mix(textColor, backgroundSurface, 0.4), backgroundSurface, UI_CONTRAST);

  const iconColor = ensureContrast(primaryRamp[isDark ? 400 : 600], backgroundSurface, UI_CONTRAST);

  const tagBg = isDark ? withHsl(secondaryRamp[700], (hsl) => ({ ...hsl, l: 22 })) : secondaryRamp[100];
  const tagText = ensureContrast(contrastPick(tagBg), tagBg, UI_CONTRAST);

  const chartSeriesPrimary = primaryHex;
  const chartSeriesSecondary = chartSecondary(primaryHex, secondaryHex);

  // Checked against ramp[900] specifically (not buttonPrimaryBg/buttonText) —
  // gradientHero spans ramp[700]->ramp[900], always dark regardless of how
  // light the user's raw primary hex is, so its own text needs its own
  // contrast pick rather than reusing a button text color computed against
  // a much lighter background (that mismatch was a real bug: a light,
  // bright primary color made buttonPrimaryText resolve to near-black,
  // which then went nearly invisible on this always-dark gradient).
  const gradientHeroText = contrastPick(primaryRamp[900]);

  const shadowTint = hexToRgb(primaryRamp[900]);
  const shadowSm = `0 4px 16px rgba(${Math.round(shadowTint.r)}, ${Math.round(shadowTint.g)}, ${Math.round(shadowTint.b)}, 0.08)`;
  const shadowLg = `0 20px 48px rgba(${Math.round(shadowTint.r)}, ${Math.round(shadowTint.g)}, ${Math.round(shadowTint.b)}, 0.16)`;

  const gradientHero = `linear-gradient(160deg, ${primaryRamp[700]}, ${primaryRamp[900]})`;
  const gradientDecorative = `linear-gradient(120deg, ${primaryRamp[900]}, ${secondaryRamp[700]}, ${primaryRamp[900]})`;

  return {
    backgroundPage,
    backgroundSurface,
    backgroundSurfaceAlt,
    border,
    borderStrong,
    buttonPrimaryBg,
    buttonPrimaryHover,
    buttonPrimaryText,
    buttonSecondaryBg,
    buttonSecondaryHover,
    buttonSecondaryText,
    titleColor,
    textColor,
    textMuted,
    iconColor,
    tagBg,
    tagText,
    chartSeriesPrimary,
    chartSeriesSecondary,
    shadowSm,
    shadowLg,
    gradientHero,
    gradientHeroText,
    gradientDecorative,
  };
}

/** Generates the full light+dark design system for a mini app from just its
 * two brand colors. Pure and deterministic — safe to call both server-side
 * (once per request, page.tsx) and client-side (the config UI's live
 * preview). Falls back to the shipped defaults for anything unparseable. */
export function generateMiniAppPalette(primaryHexInput: string, secondaryHexInput: string): GeneratedMiniAppPalette {
  const primary = isValidHexColor(primaryHexInput) ? primaryHexInput : DEFAULT_PRIMARY_COLOR;
  const secondary = isValidHexColor(secondaryHexInput) ? secondaryHexInput : DEFAULT_SECONDARY_COLOR;
  const primaryRamp = generateRamp(primary);
  const secondaryRamp = generateRamp(secondary);

  return {
    primary,
    secondary,
    primaryRamp,
    secondaryRamp,
    light: buildSlots(primary, secondary, primaryRamp, secondaryRamp, "light"),
    dark: buildSlots(primary, secondary, primaryRamp, secondaryRamp, "dark"),
  };
}

/** CSS custom-property declarations for one mode's slot set, e.g. for
 * `:root { ${toCssDeclarations(palette.light)} }`. Keys become
 * `--ma-background-page` etc. (camelCase -> kebab-case, `--ma-` prefixed so
 * they never collide with the sitewide --color- and --surface- tokens). */
export function toCssDeclarations(slots: MiniAppSemanticSlots): string {
  return Object.entries(slots)
    .map(([key, value]) => {
      const kebab = key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
      return `--ma-${kebab}: ${value};`;
    })
    .join(" ");
}

export { toRgba as miniAppColorToRgba };
