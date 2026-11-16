import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseMathMD } from "@mathmd/parser";
import { ConicComposer } from "../src/ConicComposer.js";
import { EllipseComposer } from "../src/EllipseComposer.js";
import { ellipseFromCenter, ellipseFromFoci, resolveEllipse,
  serializeEllipseBlock } from "../src/ellipseGeometry.js";
import { ellipseMetrics } from "../src/ellipseReport.js";
import { updateGraphOption } from "../src/graphOptionSource.js";

describe("Ellipses for scientific notes",()=>{
  it("derives canonical shape, foci, directrices and major axes",()=>{
    const g=ellipseFromCenter([0,0],5,4);
    expect(g.c).toBeCloseTo(3);
    expect(g.eccentricity).toBeCloseTo(.6);
    expect(g.focus1).toEqual([-3,0]);
    expect(g.focus2).toEqual([3,0]);
    expect(g.latusRectum).toBeCloseTo(6.4);
    expect(g.directrixOffset).toBeCloseTo(25/3);
    expect(g.canonicalTex).toContain("25");
    expect(g.generalTex).toContain("x^2");
    expect(ellipseMetrics({conicType:"ellipse",type:"conic",range:{} as any,id:"e"} as any,g)
      .find(m=>m.label==="Área interior")?.value).toBe("20\\pi");
  });
  it("supports vertical axes and rotated general equations",()=>{
    const vertical=ellipseFromCenter([1,2],5,4,"y");
    expect(vertical.vertices[0][0]).toBeCloseTo(1);
    expect(vertical.vertices[0][1]).toBeCloseTo(-3);
    expect(vertical.canonicalTex).toContain("(y-2)");
    const rotated=ellipseFromCenter([0,0],5,4,"x",Math.PI/4);
    expect(rotated.generalTex).toContain("xy");
    expect(rotated.transformTex).toBeDefined();
  });
  it("derives a valid ellipse from two foci and a distance sum",()=>{
    const geom=ellipseFromFoci([-3,0],[3,0],10);
    expect(geom.a).toBeCloseTo(5);
    expect(geom.b).toBeCloseTo(4);
    expect(()=>ellipseFromFoci([-3,0],[3,0],6)).toThrow();
  });
  it("retains the circular special case without imaginary directrices",()=>{
    const g=ellipseFromCenter([0,0],3,3);
    expect(g.c).toBe(0);
    expect(g.directrixOffset).toBeUndefined();
  });
  it("serializes ellipse options in a .bwjm conic block",()=>{
    const geom=ellipseFromCenter([1,2],5,4);
    const src=serializeEllipseBlock("canonical",geom,{
      showCenter:true,showFocus:true,showVertices:true,showAxes:true,
      showCoVertices:true,showDirectrices:true,showLatusRectum:true,
      showTangent:true,tangentAngle:60,showEquation:true,color:"#123456",
    });
    const doc=parseMathMD(src);
    expect(doc.diagnostics.filter(d=>d.severity==="error")).toEqual([]);
    expect(doc.children[0]).toMatchObject({type:"conic",conicType:"ellipse",
      showDirectrices:true,showLatusRectum:true,showCoVertices:true});
    const ellipse=doc.children[0];
    expect(ellipse?.type).toBe("conic");
    if(ellipse?.type!=="conic")return;
    expect(resolveEllipse(ellipse).center).toEqual([1,2]);
    const changed=updateGraphOption(src,ellipse.range,"conic","showLatusRectum",false);
    expect(parseMathMD(changed).children[0]).toMatchObject({showLatusRectum:false});
  });
  it("keeps focal parameters instead of saving unrelated defaults",()=>{
    const geom=ellipseFromFoci([-3,0],[3,0],10);
    const source=serializeEllipseBlock("foci",geom,{showFocus:true},{
      focus1:[-3,0],focus2:[3,0],sumDistances:10});
    const doc=parseMathMD(source);
    expect(doc.diagnostics.filter(d=>d.severity==="error")).toEqual([]);
    const node=doc.children[0];
    expect(node).toMatchObject({type:"conic",mode:"foci",
      focus1:[-3,0],focus2:[3,0],sumDistances:10});
    if(node?.type==="conic")expect(resolveEllipse(node).b).toBeCloseTo(4);
  });
  it("keeps one conic selector with ellipse editor and remaining conics",()=>{
    const parent=renderToStaticMarkup(React.createElement(ConicComposer,{
      onInsert:()=>{},onClose:()=>{},
    }));
    for(const label of ["Circunferencia","Elipse","Parábola","Hipérbola"])
      expect(parent).toContain(label);
    const ellipse=renderToStaticMarkup(React.createElement(EllipseComposer,{
      onInsert:()=>{},onClose:()=>{},
    }));
    expect(ellipse).toContain("Dos focos y suma de distancias");
    expect(ellipse).toContain("Lados rectos");
    expect(ellipse).toContain("Co-vértices");
    expect(ellipse).toContain("Vista previa de la elipse");
  });
});
