import type { ConicNode } from "@mathmd/ast";
import { renderToString } from "katex";
import { circleLineTex } from "./circleConstructions.js";
import { exactScalarTex } from "./circleExact.js";
import { circleNumber, degreesToPiRadians } from "./circleReadout.js";
import { parabolaAxisIntersections, parabolaParametricTex,
  parabolaTangentNormal, resolveParabola, type ParabolaGeometry,
  type ParabolaPoint } from "./parabolaGeometry.js";

export interface ParabolaMetric {label:string;value:string;math?:boolean}
const coords=(p:ParabolaPoint)=>"\\left("+exactScalarTex(p[0])+",\\;"+exactScalarTex(p[1])+"\\right)";
const direction=(g:ParabolaGeometry):string=>{
  const [x,y]=[Math.cos(g.rotation)*Math.sign(g.p),
    Math.sin(g.rotation)*Math.sign(g.p)];
  if(Math.abs(x)>1-1e-9)return x>0?"Derecha (+x)":"Izquierda (−x)";
  if(Math.abs(y)>1-1e-9)return y>0?"Arriba (+y)":"Abajo (−y)";
  return "Oblicua";
};
export function parabolaMetrics(
  node:ConicNode,g:ParabolaGeometry=resolveParabola(node),
):ParabolaMetric[]{
  const cuts=parabolaAxisIntersections(g);
  const show=(values:ParabolaPoint[])=>values.length?values.map(coords).join(",\\;"):"Ninguno";
  const t=node.tangentParameter??0,lines=parabolaTangentNormal(g,t);
  return [
    {label:"Vértice",value:coords(g.vertex),math:true},
    {label:"Foco",value:coords(g.focus),math:true},
    {label:"Parámetro focal p",value:exactScalarTex(g.p),math:true},
    {label:"Longitud del lado recto",value:exactScalarTex(g.latusRectum),math:true},
    {label:"Extremos del lado recto",
      value:g.latusEndpoints.map(coords).join(",\\;"),math:true},
    {label:"Directriz · ecuación",value:circleLineTex(g.directrix),math:true},
    {label:"Eje de simetría · ecuación",value:circleLineTex(g.axisLine),math:true},
    {label:"Apertura",value:direction(g)},
    {label:"Rotación del eje",value:degreesToPiRadians(g.rotation*180/Math.PI),math:true},
    {label:"Cortes con eje X",value:show(cuts.x),math:cuts.x.length>0},
    {label:"Cortes con eje Y",value:show(cuts.y),math:cuts.y.length>0},
    {label:"Parámetro de tangencia",value:circleNumber(t),math:true},
    {label:"Punto de tangencia",value:coords(lines.point),math:true},
    {label:"Tangente · ecuación",value:circleLineTex(lines.tangent),math:true},
    {label:"Normal · ecuación",value:circleLineTex(lines.normal),math:true},
    {label:"Parametrización",value:parabolaParametricTex(g),math:true},
  ];
}
const appendMath=(parent:HTMLElement,tex:string)=>{
  const span=document.createElement("span");
  span.className="bwjm-circle-math";
  span.innerHTML=renderToString(tex,{displayMode:false,throwOnError:false,trust:false,
    maxExpand:1000,maxSize:20,output:"htmlAndMathml"});
  parent.appendChild(span);
};
const row=(list:HTMLElement,data:ParabolaMetric)=>{
  const container=document.createElement("div");
  const dt=document.createElement("dt");dt.textContent=data.label;
  const dd=document.createElement("dd");
  if(data.math)appendMath(dd,data.value);else dd.textContent=data.value;
  container.append(dt,dd);
  list.appendChild(container);
};
const section=(title:string,data:ParabolaMetric[],extra="")=>{
  const div=document.createElement("div");
  div.className="bwjm-circle-section "+extra;
  const heading=document.createElement("h4");heading.textContent=title;
  const dl=document.createElement("dl");dl.className="bwjm-circle-detail-list";
  for(const metric of data)row(dl,metric);
  div.append(heading,dl);
  return div;
};
export function buildParabolaReport(
  node:ConicNode,g:ParabolaGeometry=resolveParabola(node),
):HTMLElement{
  const panel=document.createElement("section");
  panel.className="bwjm-curve-readout bwjm-circle-report bwjm-parabola-report";
  panel.setAttribute("aria-label","Propiedades de la parábola");
  const header=document.createElement("div");
  header.className="bwjm-circle-report-header";
  const title=document.createElement("h3");title.textContent="Propiedades de la parábola";
  const tag=document.createElement("span");tag.className="bwjm-circle-mode";
  tag.textContent=node.mode==="general"?"Ecuación general":
    node.mode==="focus-directrix"?"Foco y directriz":"Vértice y parámetro focal";
  header.append(title,tag);panel.appendChild(header);
  if(node.showEquation!==false){
    const main=document.createElement("div");main.className="bwjm-circle-main-equation";
    const label=document.createElement("span");label.className="bwjm-circle-eyebrow";
    label.textContent="ECUACIÓN CANÓNICA";
    const math=document.createElement("div");math.className="bwjm-circle-main-equation-math";
    appendMath(math,g.canonicalTex);
    main.append(label,math);panel.appendChild(main);
    if(g.transformTex){
      const transformed=document.createElement("div");
      transformed.className="bwjm-ellipse-transform";
      const name=document.createElement("span");name.textContent="Coordenadas rotadas";
      const formula=document.createElement("div");appendMath(formula,g.transformTex);
      transformed.append(name,formula);panel.appendChild(transformed);
    }
  }
  const metrics=parabolaMetrics(node,g);
  const selected=(...labels:string[])=>labels.flatMap(label=>
    metrics.filter(item=>item.label===label));
  const highlights=document.createElement("dl");highlights.className="bwjm-circle-highlights";
  for(const datum of selected("Vértice","Foco","Parámetro focal p"))row(highlights,datum);
  panel.appendChild(highlights);
  const sections=document.createElement("div");sections.className="bwjm-circle-details";
  sections.append(
    section("Geometría",selected("Directriz · ecuación","Eje de simetría · ecuación",
      "Apertura","Rotación del eje")),
    section("Lado recto",selected("Longitud del lado recto","Extremos del lado recto")),
  );
  panel.appendChild(sections);
  panel.appendChild(section("Intersecciones",selected("Cortes con eje X","Cortes con eje Y"),
    "bwjm-circle-general"));
  if(node.showEquation!==false){
    panel.appendChild(section("Forma general",[
      {label:"Ecuación general",value:g.generalTex,math:true},
    ],"bwjm-circle-general"));
  }
  if(node.showTangent||node.showNormal){
    panel.appendChild(section("Rectas en el punto seleccionado",[
      ...selected("Parámetro de tangencia","Punto de tangencia"),
      ...(node.showTangent?selected("Tangente · ecuación"):[]),
      ...(node.showNormal?selected("Normal · ecuación"):[]),
    ],"bwjm-circle-angles"));
  }
  if(node.showParametric){
    panel.appendChild(section("Parametrización",selected("Parametrización"),
      "bwjm-circle-general"));
  }
  return panel;
}
