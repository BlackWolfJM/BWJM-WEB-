import React,{useState} from "react";
import { CircleComposer } from "./CircleComposer.js";
import { EllipseComposer } from "./EllipseComposer.js";
import { ParabolaComposer } from "./ParabolaComposer.js";
import { HyperbolaComposer } from "./HyperbolaComposer.js";

/** A single unified conics entry — four independent specialized composers. */
type ConicKind="circle"|"ellipse"|"parabola"|"hyperbola";
interface Props {onClose:()=>void;onInsert:(source:string)=>void}
const choices:ReadonlyArray<readonly[ConicKind,string]>=[
  ["circle","Circunferencia"],
  ["ellipse","Elipse"],
  ["parabola","Parábola"],
  ["hyperbola","Hipérbola"],
];
export function ConicComposer({onClose,onInsert}:Props){
  const [kind,setKind]=useState<ConicKind>("circle");
  return <section className="bwjm-conic-composer" aria-label="Constructor de cónicas">
    <label className="bwjm-modal-field">
      <span className="bwjm-modal-label">Figura</span>
      <select className="bwjm-modal-input" aria-label="Tipo de cónica" value={kind}
        onChange={event=>setKind(event.target.value as ConicKind)}>
        {choices.map(([value,label])=><option value={value} key={value}>{label}</option>)}
      </select>
    </label>
    {kind==="circle"?<CircleComposer onInsert={onInsert} onClose={onClose}/>:
      kind==="ellipse"?<EllipseComposer onInsert={onInsert} onClose={onClose}/>:
      kind==="parabola"?<ParabolaComposer onInsert={onInsert} onClose={onClose}/>:
      <HyperbolaComposer onInsert={onInsert} onClose={onClose}/>}
  </section>;
}
