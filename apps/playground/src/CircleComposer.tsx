import React, { useEffect, useRef, useState } from "react";
import type { ConicNode } from "@mathmd/ast";
import { circleFromCenterRadius, circleFromCoefficients, circleFromThreePoints,
  parseCircleEquation, serializeCircleBlock, type CircleGeometry } from "./circleGeometry.js";
import { createCircleSVG } from "./circleFigure.js";
import { buildCircleReport } from "./circleReport.js";
import { tangentsFromPoint } from "./circleConstructions.js";
import { mountCircleDrag, type CircleInteraction } from "./circleDrag.js";

type CircleMode = "center-radius" | "canonical" | "general" | "three-points";
interface Props { onInsert: (source:string)=>void; onClose:()=>void }

export function CircleComposer({onInsert,onClose}:Props) {
  const [mode,setMode]=useState<CircleMode>("center-radius");
  const [h,setH]=useState("0"),[k,setK]=useState("0"),[radius,setRadius]=useState("3");
  const [canonical,setCanonical]=useState("(x-1)^2+(y+2)^2=9");
  const [general,setGeneral]=useState("x^2+y^2-2x+4y-4=0");
  const [pointA,setPointA]=useState<[string,string]>(["3","0"]);
  const [pointB,setPointB]=useState<[string,string]>(["0","3"]);
  const [pointC,setPointC]=useState<[string,string]>(["-3","0"]);
  const [flags,setFlags]=useState({
    showCenter:true,showRadius:true,showDiameter:false,showChord:false,
    showSecant:false,showTangent:false,showIntersections:false,showEquation:true,
    showInteractiveControls:true,
  });
  const [angles,setAngles]=useState({
    radiusAngle:30,diameterAngle:0,chordStartAngle:40,chordEndAngle:135,
    secantStartAngle:210,secantEndAngle:300,tangentAngle:60,
  });
  const [color,setColor]=useState("#0284c7");
  const [tangentMode,setTangentMode]=useState<"angle"|"point">("angle");
  const [tangentInput,setTangentInput]=useState<[string,string]>(["5","0"]);
  const previewRef=useRef<HTMLDivElement|null>(null);
  const reportRef=useRef<HTMLDivElement|null>(null);
  let geometry:CircleGeometry|undefined;
  let points:Array<[number,number]>|undefined;
  let error="";
  try {
    if(mode==="center-radius"){
      if(!h.trim()||!k.trim()||!radius.trim())throw new Error("Completa centro y radio.");
      geometry=circleFromCenterRadius([Number(h),Number(k)],Number(radius));
    }else if(mode==="three-points"){
      const originals=[pointA,pointB,pointC];
      if(originals.some(p=>p.some(v=>!v.trim())))throw new Error("Completa las coordenadas de los tres puntos.");
      points=originals.map(p=>[Number(p[0]),Number(p[1])] as [number,number]);
      geometry=circleFromThreePoints(points[0],points[1],points[2]);
    }else{
      const eq=mode==="canonical"?canonical:general;
      const coefficients=parseCircleEquation(eq);
      geometry=circleFromCoefficients(coefficients);
      geometry={...geometry,coefficients};
    }
  } catch(e) {
    error=e instanceof Error?e.message:String(e);
  }
  const savedFlags=flags;
  const tangentPoint:[number,number]=[Number(tangentInput[0]),Number(tangentInput[1])];
  const settings={...savedFlags,...angles,color,tangentMode,tangentPoint};
  const invalidAngles=Object.values(angles).some(v=>!Number.isFinite(v)||Math.abs(v)>3600);
  if(!error&&invalidAngles)error="Los ángulos deben ser finitos y estar entre −3600° y 3600°.";
  if(!error&&flags.showTangent&&tangentMode==="point"&&geometry){
    if(tangentInput.some(v=>!v.trim())||!tangentPoint.every(Number.isFinite))
      error="Introduce coordenadas numéricas para el punto P.";
    else if(tangentsFromPoint(geometry,tangentPoint).length===0)
      error="El punto está dentro del círculo: no existen tangentes reales.";
  }
  if(!error&&(flags.showChord||flags.showSecant)){
    const same=(a:number,b:number)=>Math.abs(Math.sin((a-b)*Math.PI/360))<1e-8;
    if((flags.showChord&&same(angles.chordStartAngle,angles.chordEndAngle))||
      (flags.showSecant&&same(angles.secantStartAngle,angles.secantEndAngle)))
      error="Los extremos de cada cuerda o secante deben ser distintos.";
  }
  useEffect(()=>{
    const previewElement=previewRef.current,reportElement=reportRef.current;
    if(!previewElement||!reportElement)return;
    previewElement.replaceChildren();
    reportElement.replaceChildren();
    if(!geometry||error)return;
    const node={type:"conic",conicType:"circle",mode,...settings} as ConicNode;
    const original=geometry;
    const updatePreview=(next:CircleGeometry,change:CircleInteraction={})=>{
      const viewNode={
        ...node,...change.angles,
        tangentPoint:change.tangentPoint??node.tangentPoint,
        viewCenter:node.viewCenter??original.center,
        viewSpan:node.viewSpan??Math.max(3,original.radius*1.55),
      };
      previewElement.replaceChildren(createCircleSVG(viewNode,next));
      reportElement.replaceChildren(buildCircleReport(viewNode,next));
    };
    previewElement.appendChild(createCircleSVG(node,original));
    reportElement.appendChild(buildCircleReport(node,original));
    return mountCircleDrag(previewElement,node,original,updatePreview,change=>{
      if(change.angles)setAngles(previous=>({...previous,...change.angles}));
      if(change.tangentPoint)setTangentInput(change.tangentPoint.map(String) as [string,string]);
      if(change.center||change.radius){
        const next=circleFromCenterRadius(change.center??original.center,
          change.radius??original.radius);
        if(mode==="center-radius"){
          setH(String(next.center[0]));setK(String(next.center[1]));
          setRadius(String(next.radius));
        }else if(mode==="canonical"){
          setCanonical(next.canonicalTex);
        }else if(mode==="general"){
          setGeneral(next.generalTex);
        }else{
          const scale=next.radius/original.radius;
          const transform=(p:[string,string]):[string,string]=>[
            String(next.center[0]+scale*(Number(p[0])-original.center[0])),
            String(next.center[1]+scale*(Number(p[1])-original.center[1])),
          ];
          setPointA(previous=>transform(previous));
          setPointB(previous=>transform(previous));
          setPointC(previous=>transform(previous));
        }
      }
    });
  });
  const numeric=(label:string,value:string,setter:(value:string)=>void)=>
    <label className="bwjm-modal-field">
      <span className="bwjm-modal-label">{label}</span>
      <input type="number" step="any" className="bwjm-modal-input" value={value}
        onChange={event=>setter(event.target.value)}/>
    </label>;
  const point=(name:string,value:[string,string],setter:(v:[string,string])=>void)=>
    <fieldset className="bwjm-modal-field">
      <legend>{name}</legend>
      <div className="bwjm-range-fields">
        <input aria-label={name+" x"} type="number" step="any" className="bwjm-modal-input"
          value={value[0]} onChange={e=>setter([e.target.value,value[1]])}/>
        <input aria-label={name+" y"} type="number" step="any" className="bwjm-modal-input"
          value={value[1]} onChange={e=>setter([value[0],e.target.value])}/>
      </div>
    </fieldset>;
  const toggle=(key:keyof typeof flags,label:string)=>
    <label style={{display:"flex",alignItems:"center",gap:6}}>
      <input type="checkbox" checked={flags[key]} onChange={e=>
        setFlags(before=>({...before,[key]:e.target.checked}))}/>
      {label}
    </label>;
  const angle=(key:keyof typeof angles,label:string)=>
    <label className="bwjm-modal-field">
      <span className="bwjm-modal-label">{label} (°)</span>
      <input type="number" step="5" min="-3600" max="3600" className="bwjm-modal-input"
        value={angles[key]} onChange={e=>
          setAngles(before=>({...before,[key]:e.target.value===""?Number.NaN:Number(e.target.value)}))}/>
    </label>;
  const insert=()=>{
    if(error||!geometry)return;
    onInsert(serializeCircleBlock(mode,geometry,settings,points));
    onClose();
  };
  return <section aria-label="Constructor de circunferencia">
    <label className="bwjm-modal-field">
      <span className="bwjm-modal-label">Definir la circunferencia mediante</span>
      <select className="bwjm-modal-input" value={mode} onChange={e=>setMode(e.target.value as CircleMode)}>
        <option value="center-radius">Centro y radio</option>
        <option value="canonical">Ecuación canónica</option>
        <option value="general">Ecuación general</option>
        <option value="three-points">Tres puntos no colineales</option>
      </select>
    </label>
    {mode==="center-radius"&&<div className="bwjm-modal-grid">
      {numeric("Centro h",h,setH)}{numeric("Centro k",k,setK)}
      {numeric("Radio r",radius,setRadius)}
    </div>}
    {mode==="canonical"&&<label className="bwjm-modal-field">
      <span className="bwjm-modal-label">Ecuación canónica (x−h)²+(y−k)²=r²</span>
      <input className="bwjm-modal-input" aria-label="Ecuación canónica" value={canonical}
        onChange={e=>setCanonical(e.target.value)} />
    </label>}
    {mode==="general"&&<label className="bwjm-modal-field">
      <span className="bwjm-modal-label">Ecuación general Ax²+Bxy+Cy²+Dx+Ey+F=0</span>
      <input className="bwjm-modal-input" aria-label="Ecuación general" value={general}
        onChange={e=>setGeneral(e.target.value)} />
    </label>}
    {mode==="three-points"&&<div className="bwjm-modal-grid">
      {point("Punto A",pointA,setPointA)}{point("Punto B",pointB,setPointB)}{point("Punto C",pointC,setPointC)}
    </div>}
    <fieldset className="bwjm-chart-coefficients">
      <legend>Elementos geométricos visibles</legend>
      <div className="bwjm-modal-grid">
        {toggle("showCenter","Centro")}
        {toggle("showRadius","Radio")}
        {toggle("showDiameter","Diámetro")}
        {toggle("showChord","Cuerda")}
        {toggle("showSecant","Secante")}
        {toggle("showTangent","Tangente")}
        {toggle("showIntersections","Intersecciones con los ejes")}
        {toggle("showEquation","Mostrar ecuación")}
        {toggle("showInteractiveControls","Arrastrar centro y puntos en la gráfica")}
      </div>
    </fieldset>
    {flags.showTangent&&<div className="bwjm-circle-tangent-input">
      <label className="bwjm-modal-field">
        <span className="bwjm-modal-label">Definir recta tangente</span>
        <select className="bwjm-modal-input" aria-label="Definición de tangente"
          value={tangentMode}
          onChange={event=>setTangentMode(event.target.value as "angle"|"point")}>
          <option value="angle">Ángulo sobre la circunferencia</option>
          <option value="point">Por punto cartesiano P(x,y)</option>
        </select>
      </label>
      {tangentMode==="point"&&<div className="bwjm-modal-grid">
        {numeric("Punto P · x",tangentInput[0],value=>
          setTangentInput(previous=>[value,previous[1]]))}
        {numeric("Punto P · y",tangentInput[1],value=>
          setTangentInput(previous=>[previous[0],value]))}
        <p className="bwjm-circle-tangent-hint">
          Si P pertenece a la circunferencia se muestra una tangente;
          si es exterior se muestran las dos tangentes.
        </p>
      </div>}
    </div>}
    <details className="bwjm-chart-source">
      <summary>Orientación de los elementos</summary>
      <div className="bwjm-modal-grid">
        {flags.showRadius&&angle("radiusAngle","Radio")}
        {flags.showDiameter&&angle("diameterAngle","Diámetro")}
        {flags.showChord&&<>{angle("chordStartAngle","Inicio cuerda")}{angle("chordEndAngle","Fin cuerda")}</>}
        {flags.showSecant&&<>{angle("secantStartAngle","Inicio secante")}{angle("secantEndAngle","Fin secante")}</>}
        {flags.showTangent&&tangentMode==="angle"&&angle("tangentAngle","Tangente en el punto")}
      </div>
    </details>
    <label className="bwjm-modal-field">
      <span className="bwjm-modal-label">Color de la circunferencia</span>
      <input type="color" value={color} onChange={e=>setColor(e.target.value)}/>
    </label>
    <div ref={previewRef} aria-label="Vista previa de la circunferencia" />
    <div ref={reportRef} className="bwjm-circle-preview-report"
      aria-label="Vista previa de las propiedades matemáticas" />
    {error&&<p className="bwjm-calculus-error" role="alert">{error}</p>}
    <details className="bwjm-chart-source"><summary>Ver código .bwjm</summary>
      <pre className="bwjm-code-preview"><code>{geometry&&!error?serializeCircleBlock(mode,geometry,settings,points):"Revisa los parámetros."}</code></pre>
    </details>
    <div className="bwjm-modal-footer">
      <button type="button" className="bwjm-btn-secondary" onClick={onClose}>Cancelar</button>
      <button type="button" className="bwjm-btn-primary" disabled={Boolean(error)||!geometry}
        onClick={insert}>Insertar circunferencia</button>
    </div>
  </section>;
}
