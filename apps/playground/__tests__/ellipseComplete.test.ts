import { describe, expect, it } from "vitest";
import type { ConicNode } from "@mathmd/ast";
import { parseMathMD } from "@mathmd/parser";
import { ellipseFromCenter, ellipseFromFoci, resolveEllipse, serializeEllipseBlock } from "../src/ellipseGeometry.js";
import { coefficientsFromEllipse, ellipseAxisCrossings, ellipseFromGeneral,
  ellipseParametricPoint, ellipseParametricTex, ellipseTangentNormal,
  parseEllipseEquation } from "../src/ellipseEquation.js";
import { ellipseMetrics } from "../src/ellipseReport.js";
import { ellipseDragChange } from "../src/ellipseDrag.js";
import { updateEllipseInteraction } from "../src/graphOptionSource.js";

const close=(a:number,b:number)=>expect(a).toBeCloseTo(b,6);
const parseNode=(source:string):ConicNode=>{
  const parsed=parseMathMD(source);
  expect(parsed.diagnostics.filter(item=>item.severity==="error")).toEqual([]);
  const node=parsed.children[0];
  expect(node?.type).toBe("conic");
  return node as ConicNode;
};
const coefficients=(a:number,b:number,angle=0)=>
  coefficientsFromEllipse([0,0],a,b,angle);

describe("Extended ellipse definitions",()=>{
  it("parses canonical and rotated general equations and rejects unrelated curves",()=>{
    const canonical=parseEllipseEquation("x^2/25+y^2/16=1");
    const decoded=ellipseFromGeneral(canonical);
    close(decoded.a,5);close(decoded.b,4);
    const rotated=ellipseFromGeneral(parseEllipseEquation(
      "41*x^2-18*x*y+41*y^2-800=0"));
    close(rotated.a,5);close(rotated.b,4);
    close(rotated.rotation,Math.PI/4);
    expect(()=>parseEllipseEquation("x^2-y^2=1")).toThrow();
    expect(()=>parseEllipseEquation("y=x^2")).toThrow();
    expect(()=>parseEllipseEquation("x^2+y^2+3=0")).toThrow();
    expect(()=>parseEllipseEquation("x^4+y^2=1")).toThrow();
  });
  it("supports a negative multiplier and translated ellipses",()=>{
    const base=ellipseFromCenter([2,-1],5,3,"x",Math.PI/6);
    const raw=coefficientsFromEllipse(base.center,base.a,base.b,base.rotation);
    const negative=Object.fromEntries(
      Object.entries(raw).map(([key,val])=>[key,-val]),
    ) as unknown as typeof raw;
    const answer=ellipseFromGeneral(negative);
    close(answer.center[0],2);close(answer.center[1],-1);
    close(answer.a,5);close(answer.b,3);
  });
  it("persists original general coefficients and regenerates a valid ellipse",()=>{
    const source=serializeEllipseBlock("general",
      ellipseFromCenter([0,0],5,4,"x",Math.PI/4),
      {showIntersections:true,showNormal:true,showParametric:true},
      undefined,{A:41,B:-18,C:41,D:0,E:0,F:-800});
    const node=parseNode(source);
    expect(node).toMatchObject({conicType:"ellipse",mode:"general",
      A:41,B:-18,C:41,F:-800,showNormal:true});
    const geom=resolveEllipse(node);
    close(geom.a,5);close(geom.b,4);
    close(geom.rotation,Math.PI/4);
    const changed=updateEllipseInteraction(source,node.range,node,geom,{
      center:[1,2],a:6,b:3,
    });
    expect(changed).not.toBe(source);
    const result=resolveEllipse(parseNode(changed));
    close(result.center[0],1);close(result.center[1],2);
    close(result.a,6);close(result.b,3);
  });
  it("keeps foci-source semantics while modifying the semi-major axis",()=>{
    const geom=ellipseFromFoci([-3,0],[3,0],10);
    const source=serializeEllipseBlock("foci",geom,{showInteractiveControls:true},{
      focus1:[-3,0],focus2:[3,0],sumDistances:10,
    });
    const node=parseNode(source);
    const moved=updateEllipseInteraction(source,node.range,node,geom,{center:[1,2],a:6});
    const parsed=parseNode(moved);
    expect(parsed.mode).toBe("foci");
    close(parsed.sumDistances!,12);
    const next=resolveEllipse(parsed);
    close(next.center[0],1);close(next.center[1],2);
    close(next.a,6);close(next.c,Math.sqrt(36-16));
  });
});

describe("Ellipse lines, crossings and parametrization",()=>{
  const geom=ellipseFromCenter([0,0],5,4);
  it("finds exact axis crossings and returns none for displaced axes",()=>{
    const result=ellipseAxisCrossings(coefficients(5,4));
    expect(result.x).toEqual([[-5,0],[5,0]]);
    expect(result.y).toEqual([[0,-4],[0,4]]);
    const translated=ellipseFromCenter([20,0],5,4);
    const cuts=ellipseAxisCrossings(coefficientsFromEllipse(translated.center,5,4,0));
    expect(cuts.y).toHaveLength(0);
    expect(cuts.x).toHaveLength(2);
  });
  it("computes perpendicular tangent and normal through the selected point",()=>{
    const t=ellipseTangentNormal(geom,0);
    close(t.point[0],5);close(t.point[1],0);
    const evaluate=(v:{a:number;b:number;c:number})=>
      v.a*t.point[0]+v.b*t.point[1]+v.c;
    close(evaluate(t.tangent),0);close(evaluate(t.normal),0);
    close(t.tangent.a*t.normal.a+t.tangent.b*t.normal.b,0);
    const rotated=ellipseTangentNormal(ellipseFromCenter([2,1],5,4,"x",Math.PI/3),Math.PI/4);
    close(rotated.tangent.a*rotated.normal.a+rotated.tangent.b*rotated.normal.b,0);
  });
  it("parametrizes a rotated ellipse and reports the mathematical equations",()=>{
    const angle=Math.PI/5,rot=ellipseFromCenter([1,-2],5,4,"x",angle);
    const point=ellipseParametricPoint(rot,Math.PI/4);
    const quadratic=coefficientsFromEllipse(rot.center,rot.a,rot.b,rot.rotation);
    const value=quadratic.A*point[0]**2+quadratic.B*point[0]*point[1]+
      quadratic.C*point[1]**2+quadratic.D*point[0]+
      quadratic.E*point[1]+quadratic.F;
    close(value,0);
    expect(ellipseParametricTex(rot)).toContain("\\cos t");
    expect(ellipseParametricTex(rot)).toContain("\\sin t");
    const entries=ellipseMetrics({type:"conic",conicType:"ellipse",showParametric:true,
      showNormal:true,tangentAngle:45} as ConicNode,rot);
    expect(entries.map(item=>item.label)).toContain("Normal · ecuación");
    expect(entries.map(item=>item.label)).toContain("Cortes con eje X");
  });
});

describe("Direct manipulation",()=>{
  const geom=ellipseFromCenter([0,0],5,4);
  it("moves center, major/minor vertices, focus and selected tangent",()=>{
    expect(ellipseDragChange("center",geom,[2,3],[0,0])).toEqual({center:[2,3]});
    expect(ellipseDragChange("vertex2",geom,[6,0])).toEqual({a:6});
    expect(ellipseDragChange("coVertex2",geom,[0,3])).toEqual({b:3});
    const focus=ellipseDragChange("focus2",geom,[2,0]);
    expect(focus?.b).toBeCloseTo(Math.sqrt(21));
    expect(ellipseDragChange("vertex2",geom,[3,0])).toBeNull();
    const tangent=ellipseDragChange("tangentAngle",geom,[0,4]);
    close(tangent!.tangentAngle!,90);
  });
  it("keeps canonical .bwjm mode and saves tangent angle",()=>{
    const source=serializeEllipseBlock("canonical",ellipseFromCenter([0,0],5,4),
      {showTangent:true,showInteractiveControls:true});
    const node=parseNode(source);
    const modified=updateEllipseInteraction(source,node.range,node,resolveEllipse(node),{
      center:[1,-2],b:3,tangentAngle:90,
    });
    const parsed=parseNode(modified);
    expect(parsed).toMatchObject({mode:"canonical",center:[1,-2],
      semiMinorAxis:3,tangentAngle:90});
    expect(parsed.viewCenter).toEqual([0,0]);
    expect(parsed.viewSpan).toBeGreaterThan(0);
  });
});
