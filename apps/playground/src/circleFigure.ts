import type { ConicNode } from "@mathmd/ast";
import { resolveCircle, type CircleGeometry } from "./circleGeometry.js";
import { circleAuxiliaryLines, circlePointAt, type CircleLine, type CirclePoint } from "./circleConstructions.js";

/** Shared deterministic geometry: SVG keeps draggable handles separate from ordinary annotations. */
export function circleView(node:Pick<ConicNode,"viewCenter"|"viewSpan">,geometry:CircleGeometry){
  const viewCenter=node.viewCenter??geometry.center;
  const span=node.viewSpan??Math.max(3,geometry.radius*1.55);
  const scale=Math.min(320/span,210/span);
  return {viewCenter,span,scale};
}
/** The diagram has a 720×460 viewBox, with origin (360,230) for viewCenter. */
export function circleWorldAtSVG(
  node:Pick<ConicNode,"viewCenter"|"viewSpan">,geometry:CircleGeometry,
  x:number,y:number,
):CirclePoint {
  const {viewCenter,scale}=circleView(node,geometry);
  return [viewCenter[0]+(x-360)/scale,viewCenter[1]-(y-230)/scale];
}
export function createCircleSVG(
  node:ConicNode,geometry:CircleGeometry=resolveCircle(node),
):SVGSVGElement {
  const ns="http://www.w3.org/2000/svg";
  const make=(tag:string,attributes:Record<string,number|string>={})=>{
    const el=document.createElementNS(ns,tag);
    Object.entries(attributes).forEach(([key,value])=>el.setAttribute(key,String(value)));
    return el;
  };
  const svg=make("svg",{xmlns:ns,viewBox:"0 0 720 460",role:"img",
    "aria-label":"Circunferencia interactiva: arrastra el centro o los puntos señalados"}) as SVGSVGElement;
  svg.style.width="100%";svg.style.maxHeight="460px";
  const [h,k]=geometry.center,r=geometry.radius;
  const {viewCenter,span,scale}=circleView(node,geometry);
  const X=(x:number)=>360+(x-viewCenter[0])*scale;
  const Y=(y:number)=>230-(y-viewCenter[1])*scale;
  const color=node.color??"#0284c7";
  const drawLine=(from:CirclePoint,to:CirclePoint,stroke:string,role:string,dashed=false,width=1.7)=>{
    const line=make("line",{x1:X(from[0]),y1:Y(from[1]),x2:X(to[0]),y2:Y(to[1]),
      stroke,"stroke-width":width,"data-role":role,...(dashed?{"stroke-dasharray":"7 5"}:{})});
    svg.appendChild(line);
  };
  const marker=(point:CirclePoint,label:string,role:string,fill="#d97706",handle?:string)=>{
    const [x,y]=point;
    if(handle&&node.showInteractiveControls===true){
      const hit=make("circle",{cx:X(x),cy:Y(y),r:13,fill:"transparent",
        "data-handle":handle,tabindex:0,role:"button",
        "aria-label":"Arrastrar "+label,"data-role":role});
      hit.setAttribute("class","bwjm-circle-drag-handle");
      svg.appendChild(hit);
    }
    const dot=make("circle",{cx:X(x),cy:Y(y),r:4.8,fill,
      "data-role":role,...(handle&&node.showInteractiveControls===true?{"data-handle":handle}:{})});
    if(handle&&node.showInteractiveControls===true)dot.setAttribute("class","bwjm-circle-drag-handle");
    svg.appendChild(dot);
    const text=make("text",{x:X(x)+7,y:Y(y)-10,fill,"font-size":12,
      "pointer-events":"none"});
    text.textContent=label;svg.appendChild(text);
  };
  const lineByEquation=(eq:CircleLine,stroke:string,role:string,dashed=false)=>{
    const [a,b]=[eq.a,eq.b],norm=Math.hypot(a,b);
    if(norm<1e-12)return;
    const distance=-(eq.a*viewCenter[0]+eq.b*viewCenter[1]+eq.c)/(norm*norm);
    const middle:CirclePoint=[viewCenter[0]+a*distance,viewCenter[1]+b*distance];
    const t=span*4;
    drawLine([middle[0]-b/norm*t,middle[1]+a/norm*t],
      [middle[0]+b/norm*t,middle[1]-a/norm*t],stroke,role,dashed,2);
  };
  svg.appendChild(make("rect",{width:720,height:460,fill:"transparent"}));
  const step=Math.max(.5,Math.pow(10,Math.floor(Math.log10(span/4))));
  const minX=viewCenter[0]-span,maxX=viewCenter[0]+span;
  const minY=viewCenter[1]-span,maxY=viewCenter[1]+span;
  for(let n=Math.floor(minX/step);n<=Math.ceil(maxX/step);n++)
    drawLine([n*step,minY],[n*step,maxY],"#94a3b82a","grid",false,.7);
  for(let n=Math.floor(minY/step);n<=Math.ceil(maxY/step);n++)
    drawLine([minX,n*step],[maxX,n*step],"#94a3b82a","grid",false,.7);
  drawLine([0,minY],[0,maxY],"#64748b","axis",false,1);
  drawLine([minX,0],[maxX,0],"#64748b","axis",false,1);
  svg.appendChild(make("circle",{cx:X(h),cy:Y(k),r:r*scale,fill:color,
    "fill-opacity":.045,stroke:color,"stroke-width":3,"data-role":"circle-curve"}));
  if(node.showDiameter){
    const a=circlePointAt(geometry,node.diameterAngle??0);
    const b=circlePointAt(geometry,(node.diameterAngle??0)+180);
    drawLine(a,b,"#8b5cf6","diameter",false,2.4);
    marker(a,"D","diameter-point","#8b5cf6","diameterAngle");
  }
  if(node.showRadius){
    const point=circlePointAt(geometry,node.radiusAngle??30);
    drawLine(geometry.center,point,"#eab308","radius",false,2.4);
    marker(point,"R","radius-point","#eab308","radiusAngle");
  }
  if(node.showChord){
    const a=circlePointAt(geometry,node.chordStartAngle??35);
    const b=circlePointAt(geometry,node.chordEndAngle??140);
    drawLine(a,b,"#16a34a","chord",false,2.4);
    marker(a,"A","chord-point","#16a34a","chordStartAngle");
    marker(b,"B","chord-point","#16a34a","chordEndAngle");
  }
  if(node.showSecant){
    const a=circlePointAt(geometry,node.secantStartAngle??220);
    const b=circlePointAt(geometry,node.secantEndAngle??300);
    const eq=circleAuxiliaryLines({...node,showChord:false,showTangent:false},geometry)
      .find(line=>line.kind==="secant");
    if(eq)lineByEquation(eq.line,"#06b6d4","secant",true);
    marker(a,"A","secant-point","#06b6d4","secantStartAngle");
    marker(b,"B","secant-point","#06b6d4","secantEndAngle");
  }
  if(node.showTangent){
    const tangents=circleAuxiliaryLines({...node,showChord:false,showSecant:false},geometry)
      .filter(line=>line.kind==="tangent");
    for(const [index,tangent] of tangents.entries()){
      lineByEquation(tangent.line,"#e87934","tangent",true);
      for(const touch of tangent.touches)
        marker(touch,tangents.length===1?"T":"T"+(index+1),"tangent-point",
          "#e87934",node.tangentMode==="point"?undefined:"tangentAngle");
    }
    if(node.tangentMode==="point"&&node.tangentPoint){
      marker(node.tangentPoint,"P","tangent-reference","#b45309","tangentPoint");
    }
  }
  if(node.showIntersections){
    for(const [i,p] of geometry.xIntersections.entries())marker(p,"X"+(i+1),"axis-intersection","#ec4899");
    for(const [i,p] of geometry.yIntersections.entries())marker(p,"Y"+(i+1),"axis-intersection","#ec4899");
  }
  if(node.showCenter!==false)marker(geometry.center,"C","center","#0f766e","center");
  return svg;
}
