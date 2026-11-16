import type { ConicNode } from "@mathmd/ast";
import { circleFromCenterRadius, type CircleGeometry } from "./circleGeometry.js";
import { angleAtCircle, circlePointAt, type CircleAngleKey, type CirclePoint } from "./circleConstructions.js";
import { circleWorldAtSVG } from "./circleFigure.js";

export interface CircleInteraction {
  center?:CirclePoint;
  radius?:number;
  angles?:Partial<Record<CircleAngleKey,number>>;
  tangentPoint?:CirclePoint;
}
export type CircleHandle = "center"|"tangentPoint"|CircleAngleKey;
const angleKeys:ReadonlySet<string>=new Set([
  "radiusAngle","diameterAngle","chordStartAngle","chordEndAngle",
  "secantStartAngle","secantEndAngle","tangentAngle",
]);

/** Calculate an interaction from world coordinates; all state remains local until release. */
export function circleDragChange(
  handle:CircleHandle,
  original:CircleGeometry,
  target:CirclePoint,
  start?:CirclePoint,
):CircleInteraction|null {
  if(!target.every(Number.isFinite))return null;
  const center=original.center;
  if(handle==="center"){
    if(!start)return null;
    const next:CirclePoint=[center[0]+target[0]-start[0],center[1]+target[1]-start[1]];
    if(next.some(v=>Math.abs(v)>10000))return null;
    return {center:next};
  }
  if(handle==="tangentPoint")return {tangentPoint:target};
  if(handle==="radiusAngle"){
    const radius=Math.hypot(target[0]-center[0],target[1]-center[1]);
    if(radius<=.001||radius>10000)return null;
    return {radius,angles:{radiusAngle:angleAtCircle(center,target)}};
  }
  if(!angleKeys.has(handle))return null;
  const angle=angleAtCircle(center,target);
  if(!Number.isFinite(angle))return null;
  return {angles:{[handle]:angle}};
}

/** Stable wrapper receives events even when its SVG child is re-rendered during dragging. */
export function mountCircleDrag(
  mount:HTMLElement,node:ConicNode,original:CircleGeometry,
  preview:(geometry:CircleGeometry,change:CircleInteraction)=>void,
  persist:(change:CircleInteraction)=>void,
):()=>void {
  if(node.showInteractiveControls!==true)return ()=>{};
  let current:{
    pointer:number;handle:CircleHandle;start:CirclePoint;
    matrix:DOMMatrix;change:CircleInteraction|null;
  }|null=null;
  const viewNode:ConicNode={
    ...node,viewCenter:node.viewCenter??original.center,
    viewSpan:node.viewSpan??Math.max(3,original.radius*1.55),
  };
  const toWorld=(event:PointerEvent,matrix:DOMMatrix):CirclePoint=>{
    const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix);
    return circleWorldAtSVG(viewNode,original,point.x,point.y);
  };
  const down=(event:PointerEvent)=>{
    if(event.button!==0||current)return;
    const target=event.target;
    if(!(target instanceof Element))return;
    const button=target.closest("[data-handle]");
    const handle=button?.getAttribute("data-handle") as CircleHandle|null;
    const svg=button?.closest("svg");
    const inverse=svg?.getScreenCTM()?.inverse();
    if(!handle||!inverse||!(handle==="center"||handle==="tangentPoint"||angleKeys.has(handle)))
      return;
    event.preventDefault();
    current={pointer:event.pointerId,handle,start:toWorld(event,inverse),
      matrix:inverse,change:null};
    mount.setPointerCapture(event.pointerId);
    mount.classList.add("bwjm-circle-dragging");
  };
  const move=(event:PointerEvent)=>{
    if(!current||current.pointer!==event.pointerId)return;
    const world=toWorld(event,current.matrix);
    const change=circleDragChange(current.handle,original,world,current.start);
    if(!change)return;
    const center=change.center??original.center;
    const radius=change.radius??original.radius;
    if(change.tangentPoint&&node.tangentMode==="point"&&node.showTangent){
      // A point strictly inside the circle has no real tangent.
      if(Math.hypot(change.tangentPoint[0]-center[0],change.tangentPoint[1]-center[1])
         <radius-1e-9*Math.max(1,radius))return;
    }
    let next:CircleGeometry;
    try{next=circleFromCenterRadius(center,radius);}catch{return;}
    current.change=change;
    preview(next,change);
  };
  const end=(event:PointerEvent)=>{
    if(!current||current.pointer!==event.pointerId)return;
    const change=current.change;
    current=null;
    mount.classList.remove("bwjm-circle-dragging");
    if(mount.hasPointerCapture(event.pointerId))mount.releasePointerCapture(event.pointerId);
    if(event.type==="pointerup"&&change)persist(change);
    else preview(original,{});
  };
  const keyboard=(event:KeyboardEvent)=>{
    const deltas:Record<string,CirclePoint>={
      ArrowUp:[0,.1],ArrowDown:[0,-.1],ArrowLeft:[-.1,0],ArrowRight:[.1,0],
    };
    const displacement=deltas[event.key];
    if(!displacement)return;
    const target=event.target;
    if(!(target instanceof Element))return;
    const handle=target.getAttribute("data-handle") as CircleHandle|null;
    if(!handle)return;
    event.preventDefault();
    const factor=event.shiftKey?10:1;
    const direction:CirclePoint=[
      displacement[0]*factor,displacement[1]*factor,
    ];
    let initial:CirclePoint=original.center;
    if(handle==="tangentPoint")initial=node.tangentPoint??original.center;
    else if(handle!=="center"){
      const value=(node as unknown as Record<string,unknown>)[handle];
      initial=circlePointAt(original,typeof value==="number"?value:
        handle==="radiusAngle"?30:handle==="diameterAngle"?0:
        handle==="chordStartAngle"?35:handle==="chordEndAngle"?140:
        handle==="secantStartAngle"?220:handle==="secantEndAngle"?300:60);
    }
    const next:CirclePoint=[
      initial[0]+direction[0],initial[1]+direction[1],
    ];
    const change=circleDragChange(handle,original,next,initial);
    if(!change)return;
    const center=change.center??original.center;
    const radius=change.radius??original.radius;
    if(change.tangentPoint&&node.tangentMode==="point"&&
      Math.hypot(change.tangentPoint[0]-center[0],change.tangentPoint[1]-center[1])
        <radius-1e-9*Math.max(1,radius))return;
    try{preview(circleFromCenterRadius(center,radius),change);}catch{return;}
    persist(change);
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
