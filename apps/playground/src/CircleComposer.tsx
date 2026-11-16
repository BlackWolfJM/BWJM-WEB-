import React, { useEffect, useRef, useState } from "react";
import type { ConicNode } from "@mathmd/ast";
import { circleFromCenterRadius, circleFromCoefficients, circleFromThreePoints,
  parseCircleEquation, serializeCircleBlock, type CircleGeometry } from "./circleGeometry.js";
import { createCircleSVG } from "./circleFigure.js";

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
  const previewRef=useRef<HTMLDivElement|null>(null);
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
  const invalidAngles=Object.values(angles).some(v=>!Number.isFinite(v)||Math.abs(v)>3600);
  if(!error&&invalidAngles)error="Los ángulos deben ser finitos y estar entre −3600° y 3600°.";
  if(!error&&(flags.showChord||flags.showSecant)){
    const same=(a:number,b:number)=>Math.abs(Math.sin((a-b)*Math.PI/360))<1e-8;
    if((flags.showChord&&same(angles.chordStartAngle,angles.chordEndAngle))||
      (flags.showSecant&&same(angles.secantStartAngle,angles.secantEndAngle)))
      error="Los extremos de cada cuerda o secante deben ser distintos.";
  }
  useEffect(()=>{
    if(!previewRef.current)return;
    previewRef.current.replaceChildren();
    if(!geometry||error)return;
    const node={
      conicType:"circle",mode,
      ...flags,...angles,color,
    } as ConicNode;
    previewRef.current.appendChild(createCircleSVG(node,geometry));
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
    onInsert(serializeCircleBlock(mode,geometry,{...flags,...angles,color},points));
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
        {toggle("showInteractiveControls","Controles para mover y cambiar radio")}
      </div>
    </fieldset>
    <details className="bwjm-chart-source">
      <summary>Orientación de los elementos</summary>
      <div className="bwjm-modal-grid">
        {flags.showRadius&&angle("radiusAngle","Radio")}
        {flags.showDiameter&&angle("diameterAngle","Diámetro")}
        {flags.showChord&&<>{angle("chordStartAngle","Inicio cuerda")}{angle("chordEndAngle","Fin cuerda")}</>}
        {flags.showSecant&&<>{angle("secantStartAngle","Inicio secante")}{angle("secantEndAngle","Fin secante")}</>}
        {flags.showTangent&&angle("tangentAngle","Tangente en el punto")}
      </div>
    </details>
    <label className="bwjm-modal-field">
      <span className="bwjm-modal-label">Color de la circunferencia</span>
      <input type="color" value={color} onChange={e=>setColor(e.target.value)}/>
    </label>
    <div ref={previewRef} aria-label="Vista previa de la circunferencia" />
    {geometry&&<div className="bwjm-calculus-report">
      <strong>Ecuación: {geometry.canonicalTex}</strong>
      <p>Centro ({geometry.center.map(x=>Number(x.toPrecision(6))).join(", ")}), radio {Number(geometry.radius.toPrecision(6))},
        diámetro {Number((2*geometry.radius).toPrecision(6))}</p>
      <p>Ecuación general: {geometry.generalTex}</p>
    </div>}
    {error&&<p className="bwjm-calculus-error" role="alert">{error}</p>}
    <details className="bwjm-chart-source"><summary>Ver código .bwjm</summary>
      <pre className="bwjm-code-preview"><code>{geometry&&!error?serializeCircleBlock(mode,geometry,{...flags,...angles,color},points):"Revisa los parámetros."}</code></pre>
    </details>
    <div className="bwjm-modal-footer">
      <button type="button" className="bwjm-btn-secondary" onClick={onClose}>Cancelar</button>
      <button type="button" className="bwjm-btn-primary" disabled={Boolean(error)||!geometry}
        onClick={insert}>Insertar circunferencia</button>
    </div>
  </section>;
}
