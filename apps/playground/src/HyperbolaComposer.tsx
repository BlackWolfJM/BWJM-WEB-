import React,{useEffect,useRef,useState} from "react";
import type { ConicNode } from "@mathmd/ast";
import {
  hyperbolaCoefficients,hyperbolaFromCenter,hyperbolaFromFoci,hyperbolaFromGeneral,
  parseHyperbolaEquation,serializeHyperbolaBlock,type HyperbolaCoefficients,
  type HyperbolaGeometry,type HyperbolaPoint,type HyperbolaBranch,
} from "./hyperbolaGeometry.js";
import { createHyperbolaSVG } from "./hyperbolaFigure.js";
import { buildHyperbolaReport } from "./hyperbolaReport.js";
import { mountHyperbolaDrag,type HyperbolaInteraction } from "./hyperbolaDrag.js";

type Definition="canonical"|"foci"|"general";
interface Props {onInsert:(source:string)=>void;onClose:()=>void}
const dec=(n:number)=>Number(n.toFixed(9)).toString();
const generalExpression=(coeff:HyperbolaCoefficients)=>
  "("+dec(coeff.A)+")*x^2+("+dec(coeff.B)+")*x*y+("+dec(coeff.C)+
  ")*y^2+("+dec(coeff.D)+")*x+("+dec(coeff.E)+")*y+("+dec(coeff.F)+")=0";

export function HyperbolaComposer({onInsert,onClose}:Props){
  const [mode,setMode]=useState<Definition>("canonical");
  const [h,setH]=useState("0"),[k,setK]=useState("0");
  const [a,setA]=useState("4"),[b,setB]=useState("3");
  const [axis,setAxis]=useState<"x"|"y">("x");
  const [rotation,setRotation]=useState("0");
  const [f1,setF1]=useState<[string,string]>(["-5","0"]);
  const [f2,setF2]=useState<[string,string]>(["5","0"]);
  const [diff,setDiff]=useState("8");
  const [general,setGeneral]=useState("9*x^2-16*y^2=144");
  const [color,setColor]=useState("#2563eb");
  const [tangentParameter,setTangentParameter]=useState("0");
  const [branch,setBranch]=useState<HyperbolaBranch>(1);
  const [flags,setFlags]=useState({
    showCenter:true,showFocus:true,showVertices:true,showCoVertices:true,
    showAxes:true,showAsymptotes:true,showRectangle:true,
    showDirectrices:true,showLatusRectum:false,
    showTangent:false,showNormal:false,showIntersections:true,
    showParametric:true,showEquation:true,showInteractiveControls:true,
  });
  const figureRef=useRef<HTMLDivElement|null>(null);
  const reportRef=useRef<HTMLDivElement|null>(null);
  let geometry:HyperbolaGeometry|undefined,error="";
  let fociInput:{focus1:HyperbolaPoint;focus2:HyperbolaPoint;diffDistances:number}|undefined;
  let generalInput:HyperbolaCoefficients|undefined;
  try{
    if(!tangentParameter.trim()||!Number.isFinite(Number(tangentParameter))||
      Math.abs(Number(tangentParameter))>5)
      throw new Error("El parámetro de tangencia debe estar entre −5 y 5.");
    if(mode==="canonical"){
      if([h,k,a,b,rotation].some(str=>!str.trim()))
        throw new Error("Completa el centro, los dos semiejes y la rotación.");
      geometry=hyperbolaFromCenter([Number(h),Number(k)],Number(a),Number(b),
        axis,Number(rotation));
    }else if(mode==="foci"){
      if([...f1,...f2,diff].some(str=>!str.trim()))
        throw new Error("Completa ambos focos y la diferencia de distancias.");
      fociInput={
        focus1:[Number(f1[0]),Number(f1[1])],
        focus2:[Number(f2[0]),Number(f2[1])],
        diffDistances:Number(diff),
      };
      geometry=hyperbolaFromFoci(fociInput.focus1,fociInput.focus2,
        fociInput.diffDistances);
    }else{
      if(!general.trim())throw new Error("Introduce una ecuación general.");
      generalInput=parseHyperbolaEquation(general);
      geometry=hyperbolaFromGeneral(generalInput);
    }
  }catch(cause){error=cause instanceof Error?cause.message:String(cause);}
  const options={...flags,color,tangentParameter:Number(tangentParameter),
    hyperbolaBranch:branch};
  useEffect(()=>{
    const figure=figureRef.current,report=reportRef.current;
    if(!figure||!report)return;
    figure.replaceChildren();report.replaceChildren();
    if(!geometry||error)return;
    const original=geometry;
    const node={type:"conic",conicType:"hyperbola",mode,...options} as ConicNode;
    const stable={...node,viewCenter:original.center,
      viewSpan:Math.max(4,original.c*1.7,original.b*2.1)};
    const preview=(next:HyperbolaGeometry,change:HyperbolaInteraction={})=>{
      const effective={...stable,
        tangentParameter:change.tangentParameter??node.tangentParameter};
      figure.replaceChildren(createHyperbolaSVG(effective,next));
      report.replaceChildren(buildHyperbolaReport(effective,next));
    };
    preview(original);
    return mountHyperbolaDrag(figure,stable,original,preview,change=>{
      if(change.tangentParameter!==undefined)
        setTangentParameter(String(change.tangentParameter));
      if(change.center||change.a!==undefined||change.b!==undefined){
        const next=hyperbolaFromCenter(change.center??original.center,
          change.a??original.a,change.b??original.b,"x",original.rotation);
        if(mode==="canonical"){
          setH(String(next.center[0]));setK(String(next.center[1]));
          setA(String(next.a));setB(String(next.b));
          setRotation(String(next.rotation-(axis==="y"?Math.PI/2:0)));
        }else if(mode==="foci"){
          setF1(next.focus1.map(String) as [string,string]);
          setF2(next.focus2.map(String) as [string,string]);
          setDiff(String(2*next.a));
        }else{
          const originalCoeffs=generalInput??hyperbolaCoefficients(
            original.center,original.a,original.b,original.rotation);
          const baseline=hyperbolaCoefficients(original.center,original.a,
            original.b,original.rotation);
          const keys:Array<"A"|"B"|"C">=["A","B","C"];
          const key=keys.reduce((selected,current)=>
            Math.abs(baseline[current])>Math.abs(baseline[selected])?current:selected,"A");
          const factor=originalCoeffs[key]/baseline[key];
          const generated=hyperbolaCoefficients(next.center,next.a,next.b,next.rotation);
          const coefficients=Object.fromEntries(Object.entries(generated)
            .map(([name,value])=>[name,value*factor])) as unknown as HyperbolaCoefficients;
          setGeneral(generalExpression(coefficients));
        }
      }
    });
  });
  const numeric=(label:string,value:string,change:(text:string)=>void)=>
    <label className="bwjm-modal-field">
      <span className="bwjm-modal-label">{label}</span>
      <input type="number" step="any" className="bwjm-modal-input"
        value={value} onChange={event=>change(event.target.value)}/>
    </label>;
  const focusFields=(name:string,values:[string,string],
    change:(next:[string,string])=>void)=>
    <fieldset className="bwjm-modal-field">
      <legend>{name}</legend>
      <div className="bwjm-range-fields">
        <input type="number" step="any" className="bwjm-modal-input"
          aria-label={name+" · x"} value={values[0]}
          onChange={event=>change([event.target.value,values[1]])}/>
        <input type="number" step="any" className="bwjm-modal-input"
          aria-label={name+" · y"} value={values[1]}
          onChange={event=>change([values[0],event.target.value])}/>
      </div>
    </fieldset>;
  const toggle=(key:keyof typeof flags,label:string)=>
    <label className="bwjm-hyperbola-toggle">
      <input type="checkbox" checked={flags[key]}
        onChange={event=>setFlags(previous=>({...previous,[key]:event.target.checked}))}/>
      {label}
    </label>;
  const source=geometry&&!error?
    serializeHyperbolaBlock(mode,geometry,options,
      {...fociInput,coefficients:generalInput}):"Revisa los parámetros.";
  return <section className="bwjm-hyperbola-composer" aria-label="Constructor de hipérbola">
    <label className="bwjm-modal-field">
      <span className="bwjm-modal-label">Definir la hipérbola mediante</span>
      <select className="bwjm-modal-input" value={mode}
        onChange={event=>setMode(event.target.value as Definition)}>
        <option value="canonical">Centro, semiejes y orientación</option>
        <option value="foci">Dos focos y diferencia de distancias</option>
        <option value="general">Ecuación general con término Bxy</option>
      </select>
    </label>
    {mode==="canonical"?<div className="bwjm-modal-grid">
      {numeric("Centro h",h,setH)}{numeric("Centro k",k,setK)}
      {numeric("Semieje transverso a",a,setA)}
      {numeric("Semieje conjugado b",b,setB)}
      <label className="bwjm-modal-field">
        <span className="bwjm-modal-label">Eje transverso</span>
        <select className="bwjm-modal-input" value={axis}
          onChange={event=>setAxis(event.target.value as "x"|"y")}>
          <option value="x">Horizontal</option><option value="y">Vertical</option>
        </select>
      </label>
      {numeric("Rotación adicional (radianes)",rotation,setRotation)}
    </div>:mode==="foci"?<div className="bwjm-modal-grid">
      {focusFields("Foco F₁",f1,setF1)}
      {focusFields("Foco F₂",f2,setF2)}
      {numeric("Diferencia de distancias (2a)",diff,setDiff)}
      <p className="bwjm-hyperbola-note">
        Se requiere 0 &lt; 2a &lt; distancia entre los focos (2c).
      </p>
    </div>:<label className="bwjm-modal-field">
      <span className="bwjm-modal-label">Ax² + Bxy + Cy² + Dx + Ey + F = 0</span>
      <input className="bwjm-modal-input" value={general}
        aria-label="Ecuación general de la hipérbola"
        onChange={event=>setGeneral(event.target.value)}/>
      <small>Usa ^2 para potencias y * para productos, por ejemplo 9*x^2-16*y^2=144.</small>
    </label>}
    <fieldset className="bwjm-chart-coefficients">
      <legend>Elementos geométricos y científicos</legend>
      <div className="bwjm-modal-grid bwjm-hyperbola-options">
        {toggle("showCenter","Centro")}
        {toggle("showFocus","Focos")}
        {toggle("showVertices","Vértices")}
        {toggle("showCoVertices","Extremos del eje conjugado")}
        {toggle("showAxes","Ejes transverso y conjugado")}
        {toggle("showAsymptotes","Asíntotas")}
        {toggle("showRectangle","Rectángulo auxiliar")}
        {toggle("showDirectrices","Directrices")}
        {toggle("showLatusRectum","Lados rectos")}
        {toggle("showTangent","Tangente")}
        {toggle("showNormal","Normal")}
        {toggle("showIntersections","Cortes con los ejes")}
        {toggle("showParametric","Parametrización")}
        {toggle("showEquation","Ecuaciones")}
        {toggle("showInteractiveControls","Arrastrar elementos geométricos")}
      </div>
    </fieldset>
    {(flags.showTangent||flags.showNormal)&&<div className="bwjm-modal-grid">
      {numeric("Parámetro del punto de tangencia t",tangentParameter,setTangentParameter)}
      <label className="bwjm-modal-field">
        <span className="bwjm-modal-label">Rama donde se encuentra el punto</span>
        <select className="bwjm-modal-input" aria-label="Rama de tangencia"
          value={branch} onChange={event=>setBranch(Number(event.target.value) as HyperbolaBranch)}>
          <option value={1}>Rama +U</option><option value={-1}>Rama −U</option>
        </select>
      </label>
    </div>}
    <label className="bwjm-modal-field">
      <span className="bwjm-modal-label">Color de la hipérbola</span>
      <input type="color" value={color} onChange={event=>setColor(event.target.value)}/>
    </label>
    <div ref={figureRef} aria-label="Vista previa de la hipérbola"/>
    <div ref={reportRef} className="bwjm-hyperbola-preview-report"
      aria-label="Vista previa de propiedades de la hipérbola"/>
    {error&&<p role="alert" className="bwjm-calculus-error">{error}</p>}
    <details className="bwjm-chart-source">
      <summary>Ver código .bwjm</summary>
      <pre className="bwjm-code-preview"><code>{source}</code></pre>
    </details>
    <div className="bwjm-modal-footer">
      <button type="button" className="bwjm-btn-secondary" onClick={onClose}>Cancelar</button>
      <button type="button" className="bwjm-btn-primary"
        disabled={Boolean(error)||!geometry} onClick={()=>{
          if(!geometry||error)return;
          onInsert(source);onClose();
        }}>Insertar hipérbola</button>
    </div>
  </section>;
}
