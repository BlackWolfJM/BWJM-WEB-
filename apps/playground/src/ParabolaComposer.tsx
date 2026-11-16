import React, { useEffect, useRef, useState } from "react";
import type { ConicNode } from "@mathmd/ast";
import { coefficientsFromParabola, parabolaFromFocusDirectrix,
  parabolaFromGeneral, parabolaFromVertex, parseParabolaEquation,
  serializeParabolaBlock, type ParabolaCoefficients, type ParabolaGeometry,
} from "./parabolaGeometry.js";
import { createParabolaSVG } from "./parabolaFigure.js";
import { buildParabolaReport } from "./parabolaReport.js";
import { mountParabolaDrag, type ParabolaInteraction } from "./parabolaDrag.js";

type Definition="canonical"|"focus-directrix"|"general";
interface Props { onInsert:(source:string)=>void;onClose:()=>void }
const format=(n:number)=>Number(n.toFixed(9)).toLocaleString("en-US",{
  useGrouping:false,maximumFractionDigits:9,
});
const coefficientsText=(coefficients:ParabolaCoefficients):string=>{
  const {A,B,C,D,E,F}=coefficients;
  return "("+format(A)+")*x^2+("+format(B)+")*x*y+("+format(C)+
    ")*y^2+("+format(D)+")*x+("+format(E)+")*y+("+format(F)+")=0";
};
export function ParabolaComposer({onInsert,onClose}:Props){
  const [mode,setMode]=useState<Definition>("canonical");
  const [h,setH]=useState("0"),[k,setK]=useState("0"),[p,setP]=useState("1");
  const [axis,setAxis]=useState<"x"|"y">("x"),[rotation,setRotation]=useState("0");
  const [focus,setFocus]=useState<[string,string]>(["1","0"]);
  const [directrix,setDirectrix]=useState<[string,string,string]>(["1","0","1"]);
  const [general,setGeneral]=useState("y^2-4*x=0");
  const [tangentParameter,setTangentParameter]=useState("1");
  const [color,setColor]=useState("#2563eb");
  const [flags,setFlags]=useState({
    showVertices:true,showFocus:true,showDirectrix:true,showAxes:true,
    showLatusRectum:true,showTangent:false,showNormal:false,
    showIntersections:true,showParametric:true,showEquation:true,
    showInteractiveControls:true,
  });
  const figureRef=useRef<HTMLDivElement|null>(null);
  const reportRef=useRef<HTMLDivElement|null>(null);
  let geometry:ParabolaGeometry|undefined,error="";
  let coefficientInput:ParabolaCoefficients|undefined;
  let focusInput:[number,number]|undefined;
  let directrixInput:{A:number;B:number;C:number}|undefined;
  try{
    const t=Number(tangentParameter);
    if(!tangentParameter.trim()||!Number.isFinite(t)||Math.abs(t)>1000)
      throw new Error("El parámetro t debe ser finito y estar entre −1000 y 1000.");
    if(mode==="canonical"){
      if([h,k,p,rotation].some(value=>!value.trim()))
        throw new Error("Completa el vértice, parámetro p y rotación.");
      geometry=parabolaFromVertex([Number(h),Number(k)],Number(p),axis,Number(rotation));
    }else if(mode==="focus-directrix"){
      if([...focus,...directrix].some(value=>!value.trim()))
        throw new Error("Introduce las coordenadas del foco y los tres coeficientes de la directriz.");
      focusInput=[Number(focus[0]),Number(focus[1])];
      directrixInput={A:Number(directrix[0]),B:Number(directrix[1]),C:Number(directrix[2])};
      geometry=parabolaFromFocusDirectrix(focusInput,{
        a:directrixInput.A,b:directrixInput.B,c:directrixInput.C,
      });
    }else{
      if(!general.trim())throw new Error("Introduce la ecuación general de la parábola.");
      coefficientInput=parseParabolaEquation(general);
      geometry=parabolaFromGeneral(coefficientInput);
    }
  }catch(cause){error=cause instanceof Error?cause.message:String(cause);}
  const options={...flags,color,tangentParameter:Number(tangentParameter)};
  useEffect(()=>{
    const figure=figureRef.current,report=reportRef.current;
    if(!figure||!report)return;
    figure.replaceChildren();report.replaceChildren();
    if(!geometry||error)return;
    const original=geometry;
    const node={type:"conic",conicType:"parabola",mode,...options} as ConicNode;
    const viewNode:ConicNode={...node,viewCenter:original.vertex,
      viewSpan:Math.max(3,Math.abs(original.p)*5)};
    const preview=(next:ParabolaGeometry,change:ParabolaInteraction={})=>{
      const visual:ConicNode={...viewNode,
        tangentParameter:change.tangentParameter??node.tangentParameter};
      figure.replaceChildren(createParabolaSVG(visual,next));
      report.replaceChildren(buildParabolaReport(visual,next));
    };
    preview(original);
    return mountParabolaDrag(figure,viewNode,original,preview,change=>{
      if(change.tangentParameter!==undefined)
        setTangentParameter(String(change.tangentParameter));
      if(change.vertex||change.p!==undefined||change.rotation!==undefined){
        const rotated=change.rotation??original.rotation;
        const next=parabolaFromVertex(change.vertex??original.vertex,
          change.p??original.p,"x",rotated);
        if(mode==="canonical"){
          setH(String(next.vertex[0]));setK(String(next.vertex[1]));setP(String(next.p));
          setRotation(String(next.rotation-(axis==="y"?Math.PI/2:0)));
        }else if(mode==="focus-directrix"){
          const factor=Math.hypot(Number(directrix[0]),Number(directrix[1]))||1;
          setFocus(next.focus.map(String) as [string,string]);
          setDirectrix([
            String(next.directrix.a*factor),
            String(next.directrix.b*factor),
            String(next.directrix.c*factor),
          ]);
        }else{
          const previous=coefficientInput??coefficientsFromParabola(original.vertex,
            original.p,original.rotation);
          const factor=previous.A+previous.C;
          const coeffs=coefficientsFromParabola(next.vertex,next.p,next.rotation);
          setGeneral(coefficientsText(Object.fromEntries(
            Object.entries(coeffs).map(([key,value])=>[key,value*factor]),
          ) as unknown as ParabolaCoefficients));
        }
      }
    });
  });
  const numeric=(label:string,value:string,change:(value:string)=>void)=>
    <label className="bwjm-modal-field">
      <span className="bwjm-modal-label">{label}</span>
      <input className="bwjm-modal-input" type="number" step="any" value={value}
        onChange={event=>change(event.target.value)}/>
    </label>;
  const toggle=(name:keyof typeof flags,label:string)=>
    <label className="bwjm-parabola-toggle">
      <input type="checkbox" checked={flags[name]}
        onChange={event=>setFlags(current=>({...current,[name]:event.target.checked}))}/>
      {label}
    </label>;
  const source=geometry&&!error?serializeParabolaBlock(mode,geometry,options,{
    focus:focusInput,directrix:directrixInput,coefficients:coefficientInput,
  }):"Revisa los parámetros.";
  return <section className="bwjm-parabola-composer" aria-label="Constructor de parábola">
    <label className="bwjm-modal-field">
      <span className="bwjm-modal-label">Definir la parábola mediante</span>
      <select className="bwjm-modal-input" value={mode}
        onChange={event=>setMode(event.target.value as Definition)}>
        <option value="canonical">Vértice, parámetro focal y orientación</option>
        <option value="focus-directrix">Foco y recta directriz</option>
        <option value="general">Ecuación general (con Bxy y rotación)</option>
      </select>
    </label>
    {mode==="canonical"?<div className="bwjm-modal-grid">
      {numeric("Vértice h",h,setH)}
      {numeric("Vértice k",k,setK)}
      {numeric("Parámetro focal p (con signo)",p,setP)}
      <label className="bwjm-modal-field">
        <span className="bwjm-modal-label">Eje principal</span>
        <select className="bwjm-modal-input" value={axis}
          onChange={event=>setAxis(event.target.value as "x"|"y")}>
          <option value="x">Horizontal</option><option value="y">Vertical</option>
        </select>
      </label>
      {numeric("Rotación adicional (radianes)",rotation,setRotation)}
    </div>:mode==="focus-directrix"?<div className="bwjm-modal-grid">
      {numeric("Foco · x",focus[0],value=>setFocus(current=>[value,current[1]]))}
      {numeric("Foco · y",focus[1],value=>setFocus(current=>[current[0],value]))}
      {numeric("Directriz · A",directrix[0],value=>setDirectrix(current=>
        [value,current[1],current[2]]))}
      {numeric("Directriz · B",directrix[1],value=>setDirectrix(current=>
        [current[0],value,current[2]]))}
      {numeric("Directriz · C",directrix[2],value=>setDirectrix(current=>
        [current[0],current[1],value]))}
      <p className="bwjm-parabola-note">Directriz: Ax + By + C = 0. El foco debe estar fuera de ella.</p>
    </div>:<label className="bwjm-modal-field">
      <span className="bwjm-modal-label">Ax² + Bxy + Cy² + Dx + Ey + F = 0</span>
      <input className="bwjm-modal-input" value={general}
        aria-label="Ecuación general de la parábola"
        onChange={event=>setGeneral(event.target.value)}/>
      <small>Usa ^2 para cuadrados y * para productos, por ejemplo x^2+2*x*y+y^2-4*x=0.</small>
    </label>}
    <fieldset className="bwjm-chart-coefficients">
      <legend>Elementos científicos visibles</legend>
      <div className="bwjm-modal-grid bwjm-parabola-options">
        {toggle("showVertices","Vértice")}
        {toggle("showFocus","Foco")}
        {toggle("showDirectrix","Directriz")}
        {toggle("showAxes","Eje y sentido de apertura")}
        {toggle("showLatusRectum","Lado recto y extremos")}
        {toggle("showTangent","Tangente")}
        {toggle("showNormal","Normal")}
        {toggle("showIntersections","Intersecciones con los ejes")}
        {toggle("showParametric","Ecuación paramétrica")}
        {toggle("showEquation","Ecuaciones canónica y general")}
        {toggle("showInteractiveControls","Arrastrar puntos de la parábola")}
      </div>
    </fieldset>
    {(flags.showTangent||flags.showNormal)&&numeric("Parámetro de tangencia t",
      tangentParameter,setTangentParameter)}
    <label className="bwjm-modal-field">
      <span className="bwjm-modal-label">Color de la parábola</span>
      <input type="color" value={color} onChange={event=>setColor(event.target.value)}/>
    </label>
    <div ref={figureRef} aria-label="Vista previa de la parábola"/>
    <div ref={reportRef} className="bwjm-parabola-preview-report"
      aria-label="Vista previa de las propiedades de la parábola"/>
    {error&&<p role="alert" className="bwjm-calculus-error">{error}</p>}
    <details className="bwjm-chart-source">
      <summary>Ver código científico .bwjm</summary>
      <pre className="bwjm-code-preview"><code>{source}</code></pre>
    </details>
    <div className="bwjm-modal-footer">
      <button type="button" className="bwjm-btn-secondary" onClick={onClose}>Cancelar</button>
      <button type="button" className="bwjm-btn-primary" disabled={Boolean(error)||!geometry}
        onClick={()=>{if(!geometry||error)return;onInsert(source);onClose();}}>
        Insertar parábola
      </button>
    </div>
  </section>;
}
