import type { ConicNode } from "@mathmd/ast";
import { resolveCircle, type CircleGeometry } from "./circleGeometry.js";

/** Shared SVG geometry for the scientific reader and modal preview. */
export function createCircleSVG(node: ConicNode, geometry: CircleGeometry = resolveCircle(node)): SVGSVGElement {
  const ns="http://www.w3.org/2000/svg";
  const make=(tag:string,attributes:Record<string,number|string>={})=>{
    const element=document.createElementNS(ns,tag);
    for(const [key,value] of Object.entries(attributes))element.setAttribute(key,String(value));
    return element;
  };
  const svg=make("svg",{xmlns:ns,viewBox:"0 0 720 460",role:"img",
    "aria-label":"Circunferencia con sus elementos geométricos"}) as SVGSVGElement;
  svg.style.width="100%";
  svg.style.maxHeight="460px";
  const [h,k]=geometry.center,r=geometry.radius;
  const span=Math.max(3,r*1.55);
  const scale=Math.min(320/span,210/span);
  const X=(x:number)=>360+(x-h)*scale,Y=(y:number)=>230-(y-k)*scale;
  const color=node.color??"#0284c7";
  const drawLine=(x1:number,y1:number,x2:number,y2:number,stroke:string,
    dashed=false,role="auxiliar",weight=1.7)=>{
    const line=make("line",{x1:X(x1),y1:Y(y1),x2:X(x2),y2:Y(y2),
      stroke,"stroke-width":weight,"data-role":role,
      ...(dashed?{"stroke-dasharray":"7 5"}:{})});
    svg.appendChild(line);
    return line;
  };
  const marker=(x:number,y:number,label:string,role:string,fill="#d97706")=>{
    svg.appendChild(make("circle",{cx:X(x),cy:Y(y),r:4.2,fill,"data-role":role}));
    const text=make("text",{x:X(x)+7,y:Y(y)-10,fill,"font-size":12});
    text.textContent=label;
    svg.appendChild(text);
  };
  const rad=(degrees:number)=>degrees*Math.PI/180;
  const onCircle=(angle:number):[number,number]=>[h+r*Math.cos(rad(angle)),k+r*Math.sin(rad(angle))];
  const chord=(first:number,second:number,stroke:string,role:string,extended=false)=>{
    const [x1,y1]=onCircle(first),[x2,y2]=onCircle(second);
    if(extended){
      const dx=x2-x1,dy=y2-y1;
      drawLine(x1-2*dx,y1-2*dy,x2+2*dx,y2+2*dy,stroke,true,role);
    }else drawLine(x1,y1,x2,y2,stroke,false,role,2.2);
    marker(x1,y1,"A",role+"-point");
    marker(x2,y2,"B",role+"-point");
  };
  svg.appendChild(make("rect",{width:720,height:460,fill:"transparent"}));
  const gridStep=Math.max(0.5,Math.pow(10,Math.floor(Math.log10(span/4))));
  for(let q=Math.floor((h-span)/gridStep);q<=Math.ceil((h+span)/gridStep);q++){
    drawLine(q*gridStep,k-span,q*gridStep,k+span,"#94a3b82a",false,"grid",0.7);
  }
  for(let q=Math.floor((k-span)/gridStep);q<=Math.ceil((k+span)/gridStep);q++){
    drawLine(h-span,q*gridStep,h+span,q*gridStep,"#94a3b82a",false,"grid",0.7);
  }
  drawLine(0,k-span,0,k+span,"#64748b",false,"axis",1);
  drawLine(h-span,0,h+span,0,"#64748b",false,"axis",1);
  svg.appendChild(make("circle",{cx:X(h),cy:Y(k),r:r*scale,
    fill:color,"fill-opacity":0.045,stroke:color,"stroke-width":3,"data-role":"circle-curve"}));
  if(node.showDiameter){
    const [x1,y1]=onCircle(node.diameterAngle??0);
    const [x2,y2]=onCircle((node.diameterAngle??0)+180);
    drawLine(x1,y1,x2,y2,"#8b5cf6",false,"diameter",2.4);
  }
  if(node.showRadius){
    const [x,y]=onCircle(node.radiusAngle??30);
    drawLine(h,k,x,y,"#eab308",false,"radius",2.4);
    marker(x,y,"R","radius-point","#eab308");
  }
  if(node.showChord)chord(node.chordStartAngle??35,node.chordEndAngle??140,"#16a34a","chord");
  if(node.showSecant)chord(node.secantStartAngle??220,node.secantEndAngle??300,"#06b6d4","secant",true);
  if(node.showTangent){
    const angle=node.tangentAngle??60;
    const [x,y]=onCircle(angle);
    const t=rad(angle),dx=-Math.sin(t),dy=Math.cos(t);
    drawLine(x-dx*span,y-dy*span,x+dx*span,y+dy*span,"#e87934",true,"tangent",2);
    marker(x,y,"T","tangent-point","#e87934");
  }
  if(node.showIntersections){
    for(const [i,[x,y]] of geometry.xIntersections.entries()) marker(x,y,"X"+(i+1),"axis-intersection","#ec4899");
    for(const [i,[x,y]] of geometry.yIntersections.entries()) marker(x,y,"Y"+(i+1),"axis-intersection","#ec4899");
  }
  if(node.showCenter!==false)marker(h,k,"C","center","#0f766e");
  return svg;
}
