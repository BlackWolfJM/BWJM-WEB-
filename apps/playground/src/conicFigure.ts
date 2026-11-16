import type { ConicNode } from "@mathmd/ast";
import { createCircleSVG } from "./circleFigure.js";
import { createEllipseSVG } from "./ellipseFigure.js";
import { createParabolaSVG } from "./parabolaFigure.js";

/** Dispatch to specialized renderers without changing existing hyperbola behavior. */
export function createConicSVG(node:ConicNode):SVGSVGElement {
  if((node.conicType??"circle")==="circle")return createCircleSVG(node);
  if(node.conicType==="ellipse")return createEllipseSVG(node);
  if(node.conicType==="parabola")return createParabolaSVG(node);
  return createHyperbolaSVG(node);
}

/** Existing hyperbola scene, retained until its own scientific upgrade. */
function createHyperbolaSVG(node:ConicNode):SVGSVGElement{
  const ns="http://www.w3.org/2000/svg";
  const el=(tag:string,attributes:Record<string,string|number>={})=>{
    const dom=document.createElementNS(ns,tag);
    for(const [key,value] of Object.entries(attributes))dom.setAttribute(key,String(value));
    return dom;
  };
  const svg=el("svg",{xmlns:ns,viewBox:"0 0 720 460",role:"img",
    "aria-label":"Hipérbola con focos, vértices y asíntotas"}) as SVGSVGElement;
  svg.style.width="100%";svg.style.maxHeight="460px";
  const [h,k]=node.center??[0,0];
  const a=node.semiMajorAxis??3,b=node.semiMinorAxis??2;
  const c=Math.hypot(a,b),axis=node.axis??"x",theta=node.rotation??0;
  const extent=Math.max(4,a*1.9,b*2,c*1.4);
  const scale=Math.min(290/extent,190/extent);
  const X=(x:number)=>360+(x-h)*scale,Y=(y:number)=>230-(y-k)*scale;
  const color=node.color??"#2563eb";
  const point=(u:number,v:number):[number,number]=>[
    h+u*Math.cos(theta)-v*Math.sin(theta),
    k+u*Math.sin(theta)+v*Math.cos(theta),
  ];
  const line=(first:[number,number],second:[number,number],stroke:string,dashed=false)=>{
    svg.appendChild(el("line",{x1:X(first[0]),y1:Y(first[1]),
      x2:X(second[0]),y2:Y(second[1]),stroke,
      "stroke-width":dashed?1.6:1.2,
      ...(dashed?{"stroke-dasharray":"7 5"}:{})}));
  };
  const marker=(world:[number,number],label:string,fill="#d97706")=>{
    svg.appendChild(el("circle",{cx:X(world[0]),cy:Y(world[1]),r:4.5,fill}));
    const name=el("text",{x:X(world[0]),y:Y(world[1])-8,fill,"font-size":13,
      "text-anchor":"middle"});
    name.textContent=label;svg.appendChild(name);
  };
  svg.appendChild(el("rect",{width:720,height:460,fill:"transparent"}));
  for(let index=-Math.floor(extent);index<=Math.floor(extent);index++){
    line([h+index,k-extent],[h+index,k+extent],"#94a3b82b");
    line([h-extent,k+index],[h+extent,k+index],"#94a3b82b");
  }
  line([h-extent,k],[h+extent,k],"#64748b");
  line([h,k-extent],[h,k+extent],"#64748b");
  for(const sign of [-1,1]){
    const points:string[]=[];
    for(let i=-100;i<=100;i++){
      const t=i*2.2/100,u=sign*a*Math.cosh(t),v=b*Math.sinh(t);
      const [x,y]=axis==="x"?point(u,v):point(v,u);
      points.push(X(x)+","+Y(y));
    }
    svg.appendChild(el("polyline",{points:points.join(" "),fill:"none",stroke:color,
      "stroke-width":2.8,"stroke-linejoin":"round","stroke-linecap":"round"}));
  }
  if(node.showAsymptotes!==false){
    for(const sign of [-1,1]){
      const t=extent*1.2,slope=sign*b/a;
      const from=axis==="x"?point(-t,-t*slope):point(-t*slope,-t);
      const to=axis==="x"?point(t,t*slope):point(t*slope,t);
      line(from,to,"#d97706",true);
    }
  }
  if(node.showFocus!==false){
    for(const sign of [-1,1]){
      marker(axis==="x"?point(sign*c,0):point(0,sign*c),
        sign<0?"F₁":"F₂");
    }
  }
  if(node.showVertices!==false){
    for(const sign of [-1,1]){
      marker(axis==="x"?point(sign*a,0):point(0,sign*a),
        sign<0?"V₁":"V₂","#0d9488");
    }
  }
  if(node.showCenter!==false)marker([h,k],"C","#0d9488");
  return svg;
}
