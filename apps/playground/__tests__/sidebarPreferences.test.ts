import { describe, expect, it } from "vitest";
import { normalizeSidebarMode, normalizeSidebarTab } from "../src/sidebarPreferences.js";

describe("document sidebar preferences", () => {
  it("accepts the three persisted visibility states", () => {
    expect(normalizeSidebarMode("expanded")).toBe("expanded");
    expect(normalizeSidebarMode("collapsed")).toBe("collapsed");
    expect(normalizeSidebarMode("hidden")).toBe("hidden");
  });
  it("safely upgrades old or invalid persisted data", () => {
    expect(normalizeSidebarMode("lessons")).toBe("expanded");
    expect(normalizeSidebarMode("broken")).toBe("expanded");
    expect(normalizeSidebarMode(null)).toBe("expanded");
    expect(normalizeSidebarTab("outline")).toBe("outline");
    expect(normalizeSidebarTab("variables")).toBe("variables");
    expect(normalizeSidebarTab("inspector")).toBe("inspector");
    expect(normalizeSidebarTab("lessons")).toBe("outline");
    expect(normalizeSidebarTab(null)).toBe("outline");
  });
});
