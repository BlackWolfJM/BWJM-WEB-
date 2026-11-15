import { describe, expect, it } from "vitest";
import { parseMathMD } from "@mathmd/parser";
import { MathMDCore } from "../src/index.js";

const fence = "```";
const demo = [
  fence + "slider", "name: a", "label: Cruce en x (a)", "min: 0.1", "max: 2",
  "step: 0.1", "default: 1", fence, "",
  fence + "slider", "name: n", "min: 2", "max: 50", "step: 1", "default: 10", fence, "",
  fence + "calculusviz", "mode: riemann", "f: a*x", "g: x^2",
  "domain: [0, 2]", "upperBound: a", "partitions: n", fence,
].join("\n");

describe("Riemann with document parameters", () => {
  it("refreshes the number of rectangles and the right endpoint independently", () => {
    const doc = parseMathMD(demo);
    expect(doc.diagnostics).toEqual([]);
    expect(doc.children[0]).toMatchObject({ type: "slider", label: "Cruce en x (a)" });
    const node = doc.children.find(child => child.type === "calculusviz")!;
    const core = new MathMDCore(doc);
    const data = () => core.getNodeData(node.id);
    expect(data().polygons).toHaveLength(10);
    expect(data().comparison.value).toBeCloseTo(1 / 6, 5);
    expect(core.setVariable("n", 20)).toContain(node.id);
    expect(data().polygons).toHaveLength(20);
    expect(core.setVariable("a", 1.5)).toContain(node.id);
    expect(data().polygons).toHaveLength(20);
    expect(data().polygons[19].points[1][0]).toBeCloseTo(1.5);
    expect(data().comparison.value).toBeCloseTo(1.5 ** 3 / 6, 5);
    expect(data().value).toBeCloseTo(1.5 ** 3 / 6 + 1.5 ** 3 / (12 * 20 ** 2), 5);
  });

  it("reports invalid limits and rejects unsupported partition counts", () => {
    const doc = parseMathMD(demo);
    const node = doc.children.find(child => child.type === "calculusviz")!;
    const core = new MathMDCore(doc);
    core.setVariable("a", 3);
    expect(core.getNodeData(node.id).error).toContain("límite superior");
    expect(parseMathMD(demo.replace("partitions: n", "partitions: 501")).diagnostics)
      .toEqual(expect.arrayContaining([expect.objectContaining({ severity: "error" })]));
  });
});
