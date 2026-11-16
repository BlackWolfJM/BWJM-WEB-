import type { ConicNode } from "@mathmd/ast";
import { renderToString } from "katex";
import { circleLineTex } from "./circleConstructions.js";
import { exactRootTex, exactScalarTex, rationalNumber } from "./circleExact.js";
import { circleNumber, degreesToPiRadians } from "./circleReadout.js";
import {
  hyperbolaAxisIntersections,hyperbolaParametricTex,hyperbolaTangentNormal,
  resolveHyperbola,type HyperbolaGeometry,type HyperbolaLine,type HyperbolaPoint,
  type HyperbolaBranch,
} from "./hyperbolaGeometry.js";

export interface HyperbolaMetric {label:string;value:string;math?:boolean}
const coord=(p:HyperbolaPoint)=>
  "\\left("+exactScalarTex(p[0])+",\\;"+exactScalarTex(p[1])+"\\right)";
const rationalCoefficient=(value:number)=>{
  const r=rationalNumber(value);
  return r?exactScalarTex(value):circleNumber(value);
};
const cTex=(g:HyperbolaGeometry)=>exactRootTex(g.a*g.a+g.b*g.b)??exactScalarTex(g.c);
const eTex=(g:HyperbolaGeometry)=>{
  const radical=cTex(g);
  if(radical.startsWith("\\sqrt")&&rationalNumber(g.a))
    return "\\frac{"+radical+"}{"+rationalCoefficient(g.a)+"}";
  return exactScalarTex(g.eccentricity);
};
const quadraticRoots=(a:number,b:number,c:number):string[]=>{
  const eps=1e-11*Math.max(1,Math.abs(a),Math.abs(b),Math.abs(c));
  if(Math.abs(a)<=eps)
    return Math.abs(b)<=eps?[]:[exactScalarTex(-c/b)];
  const disc=b*b-4*a*c;
  if(disc< -eps)return [];
  const center=-b/(2*a);
  if(Math.abs(disc)<=eps)return [exactScalarTex(center)];
  const square=disc/(4*a*a),root=exactRootTex(square);
  const ordinary=[center-Math.sqrt(disc)/(2*Math.abs(a)),
    center+Math.sqrt(disc)/(2*Math.abs(a))];
  if(!root||![a,b,c,center,square].every(v=>Boolean(rationalNumber(v))))
    return ordinary.map(exactScalarTex);
  const base=Math.abs(center)<1e-11?"":exactScalarTex(center);
  return ordinary.map((v,i)=>{
    if(rationalNumber(v))return exactScalarTex(v);
    return base?base+(i===0?"-":"+")+root:(i===0?"-":"")+root;
  });
};
const crossingTex=(g:HyperbolaGeometry)=>{
  const {A,C,D,E,F}=g.coefficients;
  const format=(roots:string[],xAxis:boolean)=>roots.length
    ? roots.map(value=>xAxis?"\\left("+value+",\\;0\\right)":
      "\\left(0,\\;"+value+"\\right)").join(",\\;"):"Ninguno";
  return {
    x:format(quadraticRoots(A,D,F),true),
    y:format(quadraticRoots(C,E,F),false),
  };
};
export function hyperbolaMetrics(
  node:ConicNode,g:HyperbolaGeometry=resolveHyperbola(node),
):HyperbolaMetric[]{
  const cuts=hyperbolaAxisIntersections(g);
  const intercepts=crossingTex(g);
  const branch=(node.hyperbolaBranch??1) as HyperbolaBranch,t=node.tangentParameter??0;
  const at=hyperbolaTangentNormal(g,t,branch);
  return [
    {label:"Centro",value:coord(g.center),math:true},
    {label:"Semieje transverso a",value:exactScalarTex(g.a),math:true},
    {label:"Semieje conjugado b",value:exactScalarTex(g.b),math:true},
    {label:"Distancia focal c",value:cTex(g),math:true},
    {label:"Relación focal",value:"c^2=a^2+b^2",math:true},
    {label:"Excentricidad e",value:eTex(g),math:true},
    {label:"Foco F₁",value:coord(g.focus1),math:true},
    {label:"Foco F₂",value:coord(g.focus2),math:true},
    {label:"Vértices",value:g.vertices.map(coord).join(",\\;"),math:true},
    {label:"Extremos del eje conjugado",value:g.conjugateVertices.map(coord).join(",\\;"),math:true},
    {label:"Longitud del eje transverso",value:exactScalarTex(2*g.a),math:true},
    {label:"Longitud del eje conjugado",value:exactScalarTex(2*g.b),math:true},
    {label:"Asintota 1",value:circleLineTex(g.asymptotes[0]),math:true},
    {label:"Asintota 2",value:circleLineTex(g.asymptotes[1]),math:true},
    {label:"Directriz 1",value:circleLineTex(g.directrices[0]),math:true},
    {label:"Directriz 2",value:circleLineTex(g.directrices[1]),math:true},
    {label:"Distancia de directrices al centro",value:exactScalarTex(g.directrixOffset),math:true},
    {label:"Lado recto",value:exactScalarTex(g.latusRectum),math:true},
    {label:"Extremos del lado recto",
      value:g.latusEndpoints.map(coord).join(",\\;"),math:true},
    {label:"Rotación",value:degreesToPiRadians(g.rotation*180/Math.PI),math:true},
    {label:"Cortes con eje X",value:intercepts.x,math:cuts.x.length>0},
    {label:"Cortes con eje Y",value:intercepts.y,math:cuts.y.length>0},
    {label:"Rama de tangencia",value:branch===1?"Derecha (+U)":"Izquierda (−U)"},
    {label:"Parámetro de tangencia",value:exactScalarTex(t),math:true},
    {label:"Punto de tangencia",value:coord(at.point),math:true},
    {label:"Tangente · ecuación",value:circleLineTex(at.tangent),math:true},
    {label:"Normal · ecuación",value:circleLineTex(at.normal),math:true},
    {label:"Parametrización",value:hyperbolaParametricTex(g),math:true},
  ];
}
const addMath=(root:HTMLElement,tex:string)=>{
  const item=document.createElement("span");
  item.className="bwjm-circle-math";
  item.innerHTML=renderToString(tex,{
    displayMode:false,throwOnError:false,trust:false,
    output:"htmlAndMathml",maxExpand:1000,maxSize:20,
  });
  root.appendChild(item);
};
const addMetric=(list:HTMLElement,m:HyperbolaMetric)=>{
  const row=document.createElement("div");
  const dt=document.createElement("dt");dt.textContent=m.label;
  const dd=document.createElement("dd");
  if(m.math)addMath(dd,m.value);else dd.textContent=m.value;
  row.append(dt,dd);list.appendChild(row);
};
const section=(title:string,values:HyperbolaMetric[],extra="")=>{
  const el=document.createElement("section");el.className="bwjm-circle-section "+extra;
  const heading=document.createElement("h4");heading.textContent=title;
  const content=document.createElement("dl");content.className="bwjm-circle-detail-list";
  for(const item of values)addMetric(content,item);
  el.append(heading,content);return el;
};
export function buildHyperbolaReport(
  node:ConicNode,g:HyperbolaGeometry=resolveHyperbola(node),
):HTMLElement{
  const metrics=hyperbolaMetrics(node,g),pick=(...names:string[])=>
    names.flatMap(name=>metrics.filter(item=>item.label===name));
  const report=document.createElement("section");
  report.className="bwjm-curve-readout bwjm-circle-report bwjm-hyperbola-report";
  report.setAttribute("aria-label","Propiedades de la hipérbola");
  const heading=document.createElement("div");heading.className="bwjm-circle-report-header";
  const title=document.createElement("h3");title.textContent="Propiedades de la hipérbola";
  const mode=document.createElement("span");mode.className="bwjm-circle-mode";
  mode.textContent=node.mode==="general"?"Ecuación general":
    node.mode==="foci"?"Dos focos y diferencia de distancias":"Centro y semiejes";
  heading.append(title,mode);report.appendChild(heading);
  if(node.showEquation!==false){
    const eq=document.createElement("div");eq.className="bwjm-circle-main-equation";
    const name=document.createElement("span");name.className="bwjm-circle-eyebrow";
    name.textContent="ECUACIÓN CANÓNICA";
    const math=document.createElement("div");math.className="bwjm-circle-main-equation-math";
    addMath(math,g.canonicalTex);eq.append(name,math);report.appendChild(eq);
    if(g.transformTex){
      const transform=document.createElement("div");transform.className="bwjm-ellipse-transform";
      const label=document.createElement("span");label.textContent="Coordenadas rotadas";
      const values=document.createElement("div");addMath(values,g.transformTex);
      transform.append(label,values);report.appendChild(transform);
    }
  }
  const highlights=document.createElement("dl");highlights.className="bwjm-circle-highlights";
  for(const item of pick("Centro","Semieje transverso a","Semieje conjugado b"))
    addMetric(highlights,item);
  report.appendChild(highlights);
  const grid=document.createElement("div");grid.className="bwjm-circle-details";
  grid.append(
    section("Elementos focales",pick("Distancia focal c","Relación focal",
      "Excentricidad e","Foco F₁","Foco F₂")),
    section("Ejes y medidas",pick("Longitud del eje transverso",
      "Longitud del eje conjugado","Lado recto","Rotación")),
  );
  report.appendChild(grid);
  report.appendChild(section("Vértices y lado recto",
    pick("Vértices","Extremos del eje conjugado","Extremos del lado recto"),
    "bwjm-circle-general"));
  report.appendChild(section("Asíntotas y directrices",
    pick("Asintota 1","Asintota 2","Directriz 1","Directriz 2",
      "Distancia de directrices al centro"),"bwjm-circle-general"));
  report.appendChild(section("Intersecciones",
    pick("Cortes con eje X","Cortes con eje Y"),"bwjm-circle-general"));
  if(node.showEquation!==false)
    report.appendChild(section("Forma general",[
      {label:"Ecuación general",value:g.generalTex,math:true},
    ],"bwjm-circle-general"));
  if(node.showTangent||node.showNormal)
    report.appendChild(section("Rectas en el punto elegido",[
      ...pick("Rama de tangencia","Parámetro de tangencia","Punto de tangencia"),
      ...(node.showTangent?pick("Tangente · ecuación"):[]),
      ...(node.showNormal?pick("Normal · ecuación"):[]),
    ],"bwjm-circle-angles"));
  if(node.showParametric)
    report.appendChild(section("Parametrización",pick("Parametrización"),
      "bwjm-circle-general"));
  return report;
}
