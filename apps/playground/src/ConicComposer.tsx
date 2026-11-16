import React, { useState } from "react";
import { CircleComposer } from "./CircleComposer.js";
import { EllipseComposer } from "./EllipseComposer.js";

/** One inline editor shared by the unified Gráficos y superficies dialog. */
type ConicKind = "circle" | "ellipse" | "parabola" | "hyperbola";
interface Props {
  onClose: () => void;
  onInsert: (block: string) => void;
}
const choices: ReadonlyArray<readonly [ConicKind, string]> = [
  ["circle", "Circunferencia"],
  ["ellipse", "Elipse"],
  ["parabola", "Parábola"],
  ["hyperbola", "Hipérbola"],
];

export function ConicComposer({ onClose, onInsert }: Props) {
  const [kind, setKind] = useState<ConicKind>("circle");
  const [h, setH] = useState("0");
  const [k, setK] = useState("0");
  const [a, setA] = useState("4");
  const [b, setB] = useState("2");
  const [p, setP] = useState("1");
  const [axis, setAxis] = useState<"x" | "y">("x");
  const [rotation, setRotation] = useState("0");
  const [showFocus, setShowFocus] = useState(true);
  const [showDirectrix, setShowDirectrix] = useState(true);
  const [showVertices, setShowVertices] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [showAsymptotes, setShowAsymptotes] = useState(true);

  const center: [number, number] = [Number(h), Number(k)];
  const semiMajor = Number(a);
  const semiMinor = Number(b);
  const focalParameter = Number(p);
  const radians = Number(rotation);
  const missing = [h, k, a, b, p, rotation].some(value => !value.trim());
  const invalid = missing || ![...center, semiMajor, semiMinor, focalParameter, radians].every(Number.isFinite)
    || semiMajor <= 0 || semiMinor <= 0 || (kind === "ellipse" && semiMinor > semiMajor)
    || focalParameter === 0 || Math.max(Math.abs(center[0]), Math.abs(center[1]),
      semiMajor, semiMinor, Math.abs(focalParameter)) > 10000;

  const field = (label: string, value: string, onChange: (value: string) => void) => (
    <label className="bwjm-modal-field">
      <span className="bwjm-modal-label">{label}</span>
      <input className="bwjm-modal-input" type="number" step="any" value={value}
        onChange={event => onChange(event.target.value)} />
    </label>
  );

  const insert = () => {
    if (invalid || kind === "circle") return;
    const lines = [
      "```conic",
      "conicType: " + kind,
      "mode: canonical",
      "center: " + JSON.stringify(center),
      ...(kind === "ellipse" || kind === "hyperbola"
        ? ["semiMajorAxis: " + semiMajor, "semiMinorAxis: " + semiMinor] : []),
      ...(kind === "parabola" ? ["focalParameter: " + focalParameter] : []),
      "axis: " + axis,
      "rotation: " + radians,
      "showFocus: " + showFocus,
      "showDirectrix: " + showDirectrix,
      "showVertices: " + showVertices,
      "showAxes: " + showAxes,
      "showAsymptotes: " + showAsymptotes,
      "```",
    ];
    onInsert("\n" + lines.join("\n") + "\n");
    onClose();
  };

  return (
    <section className="bwjm-conic-composer" aria-label="Constructor de cónicas">
      <label className="bwjm-modal-field">
        <span className="bwjm-modal-label">Figura</span>
        <select className="bwjm-modal-input" aria-label="Tipo de cónica" value={kind}
          onChange={event => setKind(event.target.value as ConicKind)}>
          {choices.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </label>
      {kind === "circle" ? (
        <CircleComposer onInsert={onInsert} onClose={onClose} />
      ) : kind === "ellipse" ? (
        <EllipseComposer onInsert={onInsert} onClose={onClose} />
      ) : (
        <>
          <div className="bwjm-modal-grid">
            {field("Centro o vértice: x", h, setH)}
            {field("Centro o vértice: y", k, setK)}
            {kind === "hyperbola" && field("Semieje a", a, setA)}
            {kind === "hyperbola" && field("Semieje b", b, setB)}
            {kind === "parabola" && field("Parámetro focal p (con signo)", p, setP)}
            <label className="bwjm-modal-field">
              <span className="bwjm-modal-label">Eje principal</span>
              <select className="bwjm-modal-input" value={axis}
                onChange={event => setAxis(event.target.value as "x" | "y")}>
                <option value="x">Horizontal</option>
                <option value="y">Vertical</option>
              </select>
            </label>
            {kind === "hyperbola" &&
              field("Rotación (radianes)", rotation, setRotation)}
          </div>
          <fieldset className="bwjm-chart-coefficients">
            <legend>Mostrar propiedades geométricas</legend>
            <div className="bwjm-modal-grid">
              <label><input type="checkbox" checked={showFocus}
                onChange={event => setShowFocus(event.target.checked)} /> Focos</label>
              <label><input type="checkbox" checked={showVertices}
                onChange={event => setShowVertices(event.target.checked)} /> Vértices</label>
              <label><input type="checkbox" checked={showAxes}
                onChange={event => setShowAxes(event.target.checked)} /> Ejes</label>
              {kind === "parabola" && <label><input type="checkbox" checked={showDirectrix}
                onChange={event => setShowDirectrix(event.target.checked)} /> Directriz</label>}
              {kind === "hyperbola" && <label><input type="checkbox" checked={showAsymptotes}
                onChange={event => setShowAsymptotes(event.target.checked)} /> Asíntotas</label>}
            </div>
          </fieldset>
          {invalid && <p role="alert" className="bwjm-calculus-error">
            Revisa los valores: semiejes positivos, b no mayor que a para elipse y p distinto de cero.
          </p>}
          <div className="bwjm-modal-footer">
            <button type="button" className="bwjm-btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="button" className="bwjm-btn-primary" disabled={invalid}
              onClick={insert}>Insertar en documento</button>
          </div>
        </>
      )}
    </section>
  );
}
