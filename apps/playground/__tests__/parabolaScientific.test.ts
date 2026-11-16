import { describe, expect, it } from "vitest";
import type { ConicNode } from "@mathmd/ast";
import { parseMathMD } from "@mathmd/parser";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConicComposer } from "../src/ConicComposer.js";
import { ParabolaComposer } from "../src/ParabolaComposer.js";
import { coefficientsFromParabola, parabolaAxisIntersections,
  parabolaFromFocusDirectrix, parabolaFromGeneral, parabolaFromVertex,
  parabolaParametricPoint, parabolaParametricTex, parabolaTangentNormal,
  parseParabolaEquation, resolveParabola, serializeParabolaBlock,
} from "../src/parabolaGeometry.js";
import { parabolaDragChange } from "../src/parabolaDrag.js";
import { parabolaMetrics } from "../src/parabolaReport.js";
import { updateGraphOption, updateParabolaInteraction } from "../src/graphOptionSource.js";
import { circleLineTex } from "../src/circleConstructions.js";

const verify=(text:string):ConicNode=>{
  const result=parseMathMD(text);
  expect(result.diagnostics.filter(d=>d.severity==="error")).toEqual([]);
  const node=result.children[0];
  expect(node?.type).toBe("conic");
  return node as ConicNode;
};
const close=(a:number,b:number)=>expect(a).toBeCloseTo(b,6);
describe("Parabola geometry and definitions",()=>{
  it("constructs both horizontal and vertical canonical curves with signed p",()=>{
    const right=parabolaFromVertex([0,0],2);
    expect(right.focus).toEqual([2,0]);
    close(right.directrix.c,2);
    close(right.latusRectum,8);
    close(right.latusEndpoints[0][0],2);
    close(right.latusEndpoints[0][1],-4);
    expect(right.canonicalTex).toContain("8");
    const down=parabolaFromVertex([1,-2],-3,"y");
    close(down.focus[0],1);close(down.focus[1],-5);
    expect(down.canonicalTex).toContain("-12");
    expect(down.axis).toBe("y");
  });
  it("converts focus and directrix into the same vertex/axis geometry",()=>{
    const from=parabolaFromFocusDirectrix([1,0],{a:1,b:0,c:1});
    close(from.vertex[0],0);close(from.vertex[1],0);close(from.p,1);
    const below=parabolaFromFocusDirectrix([-1,0],{a:1,b:0,c:-1});
    close(below.vertex[0],0);close(below.p,-1);
    expect(()=>parabolaFromFocusDirectrix([1,0],{a:0,b:0,c:1})).toThrow();
    expect(()=>parabolaFromFocusDirectrix([1,0],{a:1,b:0,c:-1})).toThrow();
  });
  it("recognizes general parabolas including rotated Bxy terms",()=>{
    const horizontal=parabolaFromGeneral({A:0,B:0,C:1,D:-4,E:0,F:0});
    close(horizontal.p,1);close(horizontal.rotation,0);
    const vertical=parabolaFromGeneral({A:1,B:0,C:0,D:0,E:-4,F:0});
    close(vertical.p,1);close(vertical.rotation,Math.PI/2);
    const rotated=parseParabolaEquation("x^2+2*x*y+y^2-4*x+4*y=0");
    const geometry=parabolaFromGeneral(rotated);
    close(geometry.vertex[0],0);close(geometry.vertex[1],0);
    expect(Math.abs(geometry.rotation)).toBeGreaterThan(.1);
    expect(()=>parseParabolaEquation("x^2+y^2=1")).toThrow();
    expect(()=>parseParabolaEquation("x^2-y^2=1")).toThrow();
    expect(()=>parseParabolaEquation("y^2=1")).toThrow();
    expect(()=>parseParabolaEquation("y^3=x")).toThrow();
  });
  it("preserves rotated translated curves and negative input scaling",()=>{
    const initial=parabolaFromVertex([2,-3],-1.5,"x",Math.PI/6);
    const coeff=coefficientsFromParabola(initial.vertex,initial.p,initial.rotation);
    const alt=Object.fromEntries(Object.entries(coeff).map(([key,v])=>[key,-3*v]));
    const result=parabolaFromGeneral(alt as typeof coeff);
    close(result.vertex[0],2);close(result.vertex[1],-3);
    close(result.focus[0],initial.focus[0]);
    close(result.focus[1],initial.focus[1]);
  });
  it("computes tangent and normal that pass through the selected curve point",()=>{
    const g=parabolaFromVertex([0,0],1);
    const at=parabolaTangentNormal(g,0);
    expect(circleLineTex(at.tangent)).toBe("x=0");
    expect(circleLineTex(at.normal)).toBe("y=0");
    const t=1.5,line=parabolaTangentNormal(g,t);
    close(line.tangent.a*line.point[0]+line.tangent.b*line.point[1]+line.tangent.c,0);
    close(line.normal.a*line.point[0]+line.normal.b*line.point[1]+line.normal.c,0);
    close(line.tangent.a*line.normal.a+line.tangent.b*line.normal.b,0);
    expect(parabolaParametricTex(g)).toContain("t^2");
    expect(parabolaParametricTex(g)).toContain("\\mathbb{R}");
    close(parabolaParametricPoint(g,1)[0],1);
  });
  it("computes coordinate crossings, axis and latus details",()=>{
    const g=parabolaFromVertex([0,0],1);
    expect(parabolaAxisIntersections(g).x).toEqual([[0,0]]);
    expect(parabolaAxisIntersections(g).y).toEqual([[0,0]]);
    const shifted=parabolaFromVertex([3,0],1);
    expect(parabolaAxisIntersections(shifted).y).toEqual([]);
    const rows=parabolaMetrics({type:"conic",conicType:"parabola",showTangent:true,
      showNormal:true,showParametric:true} as ConicNode,g);
    for(const text of ["Foco","Vértice","Directriz · ecuación","Eje de simetría · ecuación",
      "Longitud del lado recto","Tangente · ecuación","Normal · ecuación","Parametrización"])
      expect(rows.some(row=>row.label===text)).toBe(true);
  });
});
describe("Parabola insertion and editing",()=>{
  const flags={showFocus:true,showDirectrix:true,showLatusRectum:true,
    showNormal:true,showParametric:true,showInteractiveControls:true,tangentParameter:1};
  it("serializes all three modes as valid document blocks",()=>{
    const canonical=parabolaFromVertex([1,2],-2,"y");
    const a=verify(serializeParabolaBlock("canonical",canonical,flags));
    expect(a).toMatchObject({mode:"canonical",conicType:"parabola",
      showNormal:true,showParametric:true});
    close(resolveParabola(a).focus[1],0);
    const f=parabolaFromFocusDirectrix([1,0],{a:1,b:0,c:1});
    const b=verify(serializeParabolaBlock("focus-directrix",f,flags,{
      focus:[1,0],directrix:{A:1,B:0,C:1},
    }));
    close(resolveParabola(b).p,1);
    const c=verify(serializeParabolaBlock("general",f,flags,{
      coefficients:{A:0,B:0,C:1,D:-4,E:0,F:0},
    }));
    close(resolveParabola(c).p,1);
  });
  it("persists dragging while preserving general coefficients and mode",()=>{
    const g=parabolaFromVertex([0,0],1);
    const src=serializeParabolaBlock("general",g,flags,{
      coefficients:{A:0,B:0,C:2,D:-8,E:0,F:0},
    });
    const node=verify(src);
    const edited=updateParabolaInteraction(src,node.range,node,resolveParabola(node),{
      vertex:[2,3],p:2,tangentParameter:2,
    });
    expect(edited).not.toEqual(src);
    const result=verify(edited);
    expect(result.mode).toBe("general");
    close(result.C!,2);
    close(resolveParabola(result).vertex[0],2);
    close(resolveParabola(result).vertex[1],3);
    close(resolveParabola(result).p,2);
    close(result.tangentParameter!,2);
  });
  it("persists focus and directrix when changing vertex/focal parameter",()=>{
    const g=parabolaFromFocusDirectrix([1,0],{a:1,b:0,c:1});
    const src=serializeParabolaBlock("focus-directrix",g,flags,{
      focus:[1,0],directrix:{A:1,B:0,C:1},
    });
    const node=verify(src);
    const edited=updateParabolaInteraction(src,node.range,node,g,{
      vertex:[2,1],p:3,
    });
    const updated=verify(edited);
    expect(updated.mode).toBe("focus-directrix");
    close(resolveParabola(updated).vertex[0],2);
    close(resolveParabola(updated).vertex[1],1);
    close(resolveParabola(updated).p,3);
  });
  it("moves focal geometry and the selected tangent with direct manipulation",()=>{
    const g=parabolaFromVertex([0,0],2);
    expect(parabolaDragChange("vertex",g,[2,3],[0,0])).toEqual({vertex:[2,3]});
    expect(parabolaDragChange("focus",g,[3,0])).toEqual({p:3});
    expect(parabolaDragChange("directrix",g,[-3,0])).toEqual({p:3});
    expect(parabolaDragChange("latus2",g,[2,6])).toEqual({p:3});
    close(parabolaDragChange("tangent",g,[2,4])?.tangentParameter??NaN,1);
  });
  it("provides the new assistant without creating a second ribbon action",()=>{
    const menu=renderToStaticMarkup(React.createElement(ConicComposer,{
      onInsert:()=>{},onClose:()=>{},
    }));
    for(const name of ["Circunferencia","Elipse","Parábola","Hipérbola"])
      expect(menu).toContain(name);
    const editor=renderToStaticMarkup(React.createElement(ParabolaComposer,{
      onInsert:()=>{},onClose:()=>{},
    }));
    expect(editor).toContain("Foco y recta directriz");
    expect(editor).toContain("Ecuación general");
    expect(editor).toContain("Lado recto");
    expect(editor).toContain("Vista previa de la parábola");
  });
  it("retains old canonical blocks and toggles their visible options",()=>{
    const fence=String.fromCharCode(96).repeat(3);
    const source=[fence+"conic","conicType: parabola","mode: canonical",
      "center: [0,0]","focalParameter: 1","axis: x",fence].join("\n");
    const node=verify(source);
    close(resolveParabola(node).p,1);
    const next=updateGraphOption(source,node.range,"conic","showLatusRectum",true);
    expect(verify(next).showLatusRectum).toBe(true);
  });
});
