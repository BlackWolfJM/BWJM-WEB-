import type { ConicNode } from "@mathmd/ast";
import { resolveCircle, type CircleGeometry } from "./circleGeometry.js";

const fmt=(value:number)=>Number(value.toPrecision(8)).toString();
const point=(p:readonly [number,number])=>"("+fmt(p[0])+", "+fmt(p[1])+")";

/** Uses the same report CSS classes as area, vector and data-chart cards. */
export function buildCircleReport(node:ConicNode,
  geometry:CircleGeometry=resolveCircle(node)):HTMLElement {
  const section=document.createElement("section");
  section.className="bwjm-calculus-report bwjm-circle-report";
  section.setAttribute("aria-label","Datos de la circunferencia");
  const heading=document.createElement("strong");
  heading.textContent="Propiedades de la circunferencia";
  section.appendChild(heading);
  const metrics:Array<[string,string]>=[
    ["Definición",node.mode==="three-points"?"Tres puntos":node.mode==="general"?
      "Ecuación general":node.mode==="canonical"?"Ecuación canónica":"Centro y radio"],
    ["Centro",point(geometry.center)],
    ["Radio",fmt(geometry.radius)],
    ["Diámetro",fmt(2*geometry.radius)],
    ["Longitud de circunferencia",fmt(2*Math.PI*geometry.radius)],
    ["Área del círculo",fmt(Math.PI*geometry.radius*geometry.radius)],
    ["Ecuación general",geometry.generalTex],
    ["Cortes con eje X",geometry.xIntersections.length?
      geometry.xIntersections.map(point).join(", "):"Ninguno"],
    ["Cortes con eje Y",geometry.yIntersections.length?
      geometry.yIntersections.map(point).join(", "):"Ninguno"],
  ];
  for(const [label,value] of metrics){
    const row=document.createElement("div");
    row.className="bwjm-metric-row";
    const name=document.createElement("span");name.textContent=label+":";
    const data=document.createElement("output");data.textContent=value;
    row.append(name,data);section.appendChild(row);
  }
  return section;
}
