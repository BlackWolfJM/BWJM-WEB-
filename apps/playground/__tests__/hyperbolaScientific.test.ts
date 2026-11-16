import { describe,expect,it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ConicNode } from "@mathmd/ast";
import { parseMathMD } from "@mathmd/parser";
import { circleLineTex } from "../src/circleConstructions.js";
import { ConicComposer } from "../src/ConicComposer.js";
import { HyperbolaComposer } from "../src/HyperbolaComposer.js";
import {
  hyperbolaAxisIntersections,hyperbolaCoefficients,hyperbolaFromCenter,
  hyperbolaFromFoci,hyperbolaFromGeneral,hyperbolaParametricPoint,
  hyperbolaParametricTex,hyperbolaTangentNormal,parseHyperbolaEquation,
  resolveHyperbola,serializeHyperbolaBlock,
  type HyperbolaCoefficients,type HyperbolaLine,type HyperbolaGeometry,
} from "../src/hyperbolaGeometry.js";
import { hyperbolaDragChange } from "../src/hyperbolaDrag.js";
import { hyperbolaMetrics } from "../src/hyperbolaReport.js";
import { updateGraphOption,updateHyperbolaInteraction } from "../src/graphOptionSource.js";

const close=(a:number,b:number)=>expect(a).toBeCloseTo(b,6);
const lineAt=(l:HyperbolaLine,x:number,y:number)=>l.a*x+l.b*y+l.c;
const equationAt=(g:HyperbolaGeometry,x:number,y:number)=>{
  const {A,B,C,D,E,F}=g.coefficients;
  return A*x*x+B*x*y+C*y*y+D*x+E*y+F;
};
const parse=(source:string):ConicNode=>{
  const doc=parseMathMD(source);
  expect(doc.diagnostics.filter(d=>d.severity==="error")).toEqual([]);
  expect(doc.children[0]?.type).toBe("conic");
  return doc.children[0] as ConicNode;
};

describe("Advanced hyperbola geometry",()=>{
  it("derives foci, eccentricity, directrices, axes and asymptotes",()=>{
    const g=hyperbolaFromCenter([0,0],3,2);
    close(g.c,Math.sqrt(13));
    close(g.eccentricity,Math.sqrt(13)/3);
    close(g.latusRectum,8/3);
    close(g.directrixOffset,9/Math.sqrt(13));
    expect(g.canonicalTex).toContain("\\frac{(x)^2}{9}");
    expect(g.canonicalTex).toContain("\\frac{(y)^2}{4}");
    expect(g.rectangle).toHaveLength(4);
    for(const [i,asymptote] of g.asymptotes.entries()){
      close(lineAt(asymptote,0,0),0);
      const corner=i===0?g.rectangle[0]:g.rectangle[3];
      close(lineAt(asymptote,...corner),0);
    }
    for(const directrix of g.directrices){
      const dist=Math.abs(directrix.c)/Math.hypot(directrix.a,directrix.b);
      close(dist,9/Math.sqrt(13));
    }
    for(const [i,endpoint] of g.latusEndpoints.entries()){
      close(Math.abs(endpoint[1]),4/3);
      close(endpoint[0],i<2?-Math.sqrt(13):Math.sqrt(13));
      close(equationAt(g,...endpoint),0);
    }
    const focal=Math.abs(Math.hypot(
      g.vertices[1][0]-g.focus1[0],g.vertices[1][1]-g.focus1[1])-
      Math.hypot(g.vertices[1][0]-g.focus2[0],g.vertices[1][1]-g.focus2[1]));
    close(focal,6);
  });
  it("supports vertical and arbitrary rotated axes",()=>{
    const vertical=hyperbolaFromCenter([1,-2],3,2,"y");
    close(vertical.vertices[0][0],1);
    close(vertical.vertices[0][1],-5);
    expect(vertical.canonicalTex).toContain("(y+2)");
    expect(vertical.canonicalTex).toContain("(x-1)");
    const rotated=hyperbolaFromCenter([2,-1],4,3,"x",Math.PI/6);
    expect(rotated.generalTex).toContain("xy");
    expect(rotated.transformTex).toContain("U=");
    for(const t of [-1,0,1]){
      for(const branch of [-1,1] as const)
        close(equationAt(rotated,...hyperbolaParametricPoint(rotated,t,branch)),0);
    }
  });
  it("accepts two foci with a valid distance difference only",()=>{
    const g=hyperbolaFromFoci([-5,0],[5,0],8);
    close(g.a,4);close(g.b,3);close(g.c,5);
    expect(g.focus1).toEqual([-5,0]);
    expect(g.focus2).toEqual([5,0]);
    expect(()=>hyperbolaFromFoci([-5,0],[5,0],10)).toThrow();
    expect(()=>hyperbolaFromFoci([-5,0],[5,0],0)).toThrow();
    expect(()=>hyperbolaFromFoci([-5,0],[5,0],12)).toThrow();
  });
  it("reads equations with Bxy, their negatives and rejects degeneracy",()=>{
    const simple=hyperbolaFromGeneral(parseHyperbolaEquation("9*x^2-16*y^2=144"));
    close(simple.a,4);close(simple.b,3);
    const rotated=hyperbolaFromCenter([1,-2],3,2,"x",Math.PI/5);
    const original=hyperbolaCoefficients(rotated.center,rotated.a,
      rotated.b,rotated.rotation);
    const reconstructed=hyperbolaFromGeneral(original);
    close(reconstructed.center[0],1);
    close(reconstructed.center[1],-2);
    close(reconstructed.a,3);close(reconstructed.b,2);
    const inverse=Object.fromEntries(Object.entries(original)
      .map(([key,value])=>[key,-value])) as unknown as HyperbolaCoefficients;
    const inverted=hyperbolaFromGeneral(inverse);
    close(inverted.a,3);close(inverted.b,2);
    expect(()=>parseHyperbolaEquation("x^2+y^2=1")).toThrow();
    expect(()=>parseHyperbolaEquation("x^2-y^2=0")).toThrow();
    expect(()=>parseHyperbolaEquation("y^2=4*x")).toThrow();
    expect(()=>parseHyperbolaEquation("x^3-y^2=1")).toThrow();
  });
  it("computes axis crossings and perpendicular tangent/normal",()=>{
    const g=hyperbolaFromCenter([0,0],4,3);
    expect(hyperbolaAxisIntersections(g).x).toEqual([[-4,0],[4,0]]);
    expect(hyperbolaAxisIntersections(g).y).toEqual([]);
    const right=hyperbolaTangentNormal(g,0,1);
    expect(circleLineTex(right.tangent)).toBe("x-4=0");
    expect(circleLineTex(right.normal)).toBe("y=0");
    const left=hyperbolaTangentNormal(g,0,-1);
    close(left.point[0],-4);
    for(const t of [-1,0,.25,1]){
      const selected=hyperbolaTangentNormal(g,t,1);
      close(lineAt(selected.tangent,...selected.point),0);
      close(lineAt(selected.normal,...selected.point),0);
      close(selected.tangent.a*selected.normal.a+
        selected.tangent.b*selected.normal.b,0);
    }
    expect(hyperbolaParametricTex(g)).toContain("\\cosh t");
    expect(hyperbolaParametricTex(g)).toContain("\\sinh t");
    const reverse=hyperbolaFromCenter([0,0],4,3,"x",Math.PI);
    expect(hyperbolaParametricTex(reverse)).toContain("\\mp ");
  });
  it("shows scientific measures and equations in one readout",()=>{
    const g=hyperbolaFromCenter([0,0],3,2);
    const rows=hyperbolaMetrics({type:"conic",conicType:"hyperbola",
      showTangent:true,showNormal:true,showParametric:true,hyperbolaBranch:-1} as ConicNode,g);
    for(const name of ["Centro","Distancia focal c","Relación focal","Excentricidad e",
      "Asintota 1","Asintota 2","Directriz 1","Directriz 2",
      "Lado recto","Tangente · ecuación","Normal · ecuación","Parametrización"])
      expect(rows.some(row=>row.label===name)).toBe(true);
    expect(rows.find(row=>row.label==="Distancia focal c")?.value).toBe("\\sqrt{13}");
    expect(rows.find(row=>row.label==="Excentricidad e")?.value)
      .toBe("\\frac{\\sqrt{13}}{3}");
  });
});
describe("Hyperbola .bwjm and interactions",()=>{
  const opts={showCenter:true,showAsymptotes:true,showRectangle:true,
    showDirectrices:true,showLatusRectum:true,showNormal:true,
    showParametric:true,showInteractiveControls:true,
    hyperbolaBranch:-1,tangentParameter:1};
  it("serializes all three modes and does not change the conic node family",()=>{
    const geo=hyperbolaFromCenter([0,0],4,3);
    const canonical=parse(serializeHyperbolaBlock("canonical",geo,opts));
    expect(canonical).toMatchObject({mode:"canonical",conicType:"hyperbola",
      showRectangle:true,hyperbolaBranch:-1,showNormal:true});
    const foci=parse(serializeHyperbolaBlock("foci",geo,opts,{
      focus1:[-5,0],focus2:[5,0],diffDistances:8,
    }));
    close(resolveHyperbola(foci).a,4);
    const general=parse(serializeHyperbolaBlock("general",geo,opts,{
      coefficients:geo.coefficients,
    }));
    close(resolveHyperbola(general).b,3);
    const modified=updateGraphOption(serializeHyperbolaBlock("canonical",geo,opts),
      canonical.range,"conic","showRectangle",false);
    expect(parse(modified).showRectangle).toBe(false);
  });
  it("persists canonical translations, semiaxes and rotation",()=>{
    const g=hyperbolaFromCenter([0,0],4,3);
    const src=serializeHyperbolaBlock("canonical",g,opts);
    const node=parse(src);
    const updated=updateHyperbolaInteraction(src,node.range,node,g,{
      center:[2,-1],a:5,b:2,rotation:Math.PI/6,tangentParameter:.5,
    });
    expect(updated).not.toBe(src);
    const parsed=parse(updated),geo=resolveHyperbola(parsed);
    expect(parsed.mode).toBe("canonical");
    close(geo.center[0],2);close(geo.center[1],-1);
    close(geo.a,5);close(geo.b,2);
    close(geo.rotation,Math.PI/6);
    close(parsed.tangentParameter!,.5);
    expect(parsed.viewCenter).toEqual([0,0]);
  });
  it("persists focal definition when moving or resizing its axes",()=>{
    const g=hyperbolaFromFoci([-5,0],[5,0],8);
    const src=serializeHyperbolaBlock("foci",g,opts,{
      focus1:[-5,0],focus2:[5,0],diffDistances:8,
    });
    const node=parse(src);
    const moved=updateHyperbolaInteraction(src,node.range,node,g,{center:[2,1],a:3,b:4});
    const after=parse(moved),geo=resolveHyperbola(after);
    expect(after.mode).toBe("foci");
    close(geo.center[0],2);close(geo.center[1],1);
    close(geo.a,3);close(geo.b,4);
    close(geo.c,5);
    close(after.diffDistances!,6);
  });
  it("persists rotated and rectangular general hyperbolas without changing mode",()=>{
    for(const rotation of [0,Math.PI/4]){
      const g=hyperbolaFromCenter([1,2],3,3,"x",rotation);
      const src=serializeHyperbolaBlock("general",g,opts,{coefficients:g.coefficients});
      const node=parse(src);
      const moved=updateHyperbolaInteraction(src,node.range,node,g,{
        center:[-2,4],a:5,b:2,
      });
      expect(moved).not.toEqual(src);
      const found=resolveHyperbola(parse(moved));
      close(found.center[0],-2);close(found.center[1],4);
      close(found.a,5);close(found.b,2);
    }
  });
  it("drags center, vertices, covertices, foci and tangency parameter",()=>{
    const g=hyperbolaFromCenter([0,0],3,2);
    expect(hyperbolaDragChange("center",g,[2,1],[0,0])).toEqual({center:[2,1]});
    expect(hyperbolaDragChange("vertex2",g,[4,0])).toEqual({a:4});
    expect(hyperbolaDragChange("coVertex2",g,[0,3])).toEqual({b:3});
    close(hyperbolaDragChange("focus2",g,[5,0])?.b??NaN,4);
    close(hyperbolaDragChange("tangentParameter",g,[4,2])?.tangentParameter??NaN,
      Math.asinh(1));
    expect(hyperbolaDragChange("focus2",g,[2,0])).toBeNull();
  });
  it("exposes all four cónicas in one menu and the new hyperbola composer",()=>{
    const menu=renderToStaticMarkup(React.createElement(ConicComposer,{
      onInsert:()=>{},onClose:()=>{},
    }));
    for(const name of ["Circunferencia","Elipse","Parábola","Hipérbola"])
      expect(menu).toContain(name);
    const form=renderToStaticMarkup(React.createElement(HyperbolaComposer,{
      onInsert:()=>{},onClose:()=>{},
    }));
    expect(form).toContain("Dos focos y diferencia de distancias");
    expect(form).toContain("Ecuación general con término Bxy");
    expect(form).toContain("Rectángulo auxiliar");
    expect(form).toContain("Vista previa de la hipérbola");
    expect(form).toContain("Insertar hipérbola");
  });
  it("keeps previously saved canonical hyperbolas readable",()=>{
    const fence=String.fromCharCode(96).repeat(3);
    const old=[fence+"conic","conicType: hyperbola","mode: canonical",
      "center: [1,2]","semiMajorAxis: 3","semiMinorAxis: 2",
      "axis: y","rotation: 0","showAsymptotes: true",fence].join("\n");
    const geo=resolveHyperbola(parse(old));
    close(geo.center[0],1);close(geo.center[1],2);
    close(geo.vertices[1][0],1);close(geo.vertices[1][1],5);
  });
});
