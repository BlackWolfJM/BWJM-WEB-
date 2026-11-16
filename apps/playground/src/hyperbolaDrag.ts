import type { ConicNode } from "@mathmd/ast";
import {
  hyperbolaFromCenter,hyperbolaParametricPoint,type HyperbolaGeometry,
  type HyperbolaPoint,type HyperbolaBranch,
} from "./hyperbolaGeometry.js";
import { hyperbolaWorldFromSVG } from "./hyperbolaFigure.js";

export type HyperbolaHandle="center"|"vertex1"|"vertex2"|
  "focus1"|"focus2"|"coVertex1"|"coVertex2"|"tangentParameter";
export interface HyperbolaInteraction {
  center?:HyperbolaPoint;
  a?:number;
  b?:number;
  rotation?:number;
  tangentParameter?:number;
}
const worldLocal=(g:HyperbolaGeometry,target:HyperbolaPoint):HyperbolaPoint=>{
  const [x,y]=[target[0]-g.center[0],target[1]-g.center[1]];
  const cos=Math.cos(g.rotation),sin=Math.sin(g.rotation);
  return [x*cos+y*sin,-x*sin+y*cos];
};
/** Handles project onto relevant conic axes; invalid geometry is never committed. */
export function hyperbolaDragChange(
  handle:HyperbolaHandle,g:HyperbolaGeometry,target:HyperbolaPoint,
  start?:HyperbolaPoint,
):HyperbolaInteraction|null{
  if(!target.every(Number.isFinite))return null;
  if(handle==="center"){
    if(!start)return null;
    const moved:HyperbolaPoint=[
      g.center[0]+target[0]-start[0],g.center[1]+target[1]-start[1],
    ];
    return moved.every(n=>Math.abs(n)<=10000)?{center:moved}:null;
  }
  const [u,v]=worldLocal(g,target);
  if(handle==="tangentParameter"){
    const t=Math.asinh(v/g.b);
    return Number.isFinite(t)&&Math.abs(t)<=10?{tangentParameter:t}:null;
  }
  if(handle==="vertex1"||handle==="vertex2"){
    const major=Math.abs(u);
    return major>.001&&major<=10000?{a:major}:null;
  }
  if(handle==="coVertex1"||handle==="coVertex2"){
    const minor=Math.abs(v);
    return minor>.001&&minor<=10000?{b:minor}:null;
  }
  if(handle==="focus1"||handle==="focus2"){
    const c=Math.abs(u);
    if(c<=g.a)return null;
    const minor=Math.sqrt((c-g.a)*(c+g.a));
    return minor>.001&&minor<=10000?{b:minor}:null;
  }
  return null;
}
export function mountHyperbolaDrag(
  mount:HTMLElement,node:ConicNode,original:HyperbolaGeometry,
  preview:(next:HyperbolaGeometry,change:HyperbolaInteraction)=>void,
  persist:(change:HyperbolaInteraction)=>void,
):()=>void{
  if(node.showInteractiveControls!==true)return ()=>{};
  const stable:ConicNode={...node,
    viewCenter:node.viewCenter??original.center,
    viewSpan:node.viewSpan??Math.max(4,original.c*1.7,original.b*2.1),
  };
  let active:{id:number;handle:HyperbolaHandle;start:HyperbolaPoint;
    matrix:DOMMatrix;change:HyperbolaInteraction|null}|null=null;
  const fromEvent=(ev:PointerEvent,matrix:DOMMatrix):HyperbolaPoint=>{
    const svg=new DOMPoint(ev.clientX,ev.clientY).matrixTransform(matrix);
    return hyperbolaWorldFromSVG(stable,original,svg.x,svg.y);
  };
  const begin=(ev:PointerEvent)=>{
    if(ev.button!==0||active||!(ev.target instanceof Element))return;
    const handle=ev.target.closest("[data-handle]")?.getAttribute("data-handle") as HyperbolaHandle|null;
    const svg=ev.target.closest("svg") as SVGSVGElement|null;
    const inverse=svg?.getScreenCTM()?.inverse();
    if(!handle||!inverse||![
      "center","vertex1","vertex2","focus1","focus2","coVertex1",
      "coVertex2","tangentParameter",
    ].includes(handle))return;
    ev.preventDefault();
    active={id:ev.pointerId,handle,start:fromEvent(ev,inverse),
      matrix:inverse,change:null};
    mount.setPointerCapture(ev.pointerId);
    mount.classList.add("bwjm-hyperbola-dragging");
  };
  const move=(ev:PointerEvent)=>{
    if(!active||ev.pointerId!==active.id)return;
    const change=hyperbolaDragChange(active.handle,original,fromEvent(ev,active.matrix),
      active.start);
    if(!change)return;
    try{
      const geo=hyperbolaFromCenter(change.center??original.center,change.a??original.a,
        change.b??original.b,"x",original.rotation);
      active.change=change;preview(geo,change);
    }catch{/* Discard invalid drags without modifying the document. */}
  };
  const end=(ev:PointerEvent)=>{
    if(!active||ev.pointerId!==active.id)return;
    const change=active.change;active=null;
    mount.classList.remove("bwjm-hyperbola-dragging");
    if(mount.hasPointerCapture(ev.pointerId))mount.releasePointerCapture(ev.pointerId);
    if(ev.type==="pointerup"&&change)persist(change);
    else preview(original,{});
  };
  const keyboard=(ev:KeyboardEvent)=>{
    if(!(ev.target instanceof Element))return;
    const handle=ev.target.getAttribute("data-handle") as HyperbolaHandle|null;
    const axes:Record<string,HyperbolaPoint>={
      ArrowUp:[0,.1],ArrowDown:[0,-.1],ArrowLeft:[-.1,0],ArrowRight:[.1,0],
    };
    const delta=axes[ev.key];
    if(!handle||!delta)return;
    ev.preventDefault();
    const tangent=hyperbolaParametricPoint(original,node.tangentParameter??0,
      (node.hyperbolaBranch??1) as HyperbolaBranch);
    const bases:Record<HyperbolaHandle,HyperbolaPoint>={
      center:original.center,vertex1:original.vertices[0],vertex2:original.vertices[1],
      focus1:original.focus1,focus2:original.focus2,
      coVertex1:original.conjugateVertices[0],coVertex2:original.conjugateVertices[1],
      tangentParameter:tangent,
    };
    const factor=ev.shiftKey?10:1,from=bases[handle];
    const target:HyperbolaPoint=[
      from[0]+factor*delta[0],from[1]+factor*delta[1],
    ];
    const change=hyperbolaDragChange(handle,original,target,from);
    if(!change)return;
    try{
      const next=hyperbolaFromCenter(change.center??original.center,change.a??original.a,
        change.b??original.b,"x",original.rotation);
      preview(next,change);persist(change);
    }catch{/* Respect geometry bounds for keyboard input. */}
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
