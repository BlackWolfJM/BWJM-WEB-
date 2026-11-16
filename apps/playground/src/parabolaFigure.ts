import type { ConicNode } from "@mathmd/ast";
import { parabolaAxisIntersections, parabolaParametricPoint,
  parabolaPoint, parabolaTangentNormal, resolveParabola,
  type ParabolaGeometry, type ParabolaPoint,
} from "./parabolaGeometry.js";

export function parabolaView(node:Pick<ConicNode,"viewCenter"|"viewSpan">,g:ParabolaGeometry){
  const viewCenter=node.viewCenter??g.vertex;
  const span=node.viewSpan??Math.max(3,Math.abs(g.p)*5);
  const scale=Math.min(310/span,195/span);
  return {viewCenter,span,scale};
}
export function parabolaWorldFromSvg(
  node:Pick<ConicNode,"viewCenter"|"viewSpan">,g:ParabolaGeometry,x:number,y:number,
):ParabolaPoint{
  const {viewCenter,scale}=parabolaView(node,g);
  return [viewCenter[0]+(x-360)/scale,viewCenter[1]-(y-230)/scale];
}
/** SVG shares one world transform across curves, auxiliary lines and draggable handles. */
export function createParabolaSVG(node:ConicNode,g:ParabolaGeometry=resolveParabola(node)):SVGSVGElement {
  const ns="http://www.w3.org/2000/svg";
  const el=(tag:string,attr:Record<string,string|number>={})=>{
    const dom=document.createElementNS(ns,tag);
    for(const [key,value] of Object.entries(attr))dom.setAttribute(key,String(value));
    return dom;
  };
  const svg=el("svg",{xmlns:ns,viewBox:"0 0 720 460",role:"img",
    "aria-label":"Parábola con foco, directriz, eje de simetría y puntos ajustables"}) as SVGSVGElement;
  svg.style.width="100%";
  svg.style.maxHeight="460px";
  const {viewCenter,span,scale}=parabolaView(node,g);
  const X=(x:number)=>360+(x-viewCenter[0])*scale;
  const Y=(y:number)=>230-(y-viewCenter[1])*scale;
  const color=node.color??"#2563eb";
  const axis:ParabolaPoint=[Math.cos(g.rotation),Math.sin(g.rotation)];
  const transverse:ParabolaPoint=[-axis[1],axis[0]];
  const line=(first:ParabolaPoint,second:ParabolaPoint,stroke:string,role:string,
    dashed=false,width=1.7)=>{
    svg.appendChild(el("line",{x1:X(first[0]),y1:Y(first[1]),x2:X(second[0]),
      y2:Y(second[1]),stroke,"stroke-width":width,
      "data-role":role,...(dashed?{"stroke-dasharray":"7 5"}:{})}));
  };
  const marker=(point:ParabolaPoint,label:string,role:string,
    fill="#0d9488",handle?:string)=>{
    const [x,y]=point;
    if(handle&&node.showInteractiveControls===true){
      const hit=el("circle",{cx:X(x),cy:Y(y),r:13,fill:"transparent",
        "data-role":role,"data-handle":handle,tabindex:0,role:"button",
        "aria-label":"Arrastrar "+label});
      hit.setAttribute("class","bwjm-parabola-drag-handle");
      svg.appendChild(hit);
    }
    const dot=el("circle",{cx:X(x),cy:Y(y),r:4.6,fill,"data-role":role,
      ...(handle&&node.showInteractiveControls===true?{"data-handle":handle}:{})});
    if(handle&&node.showInteractiveControls===true)dot.setAttribute("class","bwjm-parabola-drag-handle");
    svg.appendChild(dot);
    const txt=el("text",{x:X(x)+7,y:Y(y)-9,"font-size":12,fill,"pointer-events":"none"});
    txt.textContent=label;
    svg.appendChild(txt);
  };
  const extended=(normal:ParabolaPoint,reference:ParabolaPoint,stroke:string,
    role:string,dashed=true)=>{
    const t:ParabolaPoint=[-normal[1],normal[0]],length=Math.hypot(...t);
    if(length<1e-12)return;
    const extent=span*3;
    line([reference[0]-extent*t[0]/length,reference[1]-extent*t[1]/length],
      [reference[0]+extent*t[0]/length,reference[1]+extent*t[1]/length],
      stroke,role,dashed,1.9);
  };
  svg.appendChild(el("rect",{width:720,height:460,fill:"transparent"}));
  const step=Math.max(.25,Math.pow(10,Math.floor(Math.log10(span/4))));
  const left=viewCenter[0]-span*1.6,right=viewCenter[0]+span*1.6;
  const bottom=viewCenter[1]-span*1.6,top=viewCenter[1]+span*1.6;
  for(let n=Math.ceil(left/step);n<=Math.floor(right/step);n++)
    line([n*step,bottom],[n*step,top],"#94a3b829","grid",false,.65);
  for(let n=Math.ceil(bottom/step);n<=Math.floor(top/step);n++)
    line([left,n*step],[right,n*step],"#94a3b829","grid",false,.65);
  line([0,bottom],[0,top],"#64748b","cartesian-axis",false,1.1);
  line([left,0],[right,0],"#64748b","cartesian-axis",false,1.1);
  const parameterExtent=Math.min(3000,Math.max(2.5,Math.sqrt(span*1.35/Math.abs(g.p))));
  const samples:string[]=[];
  for(let index=0;index<=420;index++){
    const t=-parameterExtent+2*parameterExtent*index/420;
    const [x,y]=parabolaParametricPoint(g,t);
    samples.push(X(x)+","+Y(y));
  }
  svg.appendChild(el("polyline",{points:samples.join(" "),fill:"none",stroke:color,
    "stroke-width":3,"stroke-linejoin":"round","stroke-linecap":"round",
    "data-role":"parabola-curve"}));
  if(node.showAxes!==false){
    extended(transverse,g.vertex,"#c99635","symmetry-axis",true);
    const direction=Math.sign(g.p),tip:ParabolaPoint=[
      g.vertex[0]+direction*span*.65*axis[0],
      g.vertex[1]+direction*span*.65*axis[1]];
    const arrow=el("text",{x:X(tip[0]),y:Y(tip[1]),"text-anchor":"middle",
      "font-size":13,fill:"#c99635","data-role":"opening-direction"});
    arrow.textContent="↗";
    svg.appendChild(arrow);
  }
  if(node.showDirectrix!==false){
    const on=parabolaPoint(g,-g.p,0);
    extended(axis,on,"#d97706","directrix",true);
    marker(on,"D","directrix-point","#d97706","directrix");
  }
  if(node.showLatusRectum){
    line(g.latusEndpoints[0],g.latusEndpoints[1],"#8b5cf6","latus-rectum",false,2.3);
    marker(g.latusEndpoints[0],"L₁","latus-point","#8b5cf6","latus1");
    marker(g.latusEndpoints[1],"L₂","latus-point","#8b5cf6","latus2");
  }
  if(node.showFocus!==false)marker(g.focus,"F","focus","#b45309","focus");
  if(node.showIntersections){
    const cuts=parabolaAxisIntersections(g);
    for(const [i,p] of cuts.x.entries())marker(p,"X"+(i+1),"axis-intersection","#db2777");
    for(const [i,p] of cuts.y.entries())marker(p,"Y"+(i+1),"axis-intersection","#db2777");
  }
  if(node.showTangent||node.showNormal){
    const t=node.tangentParameter??0;
    const tangent=parabolaTangentNormal(g,t);
    if(node.showTangent)extended([tangent.tangent.a,tangent.tangent.b],tangent.point,
      "#e87934","tangent",true);
    if(node.showNormal)extended([tangent.normal.a,tangent.normal.b],tangent.point,
      "#a855f7","normal",true);
    marker(tangent.point,"T","tangent-point","#e87934","tangent");
  }
  if(node.showVertices!==false)marker(g.vertex,"V","vertex","#0f766e","vertex");
  return svg;
}
