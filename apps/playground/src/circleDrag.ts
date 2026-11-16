import type { ConicNode } from "@mathmd/ast";
import { circleFromCenterRadius, type CircleGeometry } from "./circleGeometry.js";
import { angleAtCircle, type CircleAngleKey, type CirclePoint } from "./circleConstructions.js";
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
):void {
  if(node.showInteractiveControls!==true)return;
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
  mount.addEventListener("pointerdown",down);
  mount.addEventListener("pointermove",move);
  mount.addEventListener("pointerup",end);
  mount.addEventListener("pointercancel",end);
  mount.addEventListener("lostpointercapture",end);
  // Mount is owned by the current document card, so listeners disappear when card is recreated.
}
