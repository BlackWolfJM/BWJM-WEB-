import type { ConicNode } from "@mathmd/ast";
import { parabolaFromVertex, parabolaParametricPoint, parabolaPoint,
  type ParabolaGeometry, type ParabolaPoint } from "./parabolaGeometry.js";
import { parabolaWorldFromSvg } from "./parabolaFigure.js";

export type ParabolaHandle="vertex"|"focus"|"directrix"|"latus1"|"latus2"|"tangent";
export interface ParabolaInteraction{
  vertex?:ParabolaPoint;
  p?:number;
  rotation?:number;
  tangentParameter?:number;
}
export function parabolaDragChange(handle:ParabolaHandle,geom:ParabolaGeometry,
  target:ParabolaPoint,start?:ParabolaPoint):ParabolaInteraction|null{
  if(!target.every(Number.isFinite))return null;
  const [ux,uy]=[Math.cos(geom.rotation),Math.sin(geom.rotation)];
  const vx=-uy,vy=ux;
  if(handle==="vertex"){
    if(!start)return null;
    const vertex:ParabolaPoint=[geom.vertex[0]+target[0]-start[0],
      geom.vertex[1]+target[1]-start[1]];
    return vertex.every(value=>Math.abs(value)<=10000)?{vertex}:null;
  }
  const dx=target[0]-geom.vertex[0],dy=target[1]-geom.vertex[1];
  const axis=dx*ux+dy*uy,transverse=dx*vx+dy*vy;
  if(handle==="tangent"){
    const t=transverse/(2*geom.p);
    return Number.isFinite(t)&&Math.abs(t)<=1000?{tangentParameter:t}:null;
  }
  const next=handle==="focus"?axis:handle==="directrix"?-axis:
    Math.sign(geom.p)*Math.abs(transverse)/2;
  return Number.isFinite(next)&&Math.sign(next)===Math.sign(geom.p)&&
    Math.abs(next)>=.001&&Math.abs(next)<=10000?{p:next}:null;
}
export function mountParabolaDrag(
  mount:HTMLElement,node:ConicNode,original:ParabolaGeometry,
  preview:(geometry:ParabolaGeometry,change:ParabolaInteraction)=>void,
  persist:(change:ParabolaInteraction)=>void,
):()=>void{
  if(node.showInteractiveControls!==true)return ()=>{};
  let current:{id:number;handle:ParabolaHandle;start:ParabolaPoint;
    matrix:DOMMatrix;change:ParabolaInteraction|null}|null=null;
  const stable:ConicNode={...node,viewCenter:node.viewCenter??original.vertex,
    viewSpan:node.viewSpan??Math.max(3,Math.abs(original.p)*5)};
  const world=(ev:PointerEvent,matrix:DOMMatrix):ParabolaPoint=>{
    const p=new DOMPoint(ev.clientX,ev.clientY).matrixTransform(matrix);
    return parabolaWorldFromSvg(stable,original,p.x,p.y);
  };
  const begin=(ev:PointerEvent)=>{
    if(ev.button!==0||current||!(ev.target instanceof Element))return;
    const handle=ev.target.closest("[data-handle]")?.getAttribute("data-handle") as ParabolaHandle|null;
    const svg=ev.target.closest("svg") as SVGSVGElement|null;
    const inverse=svg?.getScreenCTM()?.inverse();
    if(!handle||!inverse||!["vertex","focus","directrix","latus1",
      "latus2","tangent"].includes(handle))return;
    ev.preventDefault();
    current={id:ev.pointerId,handle,start:world(ev,inverse),matrix:inverse,change:null};
    mount.setPointerCapture(ev.pointerId);
    mount.classList.add("bwjm-parabola-dragging");
  };
  const move=(ev:PointerEvent)=>{
    if(!current||ev.pointerId!==current.id)return;
    const change=parabolaDragChange(current.handle,original,world(ev,current.matrix),current.start);
    if(!change)return;
    try{
      const g=parabolaFromVertex(change.vertex??original.vertex,change.p??original.p,
        "x",change.rotation??original.rotation);
      current.change=change;
      preview(g,change);
    }catch{/* Invalid geometry is ignored until pointer returns inside range. */}
  };
  const end=(ev:PointerEvent)=>{
    if(!current||ev.pointerId!==current.id)return;
    const change=current.change;
    current=null;
    mount.classList.remove("bwjm-parabola-dragging");
    if(mount.hasPointerCapture(ev.pointerId))mount.releasePointerCapture(ev.pointerId);
    if(ev.type==="pointerup"&&change)persist(change);
    else preview(original,{});
  };
  const keyboard=(ev:KeyboardEvent)=>{
    if(!(ev.target instanceof Element))return;
    const handle=ev.target.getAttribute("data-handle") as ParabolaHandle|null;
    const vectors:Record<string,ParabolaPoint>={
      ArrowUp:[0,.1],ArrowDown:[0,-.1],ArrowLeft:[-.1,0],ArrowRight:[.1,0],
    };
    const shift=vectors[ev.key];
    if(!handle||!shift)return;
    ev.preventDefault();
    const basis:Record<ParabolaHandle,ParabolaPoint>={
      vertex:original.vertex,focus:original.focus,
      directrix:parabolaPoint(original,-original.p,0),
      latus1:original.latusEndpoints[0],latus2:original.latusEndpoints[1],
      tangent:parabolaParametricPoint(original,node.tangentParameter??0),
    };
    const factor=ev.shiftKey?10:1,start=basis[handle];
    const target:ParabolaPoint=[start[0]+factor*shift[0],start[1]+factor*shift[1]];
    const change=parabolaDragChange(handle,original,target,start);
    if(!change)return;
    try{
      const g=parabolaFromVertex(change.vertex??original.vertex,change.p??original.p,
        "x",change.rotation??original.rotation);
      preview(g,change);persist(change);
    }catch{/* Invalid keyboard move. */}
  };
  mount.addEventListener("pointerdown",begin);
  mount.addEventListener("pointermove",move);
  mount.addEventListener("pointerup",end);
  mount.addEventListener("pointercancel",end);
  mount.addEventListener("lostpointercapture",end);
  mount.addEventListener("keydown",keyboard);
  return ()=>{
    mount.removeEventListener("pointerdown",begin);
    mount.removeEventListener("pointermove",move);
    mount.removeEventListener("pointerup",end);
    mount.removeEventListener("pointercancel",end);
    mount.removeEventListener("lostpointercapture",end);
    mount.removeEventListener("keydown",keyboard);
  };
}
