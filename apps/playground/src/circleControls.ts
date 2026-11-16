import type { ConicNode } from "@mathmd/ast";
import { circleFromCenterRadius, type CircleGeometry } from "./circleGeometry.js";

/** Per-figure controls, with preview and explicit document persistence on release. */
export function mountCircleControls(
  parent:HTMLElement,node:ConicNode,initial:CircleGeometry,
  preview:(geometry:CircleGeometry)=>void,
  persist:(center:readonly [number,number],radius:number)=>void,
):void {
  if(node.showInteractiveControls!==true || !["center-radius","canonical"].includes(node.mode??"center-radius"))
    return;
  const details=document.createElement("details");
  details.className="bwjm-graph-settings";
  const summary=document.createElement("summary");
  summary.textContent="Trasladar y cambiar radio";
  details.appendChild(summary);
  const table=document.createElement("table");
  table.className="bwjm-graph-settings-table";
  const tbody=table.createTBody();
  const center:[number,number]=[...initial.center];
  let radius=initial.radius;
  const span=Math.max(5,radius*3);
  const rows:Array<[string,number,number,number,number,(n:number)=>void]>=[
    ["Centro X",center[0],center[0]-span,center[0]+span,span/150,v=>{center[0]=v;}],
    ["Centro Y",center[1],center[1]-span,center[1]+span,span/150,v=>{center[1]=v;}],
    ["Radio",radius,Math.max(0.001,radius/5),Math.max(radius*3,radius+1),radius/120,v=>{radius=v;}],
  ];
  for(const [label,initialValue,min,max,step,assign] of rows){
    const tr=tbody.insertRow();
    const name=tr.insertCell();name.textContent=label;
    const content=tr.insertCell();
    const input=document.createElement("input");
    input.type="range";input.min=String(min);input.max=String(max);
    input.step=String(Math.max(0.000001,step));input.value=String(initialValue);
    input.setAttribute("aria-label",label);
    const value=document.createElement("output");
    value.style.marginLeft="0.5rem";
    value.textContent=String(Number(initialValue.toPrecision(6)));
    input.oninput=()=>{
      const n=Number(input.value);
      assign(n);
      value.textContent=String(Number(n.toPrecision(6)));
      preview(circleFromCenterRadius(center,radius));
    };
    input.onchange=()=>persist(center,radius);
    content.append(input,value);
  }
  details.appendChild(table);
  parent.appendChild(details);
}
