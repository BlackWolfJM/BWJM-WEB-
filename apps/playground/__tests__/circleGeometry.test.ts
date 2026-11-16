import { describe, expect, it } from "vitest";
import { parseMathMD } from "@mathmd/parser";
import { circleFromCenterRadius, circleFromCoefficients, circleFromThreePoints,
  parseCircleEquation, resolveCircle, serializeCircleBlock } from "../src/circleGeometry.js";
import { updateCircleDimensions, updateGraphOption } from "../src/graphOptionSource.js";

describe("scientific circle insertion",()=>{
  it("uses a valid center/radius circle with axis crossings",()=>{
    const g=circleFromCenterRadius([1,-2],3);
    expect(g.center).toEqual([1,-2]);
    expect(g.radius).toBe(3);
    expect(g.canonicalTex).toBe("(x-1)^2+(y+2)^2=9");
    expect(g.xIntersections).toHaveLength(2);
    expect(g.yIntersections).toHaveLength(2);
  });
  it("reads canonical and general equations with the same geometry",()=>{
    for(const expression of ["(x-1)^2+(y+2)^2=9","x^2+y^2-2x+4y-4=0",
      "2x^2+2y^2-4x+8y-8=0"]){
      const g=circleFromCoefficients(parseCircleEquation(expression));
      expect(g.center[0]).toBeCloseTo(1);
      expect(g.center[1]).toBeCloseTo(-2);
      expect(g.radius).toBeCloseTo(3);
    }
  });
  it("rejects noncircles, imaginary and degenerate radii",()=>{
    expect(()=>parseCircleEquation("x^2+2y^2=1")).toThrow();
    expect(()=>parseCircleEquation("x^2+y^2+1=0")).toThrow();
    expect(()=>parseCircleEquation("sin(x)+y=0")).toThrow();
    expect(()=>circleFromCenterRadius([0,0],0)).toThrow();
  });
  it("finds the unique circle through three points",()=>{
    const g=circleFromThreePoints([3,0],[0,3],[-3,0]);
    expect(g.center[0]).toBeCloseTo(0);
    expect(g.center[1]).toBeCloseTo(0);
    expect(g.radius).toBeCloseTo(3);
    expect(()=>circleFromThreePoints([0,0],[1,1],[2,2])).toThrow();
  });
  it("persists circle modes, toggles, angles and color",()=>{
    const g=circleFromCenterRadius([2,-3],5);
    const source=serializeCircleBlock("canonical",g,{
      showCenter:true,showRadius:true,showDiameter:true,showChord:true,showSecant:true,
      showTangent:true,showIntersections:true,showEquation:true,color:"#0284c7",
      tangentAngle:40,
    });
    const doc=parseMathMD(source);
    expect(doc.diagnostics.filter(d=>d.severity==="error")).toEqual([]);
    const node=doc.children[0];
    expect(node?.type).toBe("conic");
    if(node?.type!=="conic")return;
    expect(node.showTangent).toBe(true);
    expect(node.tangentAngle).toBe(40);
    expect(resolveCircle(node).radius).toBe(5);
    const updated=updateGraphOption(source,node.range,"conic","showDiameter",false);
    expect(parseMathMD(updated).children[0]).toMatchObject({type:"conic",showDiameter:false});
    const moved=updateCircleDimensions(updated,parseMathMD(updated).children[0].range,[1,1],4);
    expect(parseMathMD(moved).children[0]).toMatchObject({type:"conic",center:[1,1],radius:4});
    expect(resolveCircle(parseMathMD(moved).children[0] as typeof node).canonicalTex)
      .toBe("(x-1)^2+(y-1)^2=16");
  });
  it("serializes the source construction of general and three-point circles",()=>{
    const coeff=parseCircleEquation("x^2+y^2-4=0");
    const g={...circleFromCoefficients(coeff),coefficients:coeff};
    const general=parseMathMD(serializeCircleBlock("general",g,{}));
    const node=general.children[0];
    expect(general.diagnostics.filter(d=>d.severity==="error")).toEqual([]);
    expect(node?.type).toBe("conic");
    if(node?.type==="conic")expect(resolveCircle(node).radius).toBeCloseTo(2);
    const points=[[2,0],[0,2],[-2,0]] as Array<[number,number]>;
    const through=parseMathMD(serializeCircleBlock("three-points",
      circleFromThreePoints(points[0],points[1],points[2]),{},points));
    expect(through.diagnostics.filter(d=>d.severity==="error")).toEqual([]);
    expect(through.children[0]).toMatchObject({type:"conic",mode:"three-points"});
  });
});
