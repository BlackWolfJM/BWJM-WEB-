import { describe, expect, it } from "vitest";
import { parseMathMD } from "../src/index.js";

function curve(type: "curve3d" | "parametric2d", key: string, limits: string) {
  const fence = "```";
  const coordinates = type === "curve3d" ? ["z: t / 3"] : [];
  return [fence + type, "x: cos(t)", "y: sin(t)", ...coordinates, key + ": " + limits, fence].join("\n");
}

describe.each(["curve3d", "parametric2d"] as const)("%s domain", type => {
  it("accepts symbolic multiples of pi and retains numeric endpoints in the AST", () => {
    for (const endpoint of ["2pi", "2 pi", "2 * pi", "2π"]) {
      const document = parseMathMD(curve(type, "tDomain", "[0, " + endpoint + "]"));
      expect(document.diagnostics).toEqual([]);
      expect(document.children[0]).toMatchObject({ type, tDomain: [0, 2 * Math.PI] });
    }
    expect(parseMathMD(curve(type, "t", "[-π/2, 6.28]")).children[0])
      .toMatchObject({ type, tDomain: [-Math.PI / 2, 6.28] });
  });

  it.each(["[2pi, pi]", "[0, n]", "[0, pi/0]", "[0, sqrt(2)]"])("rejects %s", limits => {
    const document = parseMathMD(curve(type, "tDomain", limits));
    expect(document.children).toHaveLength(0);
    expect(document.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ severity: "error" })]));
  });
});

it("uses the same limit syntax for a matching playback timeline", () => {
  const document = parseMathMD("```timeline\nname: t\ndomain: [-π/2, 2pi]\ndefault: π\n```");
  expect(document.diagnostics).toEqual([]);
  expect(document.children[0]).toMatchObject({
    type: "timeline", domain: [-Math.PI / 2, 2 * Math.PI], default: Math.PI,
  });
});
