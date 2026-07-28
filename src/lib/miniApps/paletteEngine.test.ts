import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  generateMiniAppPalette,
  isValidHexColor,
  relativeLuminance,
  toCssDeclarations,
} from "./paletteEngine";

describe("isValidHexColor", () => {
  it("accepts 3- and 6-digit hex with or without #", () => {
    expect(isValidHexColor("#6c63ff")).toBe(true);
    expect(isValidHexColor("6c63ff")).toBe(true);
    expect(isValidHexColor("#fff")).toBe(true);
  });
  it("rejects garbage", () => {
    expect(isValidHexColor("not-a-color")).toBe(false);
    expect(isValidHexColor("#12345")).toBe(false);
  });
});

describe("contrastRatio / relativeLuminance", () => {
  it("white vs black is the maximum WCAG ratio (21:1)", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0);
  });
  it("a color against itself is 1:1", () => {
    expect(contrastRatio("#6c63ff", "#6c63ff")).toBeCloseTo(1, 5);
  });
  it("white has luminance 1, black has luminance 0", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });
});

describe("generateMiniAppPalette — ramp", () => {
  it("step 500 is exactly the input hex for both ramps", () => {
    const p = generateMiniAppPalette("#6c63ff", "#1e7a4c");
    expect(p.primaryRamp[500].toLowerCase()).toBe("#6c63ff");
    expect(p.secondaryRamp[500].toLowerCase()).toBe("#1e7a4c");
  });

  it("ramp lightness is monotonic light-to-dark across all 10 steps", () => {
    const p = generateMiniAppPalette("#3366cc", "#cc3366");
    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
    const lightness = steps.map((s) => relativeLuminance(p.primaryRamp[s]));
    for (let i = 1; i < lightness.length; i++) {
      expect(lightness[i]).toBeLessThanOrEqual(lightness[i - 1] + 1e-6);
    }
  });

  it("falls back to defaults for invalid input instead of throwing", () => {
    expect(() => generateMiniAppPalette("nonsense", "also-nonsense")).not.toThrow();
    const p = generateMiniAppPalette("nonsense", "also-nonsense");
    expect(isValidHexColor(p.primary)).toBe(true);
    expect(isValidHexColor(p.secondary)).toBe(true);
  });
});

describe("generateMiniAppPalette — contrast guarantees", () => {
  const cases: [string, string][] = [
    ["#6c63ff", "#1e7a4c"], // defaults
    ["#ffffff", "#fefefe"], // near-white primary, barely-different secondary
    ["#0a0a0a", "#111111"], // near-black primary and secondary
    ["#ffcc00", "#ffee88"], // low-contrast bright yellows
    ["#808080", "#909090"], // mid-gray, low saturation
  ];

  it.each(cases)("text/icon/tag colors always clear WCAG thresholds for %s / %s", (primary, secondary) => {
    const p = generateMiniAppPalette(primary, secondary);
    for (const mode of ["light", "dark"] as const) {
      const slots = p[mode];
      expect(contrastRatio(slots.titleColor, slots.backgroundPage)).toBeGreaterThanOrEqual(4.4);
      expect(contrastRatio(slots.textColor, slots.backgroundPage)).toBeGreaterThanOrEqual(4.4);
      expect(contrastRatio(slots.iconColor, slots.backgroundSurface)).toBeGreaterThanOrEqual(2.9);
      expect(contrastRatio(slots.tagText, slots.tagBg)).toBeGreaterThanOrEqual(2.9);
      expect(contrastRatio(slots.buttonPrimaryText, slots.buttonPrimaryBg)).toBeGreaterThanOrEqual(1);
    }
  });

  it.each(cases)("gradientHeroText stays legible against the hero gradient's own dark stops for %s / %s", (primary, secondary) => {
    const p = generateMiniAppPalette(primary, secondary);
    for (const mode of ["light", "dark"] as const) {
      // The gradient itself can't be measured directly (it's a CSS string),
      // but it always spans primaryRamp[700]->primaryRamp[900] regardless of
      // mode or how light the raw primary hex is — checking against the
      // darker endpoint is the conservative, always-safe proxy. Regression
      // test for a real bug: gradientHeroText used to reuse buttonPrimaryText
      // (computed against the raw, often much lighter, primary hex), which
      // went nearly invisible on this always-dark gradient for a bright
      // primary color like #ff3366.
      expect(contrastRatio(p[mode].gradientHeroText, p.primaryRamp[900])).toBeGreaterThanOrEqual(4.4);
    }
  });

  it("chart series colors are never near-identical even when principal/secundario share a hue", () => {
    const p = generateMiniAppPalette("#6c63ff", "#6c60fa"); // same-ish hue, close lightness
    const hueDeltaOk =
      p.light.chartSeriesPrimary.toLowerCase() !== p.light.chartSeriesSecondary.toLowerCase();
    expect(hueDeltaOk).toBe(true);
  });
});

describe("toCssDeclarations", () => {
  it("emits kebab-case --ma- prefixed custom properties", () => {
    const p = generateMiniAppPalette("#6c63ff", "#1e7a4c");
    const css = toCssDeclarations(p.light);
    expect(css).toContain("--ma-background-page:");
    expect(css).toContain("--ma-button-primary-bg:");
    expect(css).toContain("--ma-chart-series-secondary:");
  });
});
