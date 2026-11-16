import type { ConicNode } from "@mathmd/ast";
import { renderToString } from "katex";
import { resolveEllipse, type EllipseGeometry } from "./ellipseGeometry.js";
import { circleNumber, degreesToPiRadians } from "./circleReadout.js";

export interface EllipseMetric { label: string; value: string; math?: boolean }
const coord=(point:readonly [number,number])=>
  "\\left("+circleNumber(point[0])+",\\;"+circleNumber(point[1])+"\\right)";
export function ellipseMetrics(node:ConicNode,geom:EllipseGeometry=resolveEllipse(node)):EllipseMetric[]{
  return [
    {label:"Centro",value:coord(geom.center),math:true},
    {label:"Semieje mayor a",value:circleNumber(geom.a),math:true},
    {label:"Semieje menor b",value:circleNumber(geom.b),math:true},
    {label:"Distancia focal c",value:circleNumber(geom.c),math:true},
    {label:"Excentricidad e",value:circleNumber(geom.eccentricity),math:true},
    {label:"Relación",value:"c^2=a^2-b^2",math:true},
    {label:"Foco F₁",value:coord(geom.focus1),math:true},
    {label:"Foco F₂",value:coord(geom.focus2),math:true},
    {label:"Vértices",value:coord(geom.vertices[0])+",\\;"+coord(geom.vertices[1]),math:true},
    {label:"Co-vértices",value:coord(geom.coVertices[0])+",\\;"+coord(geom.coVertices[1]),math:true},
    {label:"Eje mayor",value:circleNumber(2*geom.a),math:true},
    {label:"Eje menor",value:circleNumber(2*geom.b),math:true},
    {label:"Área interior",value:circleNumber(geom.a*geom.b)+"\\pi",math:true},
    {label:"Lado recto",value:circleNumber(geom.latusRectum),math:true},
    {label:"Directrices",value:geom.directrixOffset===undefined?
      "No definidas para e=0":"X=\\pm "+circleNumber(geom.directrixOffset),math:geom.directrixOffset!==undefined},
    {label:"Orientación",value:degreesToPiRadians(geom.rotation*180/Math.PI),math:true},
  ];
}

const appendMath=(where:HTMLElement,tex:string)=>{
  const math=document.createElement("span");
  math.className="bwjm-circle-math";
  math.innerHTML=renderToString(tex,{displayMode:false,throwOnError:false,
    trust:false,maxExpand:1000,maxSize:20,output:"htmlAndMathml"});
  where.appendChild(math);
};
const addMetric=(parent:HTMLElement,item:EllipseMetric)=>{
  const row=document.createElement("div");
  const dt=document.createElement("dt");dt.textContent=item.label;
  const dd=document.createElement("dd");
  if(item.math)appendMath(dd,item.value);else dd.textContent=item.value;
  row.append(dt,dd);parent.appendChild(row);
};
const group=(name:string,metrics:EllipseMetric[],extra="")=>{
  const section=document.createElement("div");
  section.className="bwjm-circle-section "+extra;
  const heading=document.createElement("h4");heading.textContent=name;
  const list=document.createElement("dl");list.className="bwjm-circle-detail-list";
  for(const metric of metrics)addMetric(list,metric);
  section.append(heading,list);
  return section;
};
/** Mirrors the compact scientific panel for circles, with ellipse-specific geometry. */
export function buildEllipseReport(node:ConicNode,geom:EllipseGeometry=resolveEllipse(node)):HTMLElement {
  const panel=document.createElement("section");
  panel.className="bwjm-curve-readout bwjm-circle-report bwjm-ellipse-report";
  panel.setAttribute("aria-label","Propiedades de la elipse");
  const heading=document.createElement("div");heading.className="bwjm-circle-report-header";
  const title=document.createElement("h3");title.textContent="Propiedades de la elipse";
  const definition=document.createElement("span");definition.className="bwjm-circle-mode";
  definition.textContent=node.mode==="foci"?"Dos focos y suma de distancias":"Centro y semiejes";
  heading.append(title,definition);panel.appendChild(heading);
  if(node.showEquation!==false){
    const block=document.createElement("div");block.className="bwjm-circle-main-equation";
    const caption=document.createElement("span");caption.className="bwjm-circle-eyebrow";
    caption.textContent="ECUACIÓN CANÓNICA";
    const equation=document.createElement("div");equation.className="bwjm-circle-main-equation-math";
    appendMath(equation,geom.canonicalTex);
    block.append(caption,equation);panel.appendChild(block);
    if(geom.transformTex){
      const transformed=document.createElement("div");
      transformed.className="bwjm-ellipse-transform";
      const label=document.createElement("span");label.textContent="Coordenadas rotadas";
      const tex=document.createElement("div");appendMath(tex,geom.transformTex);
      transformed.append(label,tex);panel.appendChild(transformed);
    }
  }
  const metrics=ellipseMetrics(node,geom);
  const by=(...keys:string[])=>keys.flatMap(key=>metrics.filter(metric=>metric.label===key));
  const highlights=document.createElement("dl");highlights.className="bwjm-circle-highlights";
  for(const entry of by("Centro","Semieje mayor a","Semieje menor b"))addMetric(highlights,entry);
  panel.appendChild(highlights);
  const details=document.createElement("div");details.className="bwjm-circle-details";
  details.append(
    group("Elementos focales",by("Foco F₁","Foco F₂","Distancia focal c","Excentricidad e","Relación")),
    group("Medidas",by("Eje mayor","Eje menor","Área interior","Lado recto","Orientación")),
  );
  panel.appendChild(details);
  panel.appendChild(group("Vértices y directrices",
    by("Vértices","Co-vértices","Directrices"),"bwjm-circle-general"));
  if(node.showEquation!==false){
    panel.appendChild(group("Ecuación general",[
      {label:"Forma general",value:geom.generalTex,math:true}
    ],"bwjm-circle-general"));
  }
  if(node.showTangent){
    panel.appendChild(group("Tangente",[
      {label:"Parámetro angular",value:degreesToPiRadians(node.tangentAngle??45),math:true}
    ],"bwjm-circle-angles"));
  }
  return panel;
}
