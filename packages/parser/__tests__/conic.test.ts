import { describe, expect, it } from "vitest";
import { parseMathMD } from "../src/index.js";

const fence = String.fromCharCode(96).repeat(3);
function parseConic(lines: string[]) {
  return parseMathMD([fence+"conic",...lines,fence].join("\n"));
}
describe("Canonical conic documents", () => {
  it.each([
    ["circle",["mode: center-radius","center: [0,0]","radius: 3"]],
    ["ellipse",["mode: canonical","center: [1,2]","semiMajorAxis: 4","semiMinorAxis: 2"]],
    ["parabola",["mode: canonical","center: [0,0]","axis: y","focalParameter: -2"]],
    ["hyperbola",["mode: canonical","center: [0,0]","semiMajorAxis: 3","semiMinorAxis: 2"]],
  ])("parses %s as editable scientific block", (name,fields) => {
    const doc = parseConic(["conicType: "+name,...fields]);
    expect(doc.diagnostics.filter(d=>d.severity==="error")).toEqual([]);
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].type).toBe("conic");
  });
  it("rejects incompatible canonical parameters without crashing", () => {
    const doc = parseConic(["conicType: ellipse","mode: canonical","center: [0,0]","semiMajorAxis: 2","semiMinorAxis: 4"]);
    expect(doc.children).toHaveLength(0);
    expect(doc.diagnostics.some(d=>d.severity==="error")).toBe(true);
  });
  it("keeps unrelated plot blocks working", () => {
    const source=[fence+"plot2d","equation: x^2","x: [-2,2]",fence,"",fence+"conic","conicType: circle","mode: center-radius","center: [0,0]","radius: 2",fence].join("\n");
    const doc=parseMathMD(source);
    expect(doc.diagnostics.filter(d=>d.severity==="error")).toEqual([]);
    expect(doc.children.map(x=>x.type)).toEqual(["plot2d","conic"]);
  });
});
