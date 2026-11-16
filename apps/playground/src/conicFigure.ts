import type { ConicNode } from "@mathmd/ast";
import { createCircleSVG } from "./circleFigure.js";
import { createEllipseSVG } from "./ellipseFigure.js";

/** Textbook-style, deterministic SVG scene. No embedded scripts or user-authored HTML. */
export function createConicSVG(node: ConicNode): SVGSVGElement {
  if ((node.conicType ?? "circle") === "circle") return createCircleSVG(node);
  if (node.conicType === "ellipse") return createEllipseSVG(node);
  const NS = "http://www.w3.org/2000/svg";
  const el = (name: string, attrs: Record<string, string | number> = {}) => {
    const item = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([key, value]) => item.setAttribute(key, String(value)));
    return item;
  };
  const svg = el("svg", { xmlns: NS, viewBox: "0 0 720 460", role: "img",
    "aria-label": "Representación de " + (node.conicType ?? "circunferencia") }) as SVGSVGElement;
  svg.style.width = "100%";
  svg.style.maxHeight = "460px";
  const type = node.conicType ?? "circle";
  const [h, k] = node.center ?? [0, 0];
  const a = node.semiMajorAxis ?? 3;
  const b = node.semiMinorAxis ?? 2;
  const p = node.focalParameter ?? 1;
  const axis = node.axis ?? "x";
  const theta = node.rotation ?? 0;
  const c = type === "hyperbola" ? Math.hypot(a,b) : 0;
  const extent = Math.max(4, type === "parabola" ? Math.abs(p)*5 : a*1.9, b*2, c*1.4);
  const scale = Math.min(290/extent, 190/extent);
  const px = (x: number) => 360 + (x-h)*scale;
  const py = (y: number) => 230 - (y-k)*scale;
  const color = node.color ?? "#2563eb";
  const text = (x: number,y:number,value:string,fill="#475569") => {
    const label = el("text", {x:px(x),y:py(y)-8,fill,"font-size":13,"text-anchor":"middle"});
    label.textContent=value;
    svg.appendChild(label);
  };
  const line = (x1:number,y1:number,x2:number,y2:number,colorLine="#94a3b8",dashed=false) =>
    svg.appendChild(el("line",{x1:px(x1),y1:py(y1),x2:px(x2),y2:py(y2),stroke:colorLine,
      "stroke-width":dashed?1.6:1.2,...(dashed?{"stroke-dasharray":"7 5"}:{})}));
  const dot = (x:number,y:number,name:string,fill="#d97706") => {
    svg.appendChild(el("circle",{cx:px(x),cy:py(y),r:4.5,fill}));
    text(x,y,name,fill);
  };
  const point = (u:number,v:number):[number,number] => [
    h+u*Math.cos(theta)-v*Math.sin(theta),
    k+u*Math.sin(theta)+v*Math.cos(theta),
  ];
  const polyline=(points:[number,number][])=>{
    svg.appendChild(el("polyline",{points:points.map(([x,y])=>px(x)+","+py(y)).join(" "),
      fill:"none",stroke:color,"stroke-width":2.8,"stroke-linejoin":"round","stroke-linecap":"round"}));
  };
  svg.appendChild(el("rect",{width:720,height:460,fill:"transparent"}));
  for(let q=-Math.floor(extent);q<=Math.floor(extent);q++){
    line(h+q,k-extent,h+q,k+extent,"#94a3b82b");
    line(h-extent,k+q,h+extent,k+q,"#94a3b82b");
  }
  line(h-extent,k,h+extent,k,"#64748b");
  line(h,k-extent,h,k+extent,"#64748b");
  if(type==="parabola"){
    const pts:[number,number][]=[];
    for(let i=0;i<=220;i++){const v=-extent*1.1+2*extent*1.1*i/220;const u=v*v/(4*p);
      pts.push(axis==="x"?point(u,v):point(v,u));}
    polyline(pts);
  } else {
    for(const sign of [-1,1]){
      const pts:[number,number][]=[];
      for(let i=-100;i<=100;i++){const t=i*2.2/100;
        const u=sign*a*Math.cosh(t),v=b*Math.sinh(t);
        pts.push(axis==="x"?point(u,v):point(v,u));}
      polyline(pts);
    }
  }
  if(type==="hyperbola" && node.showAsymptotes!==false){
    for(const sign of [-1,1]){
      const t=extent*1.2;const slope=sign*b/a;
      const from=axis==="x"?point(-t,-t*slope):point(-t*slope,-t);
      const to=axis==="x"?point(t,t*slope):point(t*slope,t);
      line(from[0],from[1],to[0],to[1],"#d97706",true);
    }
  }
  if(type==="parabola"){
    const focal=axis==="x"?point(p,0):point(0,p);
    if(node.showFocus!==false)dot(focal[0],focal[1],"F");
    if(node.showDirectrix!==false){
      const from=axis==="x"?point(-p,-extent):point(-extent,-p);
      const to=axis==="x"?point(-p,extent):point(extent,-p);
      line(from[0],from[1],to[0],to[1],"#d97706",true);
    }
  }
  if(type==="hyperbola" && node.showFocus!==false){
    for(const s of [-1,1]){
      const [x,y]=axis==="y"&&type==="hyperbola"?point(0,s*c):point(s*c,0);
      dot(x,y,s<0?"F₁":"F₂");
    }
  }
  if(node.showVertices!==false && type!=="circle"){
    if(type==="parabola") dot(h,k,"V","#0d9488");
    else for(const s of [-1,1]){
      const [x,y]=axis==="y"&&type==="hyperbola"?point(0,s*a):point(s*a,0);
      dot(x,y,s<0?"V₁":"V₂","#0d9488");
    }
  }
  if(node.showCenter!==false && type!=="parabola")dot(h,k,"C","#0d9488");
  return svg;
}
