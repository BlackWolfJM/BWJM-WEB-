import React, { useEffect, useRef, useState } from "react";
import type { ConicNode } from "@mathmd/ast";
import { ellipseFromCenter, ellipseFromFoci, serializeEllipseBlock,
  type EllipseGeometry } from "./ellipseGeometry.js";
import { createEllipseSVG } from "./ellipseFigure.js";
import { buildEllipseReport } from "./ellipseReport.js";

type Definition = "canonical" | "foci";
interface Props { onInsert:(source:string)=>void; onClose:()=>void }
export function EllipseComposer({onInsert,onClose}:Props){
  const [mode,setMode]=useState<Definition>("canonical");
  const [h,setH]=useState("0"),[k,setK]=useState("0");
  const [a,setA]=useState("4"),[b,setB]=useState("2");
  const [axis,setAxis]=useState<"x"|"y">("x");
  const [rotation,setRotation]=useState("0");
  const [f1,setF1]=useState<[string,string]>(["-3","0"]);
  const [f2,setF2]=useState<[string,string]>(["3","0"]);
  const [sum,setSum]=useState("10");
  const [flags,setFlags]=useState({
    showCenter:true,showFocus:true,showVertices:true,showCoVertices:true,
    showAxes:true,showDirectrices:false,showLatusRectum:false,
    showTangent:false,showEquation:true,
  });
  const [tangentAngle,setTangentAngle]=useState("45");
  const [color,setColor]=useState("#2563eb");
  const previewRef=useRef<HTMLDivElement|null>(null);
  const reportRef=useRef<HTMLDivElement|null>(null);
  let geometry:EllipseGeometry|undefined;
  let error="";
  let fociInput: {focus1:[number,number];focus2:[number,number];sumDistances:number}|undefined;
  try{
    if(mode==="canonical"){
      const strings=[h,k,a,b,rotation];
      if(strings.some(value=>!value.trim()))throw new Error("Completa el centro, semiejes y rotación.");
      geometry=ellipseFromCenter([Number(h),Number(k)],Number(a),Number(b),axis,Number(rotation));
    }else{
      const all=[...f1,...f2,sum];
      if(all.some(value=>!value.trim()))throw new Error("Completa los focos y la suma de distancias.");
      fociInput={focus1:[Number(f1[0]),Number(f1[1])],
        focus2:[Number(f2[0]),Number(f2[1])],sumDistances:Number(sum)};
      geometry=ellipseFromFoci(fociInput.focus1,fociInput.focus2,fociInput.sumDistances);
    }
    if(!tangentAngle.trim()||!Number.isFinite(Number(tangentAngle))||
      Math.abs(Number(tangentAngle))>3600)
      throw new Error("El ángulo de tangencia debe ser finito y estar entre −3600° y 3600°.");
  }catch(e){error=e instanceof Error?e.message:String(e);}
  const options={...flags,tangentAngle:Number(tangentAngle),color};
  useEffect(()=>{
    if(!previewRef.current||!reportRef.current)return;
    previewRef.current.replaceChildren();
    reportRef.current.replaceChildren();
    if(!geometry||error)return;
    const node={type:"conic",conicType:"ellipse",mode,...options} as ConicNode;
    previewRef.current.appendChild(createEllipseSVG(node,geometry));
    reportRef.current.appendChild(buildEllipseReport(node,geometry));
  });
  const numeric=(label:string,value:string,change:(value:string)=>void)=>
    <label className="bwjm-modal-field">
      <span className="bwjm-modal-label">{label}</span>
      <input type="number" step="any" className="bwjm-modal-input"
        value={value} onChange={event=>change(event.target.value)}/>
    </label>;
  const focus=(label:string,value:[string,string],change:(v:[string,string])=>void)=>
    <fieldset className="bwjm-modal-field">
      <legend>{label}</legend>
      <div className="bwjm-range-fields">
        <input type="number" step="any" className="bwjm-modal-input" aria-label={label+" x"}
          value={value[0]} onChange={event=>change([event.target.value,value[1]])}/>
        <input type="number" step="any" className="bwjm-modal-input" aria-label={label+" y"}
          value={value[1]} onChange={event=>change([value[0],event.target.value])}/>
      </div>
    </fieldset>;
  const toggle=(name:keyof typeof flags,label:string)=>
    <label className="bwjm-ellipse-toggle">
      <input type="checkbox" checked={flags[name]}
        onChange={event=>setFlags(current=>({...current,[name]:event.target.checked}))}/>
      {label}
    </label>;
  const insert=()=>{
    if(error||!geometry)return;
    onInsert(serializeEllipseBlock(mode,geometry,options,fociInput));
    onClose();
  };
  return <section className="bwjm-ellipse-composer" aria-label="Constructor de elipse">
    <label className="bwjm-modal-field">
      <span className="bwjm-modal-label">Definir la elipse mediante</span>
      <select className="bwjm-modal-input" value={mode}
        onChange={event=>setMode(event.target.value as Definition)}>
        <option value="canonical">Centro, semiejes y orientación</option>
        <option value="foci">Dos focos y suma de distancias</option>
      </select>
    </label>
    {mode==="canonical"?<div className="bwjm-modal-grid">
      {numeric("Centro h",h,setH)}{numeric("Centro k",k,setK)}
      {numeric("Semieje mayor a",a,setA)}{numeric("Semieje menor b",b,setB)}
      <label className="bwjm-modal-field">
        <span className="bwjm-modal-label">Eje principal</span>
        <select className="bwjm-modal-input" value={axis}
          onChange={event=>setAxis(event.target.value as "x"|"y")}>
          <option value="x">Horizontal</option><option value="y">Vertical</option>
        </select>
      </label>
      {numeric("Rotación adicional (radianes)",rotation,setRotation)}
    </div>:<div className="bwjm-modal-grid">
      {focus("Foco F₁",f1,setF1)}
      {focus("Foco F₂",f2,setF2)}
      {numeric("Suma de distancias (2a)",sum,setSum)}
    </div>}
    <fieldset className="bwjm-chart-coefficients">
      <legend>Elementos geométricos visibles</legend>
      <div className="bwjm-modal-grid bwjm-ellipse-options">
        {toggle("showCenter","Centro")}
        {toggle("showFocus","Focos")}
        {toggle("showVertices","Vértices")}
        {toggle("showCoVertices","Co-vértices")}
        {toggle("showAxes","Ejes mayor y menor")}
        {toggle("showDirectrices","Directrices")}
        {toggle("showLatusRectum","Lados rectos")}
        {toggle("showTangent","Tangente")}
        {toggle("showEquation","Mostrar ecuación")}
      </div>
    </fieldset>
    {flags.showTangent&&numeric("Ángulo del punto de tangencia (°)",tangentAngle,setTangentAngle)}
    <label className="bwjm-modal-field">
      <span className="bwjm-modal-label">Color de la elipse</span>
      <input type="color" value={color} onChange={event=>setColor(event.target.value)}/>
    </label>
    <div ref={previewRef} aria-label="Vista previa de la elipse"/>
    <div ref={reportRef} className="bwjm-ellipse-preview-report"
      aria-label="Vista previa de las propiedades de la elipse"/>
    {error&&<p className="bwjm-calculus-error" role="alert">{error}</p>}
    <details className="bwjm-chart-source"><summary>Ver código .bwjm</summary>
      <pre className="bwjm-code-preview"><code>{geometry&&!error?
        serializeEllipseBlock(mode,geometry,options,fociInput):"Revisa los parámetros."}</code></pre>
    </details>
    <div className="bwjm-modal-footer">
      <button type="button" className="bwjm-btn-secondary" onClick={onClose}>Cancelar</button>
      <button type="button" className="bwjm-btn-primary" disabled={Boolean(error)||!geometry}
        onClick={insert}>Insertar elipse</button>
    </div>
  </section>;
}
