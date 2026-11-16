import type { ConicNode } from "@mathmd/ast";
import { ellipseFromCenter, type EllipseGeometry } from "./ellipseGeometry.js";
import type { EllipsePoint } from "./ellipseEquation.js";

export type EllipseHandle =
  "center"|"vertex1"|"vertex2"|"coVertex1"|"coVertex2"|"focus1"|"focus2"|"tangentAngle";
export interface EllipseInteraction {
  center?:EllipsePoint;
  a?:number;
  b?:number;
  tangentAngle?:number;
}
const valid=(point:EllipsePoint)=>point.every(Number.isFinite);
const local=(geom:EllipseGeometry,p:EllipsePoint):EllipsePoint=>{
  const dx=p[0]-geom.center[0],dy=p[1]-geom.center[1],c=Math.cos(geom.rotation),s=Math.sin(geom.rotation);
  return [dx*c+dy*s,-dx*s+dy*c];
};
/** Project moves onto their own geometry axes so the shape remains a valid ellipse. */
export function ellipseDragChange(
  handle:EllipseHandle,geometry:EllipseGeometry,target:EllipsePoint,
  start?:EllipsePoint,
):EllipseInteraction|null{
  if(!valid(target))return null;
  const {center,a,b}=geometry;
  if(handle==="center"){
    if(!start)return null;
    const next:EllipsePoint=[center[0]+target[0]-start[0],center[1]+target[1]-start[1]];
    return valid(next)&&next.every(v=>Math.abs(v)<=10000)?{center:next}:null;
  }
  const [u,v]=local(geometry,target);
  if(handle==="tangentAngle")
    return {tangentAngle:Math.atan2(v/b,u/a)*180/Math.PI};
  if(handle==="vertex1"||handle==="vertex2"){
    const major=Math.abs(u);
    return major>=b&&major<=10000?{a:major}:null;
  }
  if(handle==="coVertex1"||handle==="coVertex2"){
    const minor=Math.abs(v);
    return minor>.001&&minor<=a?{b:minor}:null;
  }
  if(handle==="focus1"||handle==="focus2"){
    const focal=Math.abs(u);
    if(focal>=a)return null;
    const minor=Math.sqrt((a-focal)*(a+focal));
    return minor>.001?{b:minor}:null;
  }
  return null;
}
export function ellipseWorldFromSVG(
  view:EllipsePoint,span:number,x:number,y:number):EllipsePoint{
  const scale=Math.min(310/span,190/span);
  return [view[0]+(x-360)/scale,view[1]-(y-230)/scale];
}
export function mountEllipseDrag(
  mount:HTMLElement,node:ConicNode,original:EllipseGeometry,
  preview:(geo:EllipseGeometry,change:EllipseInteraction)=>void,
  persist:(change:EllipseInteraction)=>void,
):()=>void{
  if(node.showInteractiveControls!==true)return ()=>{};
  const view=node.viewCenter??original.center;
  const span=node.viewSpan??Math.max(4,original.a*1.7,original.b*2,
    node.showDirectrices&&original.directrixOffset!==undefined&&original.directrixOffset<=original.a*4
      ? original.directrixOffset*1.15:0);
  let active:{id:number;handle:EllipseHandle;start:EllipsePoint;
    matrix:DOMMatrix;change:EllipseInteraction|null}|null=null;
  const matrixPoint=(ev:PointerEvent,matrix:DOMMatrix):EllipsePoint=>{
    const svg=new DOMPoint(ev.clientX,ev.clientY).matrixTransform(matrix);
    return ellipseWorldFromSVG(view,span,svg.x,svg.y);
  };
  const down=(ev:PointerEvent)=>{
    if(ev.button!==0||active)return;
    if(!(ev.target instanceof Element))return;
    const handle=ev.target.closest("[data-handle]")?.getAttribute("data-handle") as EllipseHandle|null;
    const svg=ev.target.closest("svg") as SVGSVGElement|null;
    const inverse=svg?.getScreenCTM()?.inverse();
    if(!handle||!inverse||!["center","vertex1","vertex2","coVertex1",
      "coVertex2","focus1","focus2","tangentAngle"].includes(handle))return;
    ev.preventDefault();
    active={id:ev.pointerId,handle,start:matrixPoint(ev,inverse),matrix:inverse,change:null};
    mount.setPointerCapture(ev.pointerId);
    mount.classList.add("bwjm-ellipse-dragging");
  };
  const move=(ev:PointerEvent)=>{
    if(!active||active.id!==ev.pointerId)return;
    const change=ellipseDragChange(active.handle,original,matrixPoint(ev,active.matrix),active.start);
    if(!change)return;
    const center=change.center??original.center;
    try{
      const next=ellipseFromCenter(center,change.a??original.a,change.b??original.b,
        "x",original.rotation);
      active.change=change;preview(next,change);
    }catch{/* Ignore a position that would make the ellipse invalid. */}
  };
  const end=(ev:PointerEvent)=>{
    if(!active||active.id!==ev.pointerId)return;
    const change=active.change;
    active=null;mount.classList.remove("bwjm-ellipse-dragging");
    if(mount.hasPointerCapture(ev.pointerId))mount.releasePointerCapture(ev.pointerId);
    if(ev.type==="pointerup"&&change)persist(change);
    else preview(original,{});
  };
  const keyboard=(ev:KeyboardEvent)=>{
    if(!(ev.target instanceof Element))return;
    const handle=ev.target.getAttribute("data-handle") as EllipseHandle|null;
    if(!handle)return;
    const delta:Record<string,EllipsePoint>={
      ArrowLeft:[-.1,0],ArrowRight:[.1,0],ArrowUp:[0,.1],ArrowDown:[0,-.1],
    };
    const offset=delta[ev.key];
    if(!offset)return;
    ev.preventDefault();
    const base:Record<EllipseHandle,EllipsePoint>={
      center:original.center,vertex1:original.vertices[0],vertex2:original.vertices[1],
      coVertex1:original.coVertices[0],coVertex2:original.coVertices[1],
      focus1:original.focus1,focus2:original.focus2,
      tangentAngle: [
        original.center[0]+original.a*Math.cos((node.tangentAngle??45)*Math.PI/180)*Math.cos(original.rotation)
          -original.b*Math.sin((node.tangentAngle??45)*Math.PI/180)*Math.sin(original.rotation),
        original.center[1]+original.a*Math.cos((node.tangentAngle??45)*Math.PI/180)*Math.sin(original.rotation)
          +original.b*Math.sin((node.tangentAngle??45)*Math.PI/180)*Math.cos(original.rotation),
      ],
    };
    const multiplier=ev.shiftKey?10:1;
    const point:EllipsePoint=[base[handle][0]+offset[0]*multiplier,
      base[handle][1]+offset[1]*multiplier];
    const change=ellipseDragChange(handle,original,point,base[handle]);
    if(!change)return;
    try{
      const geo=ellipseFromCenter(change.center??original.center,change.a??original.a,
        change.b??original.b,"x",original.rotation);
      preview(geo,change);persist(change);
    }catch{/* Out-of-range keyboard move. */}
  };
  mount.addEventListener("pointerdown",down);
  mount.addEventListener("pointermove",move);
  mount.addEventListener("pointerup",end);
  mount.addEventListener("pointercancel",end);
  mount.addEventListener("lostpointercapture",end);
  mount.addEventListener("keydown",keyboard);
  return ()=>{
    mount.removeEventListener("pointerdown",down);
    mount.removeEventListener("pointermove",move);
    mount.removeEventListener("pointerup",end);
    mount.removeEventListener("pointercancel",end);
    mount.removeEventListener("lostpointercapture",end);
    mount.removeEventListener("keydown",keyboard);
  };
}
