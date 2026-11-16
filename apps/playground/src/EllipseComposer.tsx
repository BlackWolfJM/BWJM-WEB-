import React, { useEffect, useRef, useState } from "react";
import type { ConicNode } from "@mathmd/ast";
import { ellipseFromCenter, ellipseFromFoci, serializeEllipseBlock,
  type EllipseGeometry } from "./ellipseGeometry.js";
import { createEllipseSVG } from "./ellipseFigure.js";
import { buildEllipseReport } from "./ellipseReport.js";
import { coefficientsFromEllipse, ellipseFromGeneral, parseEllipseEquation,
  type EllipseCoefficients } from "./ellipseEquation.js";
import { mountEllipseDrag, type EllipseInteraction } from "./ellipseDrag.js";

type Definition = "canonical" | "foci" | "general";
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
  const [generalEquation,setGeneralEquation]=useState("x^2/25+y^2/16=1");
  const [flags,setFlags]=useState({
    showCenter:true,showFocus:true,showVertices:true,showCoVertices:true,
    showAxes:true,showDirectrices:false,showLatusRectum:false,
    showTangent:false,showNormal:false,showIntersections:true,showParametric:true,
    showEquation:true,showInteractiveControls:true,
  });
  const [tangentAngle,setTangentAngle]=useState("45");
  const [color,setColor]=useState("#2563eb");
  const previewRef=useRef<HTMLDivElement|null>(null);
  const reportRef=useRef<HTMLDivElement|null>(null);
  let geometry:EllipseGeometry|undefined;
  let error="";
  let fociInput: {focus1:[number,number];focus2:[number,number];sumDistances:number}|undefined;
  let generalInput:EllipseCoefficients|undefined;
  try{
    if(mode==="canonical"){
      const strings=[h,k,a,b,rotation];
      if(strings.some(value=>!value.trim()))throw new Error("Completa el centro, semiejes y rotación.");
      geometry=ellipseFromCenter([Number(h),Number(k)],Number(a),Number(b),axis,Number(rotation));
    }else if(mode==="general"){
      if(!generalEquation.trim())throw new Error("Introduce la ecuación general de la elipse.");
      generalInput=parseEllipseEquation(generalEquation);
      const shape=ellipseFromGeneral(generalInput);
      geometry=ellipseFromCenter(shape.center,shape.a,shape.b,"x",shape.rotation);
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
    const figureHost=previewRef.current,reportHost=reportRef.current;
    if(!figureHost||!reportHost)return;
    figureHost.replaceChildren();
    reportHost.replaceChildren();
    if(!geometry||error)return;
    const original=geometry;
    const node={type:"conic",conicType:"ellipse",mode,...options} as ConicNode;
    const preview=(next:EllipseGeometry,change:EllipseInteraction={})=>{
      const viewNode={...node,viewCenter:node.viewCenter??original.center,
        viewSpan:node.viewSpan??Math.max(4,original.a*1.7,original.b*2,
          node.showDirectrices&&original.directrixOffset!==undefined&&
          original.directrixOffset<=original.a*4?original.directrixOffset*1.15:0),
        tangentAngle:change.tangentAngle??node.tangentAngle};
      figureHost.replaceChildren(createEllipseSVG(viewNode,next));
      reportHost.replaceChildren(buildEllipseReport(viewNode,next));
    };
    preview(original);
    return mountEllipseDrag(figureHost,node,original,preview,change=>{
      if(change.tangentAngle!==undefined)setTangentAngle(String(change.tangentAngle));
      if(change.center||change.a!==undefined||change.b!==undefined){
        const next=ellipseFromCenter(change.center??original.center,change.a??original.a,
          change.b??original.b,"x",original.rotation);
        if(mode==="canonical"){
          setH(String(next.center[0]));setK(String(next.center[1]));
          setA(String(next.a));setB(String(next.b));
        }else if(mode==="foci"){
          setF1(next.focus1.map(String) as [string,string]);
          setF2(next.focus2.map(String) as [string,string]);
          setSum(String(2*next.a));
        }else{
          const previous=generalInput??coefficientsFromEllipse(original.center,
            original.a,original.b,original.rotation);
          const baseline=coefficientsFromEllipse(original.center,original.a,original.b,original.rotation);
          const ratio=previous.A/baseline.A;
          const newer=coefficientsFromEllipse(next.center,next.a,next.b,next.rotation);
          const expression=["A","B","C","D","E","F"].map(key=>
            String(newer[key as keyof EllipseCoefficients]*ratio));
          const [A,B,C,D,E,F]=expression;
          setGeneralEquation(A+"*x^2+"+B+"*x*y+"+C+"*y^2+"+D+"*x+"+E+"*y+"+F+"=0");
        }
      }
    });
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
    onInsert(serializeEllipseBlock(mode,geometry,options,fociInput,generalInput));
    onClose();
  };
  return <section className="bwjm-ellipse-composer" aria-label="Constructor de elipse">
    <label className="bwjm-modal-field">
      <span className="bwjm-modal-label">Definir la elipse mediante</span>
      <select className="bwjm-modal-input" value={mode}
        onChange={event=>setMode(event.target.value as Definition)}>
        <option value="canonical">Centro, semiejes y orientación</option>
        <option value="foci">Dos focos y suma de distancias</option>
        <option value="general">Ecuación general con término Bxy</option>
      </select>
    </label>
    {mode==="general"?<label className="bwjm-modal-field">
      <span className="bwjm-modal-label">Ax² + Bxy + Cy² + Dx + Ey + F = 0</span>
      <input className="bwjm-modal-input" value={generalEquation}
        aria-label="Ecuación general de la elipse"
        onChange={event=>setGeneralEquation(event.target.value)}/>
      <small>Admite rotación y coeficientes decimales; usa * para multiplicar, por ejemplo 2*x*y.</small>
    </label>:mode==="canonical"?<div className="bwjm-modal-grid">
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
        {toggle("showNormal","Normal")}
        {toggle("showIntersections","Cortes con los ejes")}
        {toggle("showParametric","Parametrización")}
        {toggle("showEquation","Mostrar ecuación")}
        {toggle("showInteractiveControls","Arrastrar centro y puntos geométricos")}
      </div>
    </fieldset>
    {(flags.showTangent||flags.showNormal)&&numeric("Ángulo del punto seleccionado (°)",
      tangentAngle,setTangentAngle)}
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
        serializeEllipseBlock(mode,geometry,options,fociInput,generalInput):"Revisa los parámetros."}</code></pre>
    </details>
    <div className="bwjm-modal-footer">
      <button type="button" className="bwjm-btn-secondary" onClick={onClose}>Cancelar</button>
      <button type="button" className="bwjm-btn-primary" disabled={Boolean(error)||!geometry}
        onClick={insert}>Insertar elipse</button>
    </div>
  </section>;
}
