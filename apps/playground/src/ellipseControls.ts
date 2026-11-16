import type { ConicNode } from "@mathmd/ast";
import { ellipseFromCenter, type EllipseGeometry } from "./ellipseGeometry.js";

/** Local controls are tied to one ellipse, not to global document sliders. */
export function mountEllipseControls(
  parent:HTMLElement,node:ConicNode,initial:EllipseGeometry,
  preview:(geometry:EllipseGeometry)=>void,
  persist:(center:readonly[number,number],a:number,b:number)=>void,
):void {
  if(node.showInteractiveControls!==true ||
    (node.mode!=="canonical" && node.mode!=="center-axes"))return;
  const details=document.createElement("details");
  details.className="bwjm-graph-settings";
  const summary=document.createElement("summary");
  summary.textContent="Trasladar y modificar semiejes";
  details.appendChild(summary);
  const table=document.createElement("table");
  table.className="bwjm-graph-settings-table";
  const tbody=table.createTBody();
  const center:[number,number]=[...initial.center];
  let a=initial.a,b=initial.b;
  const span=Math.max(5,a*3);
  const rows:Array<[string,number,number,number,number,(n:number)=>void]>=[
    ["Centro X",center[0],center[0]-span,center[0]+span,span/150,v=>{center[0]=v;}],
    ["Centro Y",center[1],center[1]-span,center[1]+span,span/150,v=>{center[1]=v;}],
    ["Semieje mayor a",a,b,Math.max(a*2.5,b+1),a/140,v=>{a=v;}],
    ["Semieje menor b",b,Math.max(.001,b/5),a,b/140,v=>{b=v;}],
  ];
  for(const [label,original,min,max,step,assign] of rows){
    const tr=tbody.insertRow();
    const name=tr.insertCell();name.textContent=label;
    const cell=tr.insertCell();
    const input=document.createElement("input");
    input.type="range";input.min=String(min);input.max=String(max);
    input.step=String(Math.max(.000001,step));input.value=String(original);
    input.setAttribute("aria-label",label);
    const output=document.createElement("output");
    output.style.marginLeft="0.5rem";
    output.textContent=String(Number(original.toPrecision(6)));
    input.oninput=()=>{
      const value=Number(input.value);
      assign(value);
      if(b>a)b=a;
      output.textContent=String(Number(value.toPrecision(6)));
      preview(ellipseFromCenter(center,a,b,node.axis??"x",node.rotation??0));
    };
    input.onchange=()=>persist(center,a,b);
    cell.append(input,output);
  }
  details.appendChild(table);parent.appendChild(details);
}
