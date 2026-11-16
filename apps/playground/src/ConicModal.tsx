import React, { useState } from "react";
import { CircleComposer } from "./CircleComposer.js";

type Kind = "circle"|"ellipse"|"parabola"|"hyperbola";
interface Props { onClose: () => void; onInsert: (block: string) => void }
const choices: Array<[Kind,string]> = [
  ["circle","Circunferencia"],["ellipse","Elipse"],
  ["parabola","Parábola"],["hyperbola","Hipérbola"],
];
export function ConicModal({onClose,onInsert}:Props) {
  const [kind,setKind]=useState<Kind>("ellipse");
  const [h,setH]=useState("0"),[k,setK]=useState("0");
  const [a,setA]=useState("4"),[b,setB]=useState("2");
  const [p,setP]=useState("1"),[axis,setAxis]=useState<"x"|"y">("x");
  const [rotation,setRotation]=useState("0");
  const [showFocus,setShowFocus]=useState(true);
  const [showDirectrix,setShowDirectrix]=useState(true);
  const [showVertices,setShowVertices]=useState(true);
  const [showAxes,setShowAxes]=useState(true);
  const [showAsymptotes,setShowAsymptotes]=useState(true);
  const center=[Number(h),Number(k)], ra=Number(a), rb=Number(b), focal=Number(p),angle=Number(rotation);
  const invalid=![...center,ra,rb,focal,angle].every(Number.isFinite)
    || ra<=0 || rb<=0 || (kind==="ellipse"&&rb>ra) || focal===0
    || Math.max(Math.abs(center[0]),Math.abs(center[1]),ra,rb,Math.abs(focal))>10000;
  const insert=()=>{
    if(invalid)return;
    const rows=[
      "```conic", "conicType: "+kind,
      "mode: "+(kind==="circle"?"center-radius":"canonical"),
      "center: ["+center.join(", ")+"]",
      ...(kind==="circle"?["radius: "+ra]:[]),
      ...(kind==="ellipse"||kind==="hyperbola"?["semiMajorAxis: "+ra,"semiMinorAxis: "+rb]:[]),
      ...(kind==="parabola"?["focalParameter: "+focal]:[]),
      "axis: "+axis,"rotation: "+angle,
      "showFocus: "+showFocus,"showDirectrix: "+showDirectrix,
      "showVertices: "+showVertices,"showAxes: "+showAxes,
      "showAsymptotes: "+showAsymptotes,
      "```"
    ];
    // Avoid accepting free-form HTML: generated values are numeric/boolean literals only.
    onInsert("\n"+rows.join("\n")+"\n");
    onClose();
  };
  const field=(label:string,value:string,onChange:(v:string)=>void)=><label className="bwjm-modal-field">
    <span className="bwjm-modal-label">{label}</span>
    <input className="bwjm-modal-input" type="number" step="any" value={value}
      onChange={e=>onChange(e.target.value)}/>
  </label>;
  return <div className="bwjm-modal-overlay" onClick={onClose}>
    <section className="bwjm-modal-container bwjm-chart-modal" role="dialog"
      aria-label="Insertar cónica" aria-modal="true" onClick={e=>e.stopPropagation()}>
      <header className="bwjm-modal-header"><h2>Insertar cónica</h2>
        <button type="button" className="bwjm-modal-close" onClick={onClose} aria-label="Cerrar">×</button>
      </header>
      <div className="bwjm-modal-body">
        <label className="bwjm-modal-field"><span className="bwjm-modal-label">Figura</span>
          <select className="bwjm-modal-input" value={kind} onChange={e=>setKind(e.target.value as Kind)}>
            {choices.map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {kind === "circle" ? <CircleComposer onInsert={onInsert} onClose={onClose}/> : <>
        <div className="bwjm-modal-grid">
          {field("Centro o vértice: x",h,setH)}
          {field("Centro o vértice: y",k,setK)}
          {kind!=="parabola"&&field(kind==="circle"?"Radio":"Semieje a",a,setA)}
          {(kind==="ellipse"||kind==="hyperbola")&&field("Semieje b",b,setB)}
          {kind==="parabola"&&field("Parámetro focal p (con signo)",p,setP)}
          {kind!=="circle"&&<label className="bwjm-modal-field"><span className="bwjm-modal-label">Eje principal</span>
            <select className="bwjm-modal-input" value={axis} onChange={e=>setAxis(e.target.value as "x"|"y")}>
              <option value="x">Horizontal</option><option value="y">Vertical</option>
            </select></label>}
          {(kind==="ellipse"||kind==="hyperbola")&&field("Rotación (radianes)",rotation,setRotation)}
        </div>
        <fieldset><legend>Mostrar propiedades geométricas</legend>
          <label><input type="checkbox" checked={showFocus} onChange={e=>setShowFocus(e.target.checked)}/> Focos</label>{" · "}
          <label><input type="checkbox" checked={showVertices} onChange={e=>setShowVertices(e.target.checked)}/> Vértices</label>{" · "}
          <label><input type="checkbox" checked={showAxes} onChange={e=>setShowAxes(e.target.checked)}/> Ejes</label>{" · "}
          {kind==="parabola"&&<label><input type="checkbox" checked={showDirectrix} onChange={e=>setShowDirectrix(e.target.checked)}/> Directriz</label>}
          {kind==="hyperbola"&&<label><input type="checkbox" checked={showAsymptotes} onChange={e=>setShowAsymptotes(e.target.checked)}/> Asíntotas</label>}
        </fieldset>
        {invalid&&<p role="alert">Revisa los valores: semiejes positivos, b ≤ a para elipse y p distinto de cero.</p>}
      </div>
      <footer className="bwjm-modal-footer">
        <button className="bwjm-btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="bwjm-btn-primary" disabled={invalid} onClick={insert}>Insertar en documento</button>
      </footer>
      </>}
    </section>
  </div>;
}
