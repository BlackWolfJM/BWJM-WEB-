import type { ConicNode } from "@mathmd/ast";
import { parabolaFromVertex, type ParabolaGeometry } from "./parabolaGeometry.js";
import type { ParabolaInteraction } from "./parabolaDrag.js";

/** Per-figure sliders; never create document-global variables or new graphs. */
export function mountParabolaControls(
  parent:HTMLElement,node:ConicNode,original:ParabolaGeometry,
  preview:(next:ParabolaGeometry,change:ParabolaInteraction)=>void,
  persist:(change:ParabolaInteraction)=>void,
):void{
  if(node.showInteractiveControls!==true||node.mode!=="canonical")return;
  const container=document.createElement("details");
  container.className="bwjm-graph-settings";
  const header=document.createElement("summary");
  header.textContent="Trasladar, abrir y rotar la parábola";
  container.appendChild(header);
  const table=document.createElement("table");
  table.className="bwjm-graph-settings-table";
  const body=table.createTBody();
  let vertex:[number,number]=[...original.vertex],p=original.p,rotation=original.rotation;
  const magnitude=Math.max(4,Math.abs(p)*3);
  type Slider=[string,number,number,number,number,(n:number)=>void];
  const options:Slider[]=[
    ["Vértice X",vertex[0],Math.max(-10000,vertex[0]-magnitude),
      Math.min(10000,vertex[0]+magnitude),magnitude/150,n=>{vertex[0]=n;}],
    ["Vértice Y",vertex[1],Math.max(-10000,vertex[1]-magnitude),
      Math.min(10000,vertex[1]+magnitude),magnitude/150,n=>{vertex[1]=n;}],
    ["Parámetro focal p",p,p>0?Math.max(.001,p/5):Math.max(-10000,p*2.5),
      p>0?Math.min(10000,p*2.5):Math.min(-.001,p/5),Math.abs(p)/150,n=>{p=n;}],
    ["Rotación (rad)",rotation,rotation-Math.PI,rotation+Math.PI,
      Math.PI/180,n=>{rotation=n;}],
  ];
  for(const [name,initial,min,max,step,update] of options){
    const row=body.insertRow(),label=row.insertCell(),cell=row.insertCell();
    label.textContent=name;
    const control=document.createElement("input");
    control.type="range";control.min=String(min);control.max=String(max);
    control.step=String(Math.max(1e-7,step));control.value=String(initial);
    control.setAttribute("aria-label",name);
    const output=document.createElement("output");
    output.style.marginLeft=".5rem";
    output.textContent=String(Number(initial.toPrecision(6)));
    control.oninput=()=>{
      const next=Number(control.value);
      update(next);
      output.textContent=String(Number(next.toPrecision(6)));
      try{
        preview(parabolaFromVertex(vertex,p,"x",rotation),{
          vertex:[...vertex],p,rotation,
        });
      }catch{/* Slider prevents invalid sign/range changes. */}
    };
    control.onchange=()=>persist({vertex:[...vertex],p,rotation});
    cell.append(control,output);
  }
  container.appendChild(table);parent.appendChild(container);
}
