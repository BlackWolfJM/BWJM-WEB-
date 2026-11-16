import React, { useState } from "react";
import { CircleComposer } from "./CircleComposer.js";
import { EllipseComposer } from "./EllipseComposer.js";
import { ParabolaComposer } from "./ParabolaComposer.js";

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
  const [axis, setAxis] = useState<"x" | "y">("x");
  const [rotation, setRotation] = useState("0");
  const [showFocus, setShowFocus] = useState(true);
  const [showVertices, setShowVertices] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [showAsymptotes, setShowAsymptotes] = useState(true);

  const center: [number, number] = [Number(h), Number(k)];
  const semiMajor = Number(a);
  const semiMinor = Number(b);
  const radians = Number(rotation);
  const missing = [h, k, a, b, rotation].some(value => !value.trim());
  const invalid = missing || ![...center, semiMajor, semiMinor, radians].every(Number.isFinite)
    || semiMajor <= 0 || semiMinor <= 0 || Math.max(Math.abs(center[0]), Math.abs(center[1]),
      semiMajor, semiMinor) > 10000;

  const field = (label: string, value: string, onChange: (value: string) => void) => (
    <label className="bwjm-modal-field">
      <span className="bwjm-modal-label">{label}</span>
      <input className="bwjm-modal-input" type="number" step="any" value={value}
        onChange={event => onChange(event.target.value)} />
    </label>
  );

  const insert = () => {
    if (invalid || kind !== "hyperbola") return;
    const lines = [
      "```conic",
      "conicType: " + kind,
      "mode: canonical",
      "center: " + JSON.stringify(center),
      "semiMajorAxis: " + semiMajor,
      "semiMinorAxis: " + semiMinor,
      "axis: " + axis,
      "rotation: " + radians,
      "showFocus: " + showFocus,
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
      ) : kind === "parabola" ? (
        <ParabolaComposer onInsert={onInsert} onClose={onClose} />
      ) : (
        <>
          <div className="bwjm-modal-grid">
            {field("Centro o vértice: x", h, setH)}
            {field("Centro o vértice: y", k, setK)}
            {field("Semieje a", a, setA)}
            {field("Semieje b", b, setB)}
            <label className="bwjm-modal-field">
              <span className="bwjm-modal-label">Eje principal</span>
              <select className="bwjm-modal-input" value={axis}
                onChange={event => setAxis(event.target.value as "x" | "y")}>
                <option value="x">Horizontal</option>
                <option value="y">Vertical</option>
              </select>
            </label>
            {field("Rotación (radianes)", rotation, setRotation)}
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
              <label><input type="checkbox" checked={showAsymptotes}
                onChange={event => setShowAsymptotes(event.target.checked)} /> Asíntotas</label>
            </div>
          </fieldset>
          {invalid && <p role="alert" className="bwjm-calculus-error">
            Revisa los valores: ambos semiejes deben ser positivos y finitos.
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
