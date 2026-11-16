import type { ConicNode } from "@mathmd/ast";
import { hyperbolaFromCenter,type HyperbolaGeometry } from "./hyperbolaGeometry.js";
import type { HyperbolaInteraction } from "./hyperbolaDrag.js";

/** Controls belong to this hyperbola block, not to a global document slider. */
export function mountHyperbolaControls(
  parent:HTMLElement,node:ConicNode,initial:HyperbolaGeometry,
  preview:(next:HyperbolaGeometry,change:HyperbolaInteraction)=>void,
  persist:(change:HyperbolaInteraction)=>void,
):void{
  if(node.showInteractiveControls!==true||node.mode!=="canonical")return;
  const container=document.createElement("details");
  container.className="bwjm-graph-settings";
  const summary=document.createElement("summary");
  summary.textContent="Mover, cambiar semiejes y rotar la hipérbola";
  container.appendChild(summary);
  const table=document.createElement("table");
  table.className="bwjm-graph-settings-table";
  const body=table.createTBody();
  const center:[number,number]=[...initial.center];
  let a=initial.a,b=initial.b,rotation=initial.rotation;
  const span=Math.max(5,initial.c*2.4);
  type Slider=[string,number,number,number,number,(v:number)=>void];
  const fields:Slider[]=[
    ["Centro X",center[0],Math.max(-10000,center[0]-span),
      Math.min(10000,center[0]+span),span/140,v=>{center[0]=v;}],
    ["Centro Y",center[1],Math.max(-10000,center[1]-span),
      Math.min(10000,center[1]+span),span/140,v=>{center[1]=v;}],
    ["Semieje a",a,Math.max(.001,a/5),Math.min(10000,a*2.5),
      a/140,v=>{a=v;}],
    ["Semieje b",b,Math.max(.001,b/5),Math.min(10000,b*2.5),
      b/140,v=>{b=v;}],
    ["Rotación (rad)",rotation,rotation-Math.PI,rotation+Math.PI,
      Math.PI/180,v=>{rotation=v;}],
  ];
  for(const [name,original,min,max,step,save] of fields){
    const row=body.insertRow(),label=row.insertCell(),value=row.insertCell();
    label.textContent=name;
    const input=document.createElement("input");
    input.type="range";input.min=String(min);input.max=String(max);
    input.step=String(Math.max(.000001,step));input.value=String(original);
    input.setAttribute("aria-label",name);
    const output=document.createElement("output");
    output.style.marginLeft=".5rem";
    output.textContent=String(Number(original.toPrecision(6)));
    input.oninput=()=>{
      const current=Number(input.value);
      save(current);
      output.textContent=String(Number(current.toPrecision(6)));
      try{
        const next=hyperbolaFromCenter(center,a,b,"x",rotation);
        preview(next,{center:[...center],a,b});
      }catch{/* The existing figure is retained for invalid slider positions. */}
    };
    input.onchange=()=>persist({center:[...center],a,b,
      ...(!Number.isNaN(rotation)?{rotation}:{} )});
    value.append(input,output);
  }
  container.appendChild(table);parent.appendChild(container);
}
