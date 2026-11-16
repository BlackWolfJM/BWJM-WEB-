import { describe, expect, it } from "vitest";
import { parseMathMD } from "@mathmd/parser";
import type { ConicNode } from "@mathmd/ast";
import { circleFromCenterRadius } from "../src/circleGeometry.js";
import { circleAuxiliaryLines, circleLineTex, tangentsFromPoint,
  } from "../src/circleConstructions.js";
import { exactAxisIntersections, exactRootTex } from "../src/circleExact.js";
import { getCircleReadout } from "../src/circleReadout.js";
import { circleDragChange } from "../src/circleDrag.js";
import { updateCircleInteraction } from "../src/graphOptionSource.js";

const geo=circleFromCenterRadius([0,0],3);
const evaluate=(line:{a:number;b:number;c:number},x:number,y:number)=>
  line.a*x+line.b*y+line.c;

describe("Circle geometric constructions",()=>{
  it("builds a single tangent from a point on the circumference",()=>{
    const tangents=tangentsFromPoint(geo,[3,0]);
    expect(tangents).toHaveLength(1);
    const [{line,touches}]=tangents;
    expect(touches[0]).toEqual([3,0]);
    expect(evaluate(line,3,0)).toBeCloseTo(0);
    expect(circleLineTex(line)).toBe("x-3=0");
  });
  it("builds two tangents from an exterior point, none from the interior",()=>{
    const lines=tangentsFromPoint(geo,[5,0]);
    expect(lines).toHaveLength(2);
    for(const {line,touches} of lines){
      const [x,y]=touches[0];
      expect(Math.hypot(x,y)).toBeCloseTo(3);
      expect(evaluate(line,x,y)).toBeCloseTo(0);
      expect(evaluate(line,5,0)).toBeCloseTo(0);
    }
    expect(tangentsFromPoint(geo,[1,0])).toHaveLength(0);
  });
  it("derives chord and secant equations from their two distinct points",()=>{
    const node={showChord:true,showSecant:true,
      chordStartAngle:0,chordEndAngle:180,
      secantStartAngle:90,secantEndAngle:270} as ConicNode;
    const lines=circleAuxiliaryLines(node,geo);
    expect(lines).toHaveLength(2);
    for(const construction of lines){
      for(const [x,y] of construction.touches)
        expect(evaluate(construction.line,x,y)).toBeCloseTo(0);
    }
    expect(circleLineTex(lines[0].line)).toBe("y=0");
    expect(circleLineTex(lines[1].line)).toBe("x=0");
  });
  it("shows exact radicals for intercepts and only marked approximation otherwise",()=>{
    const sqrtTwo=circleFromCenterRadius([0,0],Math.sqrt(2));
    expect(exactAxisIntersections(sqrtTwo).x).toContain("\\sqrt{2}");
    expect(exactAxisIntersections(sqrtTwo).y).toContain("\\sqrt{2}");
    expect(exactRootTex(8)).toBe("2\\sqrt{2}");
    const shifted=circleFromCenterRadius([1,0],Math.sqrt(2));
    expect(exactAxisIntersections(shifted).x).toContain("1+\\sqrt{2}");
    expect(exactAxisIntersections(shifted).x).toContain("1-\\sqrt{2}");
  });
  it("shows equations in the same scientific report for a tangent, chord and secant",()=>{
    const node={mode:"center-radius",showChord:true,showSecant:true,showTangent:true,
      tangentMode:"point",tangentPoint:[5,0],chordStartAngle:0,chordEndAngle:180,
      secantStartAngle:90,secantEndAngle:270} as ConicNode;
    const metrics=getCircleReadout(node,geo);
    const names=metrics.map(item=>item.label);
    expect(names).toContain("Cuerda · ecuación");
    expect(names).toContain("Secante · ecuación");
    expect(names).toContain("Tangente 1 · ecuación");
    expect(names).toContain("Tangente 2 · ecuación");
    expect(names).toContain("Punto P de tangencia");
    expect(names).not.toContain("Punto de tangencia: ángulo");
  });
});
describe("Circle editable document persistence",()=>{
  const fence=String.fromCharCode(96).repeat(3);
  const make=(fields:string[])=>[fence+"conic","conicType: circle",...fields,fence].join("\n");
  const update=(text:string,change:Parameters<typeof updateCircleInteraction>[4])=>{
    const parsed=parseMathMD(text);
    expect(parsed.diagnostics.filter(x=>x.severity==="error")).toEqual([]);
    const node=parsed.children[0] as ConicNode;
    const initial=node.mode==="three-points"?
      circleFromCenterRadius([0,0],3):geo;
    return updateCircleInteraction(text,node.range,node,initial,change);
  };
  it("maps pointer movement to center and on-circle angles",()=>{
    expect(circleDragChange("center",geo,[2,2],[0,0])).toEqual({center:[2,2]});
    expect(circleDragChange("radiusAngle",geo,[4,0])).toMatchObject({
      radius:4,angles:{radiusAngle:0},
    });
    expect(circleDragChange("chordEndAngle",geo,[0,5])?.angles?.chordEndAngle).toBeCloseTo(90);
  });
  it("persists center, radius, and tangency through original canonical mode",()=>{
    const source=make(["mode: canonical","center: [0,0]","radius: 3","showTangent: true",
      "tangentMode: point","tangentPoint: [5,0]"]);
    const updated=update(source,{center:[1,1],radius:4,angles:{radiusAngle:45},tangentPoint:[6,1]});
    const node=parseMathMD(updated).children[0] as ConicNode;
    expect(node).toMatchObject({mode:"canonical",center:[1,1],radius:4,radiusAngle:45,
      tangentPoint:[6,1],viewCenter:[0,0]});
    expect(updated).toContain("viewSpan:");
  });
  it("preserves coefficient mode and two defining differences for a moved general circle",()=>{
    const source=make(["mode: general","A: 2","B: 0","C: 2","D: 0","E: 0","F: -18"]);
    const node=parseMathMD(update(source,{center:[1,2],radius:4})).children[0] as ConicNode;
    expect(node.mode).toBe("general");
    expect(node.A).toBe(2);
    expect(node.D).toBe(-4);
    expect(node.E).toBe(-8);
    expect(node.F).toBe(-22);
  });
  it("keeps three noncollinear source points when translating and resizing",()=>{
    const source=make(["mode: three-points","pointA: [3,0]","pointB: [0,3]","pointC: [-3,0]"]);
    const node=parseMathMD(update(source,{center:[1,1],radius:4})).children[0] as ConicNode;
    expect(node.mode).toBe("three-points");
    expect(node.pointA?.[0]).toBeCloseTo(5);
    expect(node.pointB?.[1]).toBeCloseTo(5);
    expect(node.pointC?.[0]).toBeCloseTo(-3);
  });
});
