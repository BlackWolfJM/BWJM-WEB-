import React, { useState } from "react";
import { parseDomainLimit } from "@mathmd/parser";
import { extractFreeParameters } from "@mathmd/math";
import { IconX, IconCheck, IconBarChart } from "./icons.js";
import { CalculusWizard } from "./CalculusWizard.js";
import { ChartKindIcon } from "./ChartKindIcon.js";

interface ChartModalProps {
  isOpen: boolean;
  documentVariables: readonly string[];
  onClose: () => void;
  onInsert: (codeBlock: string) => void;
}

export const chartKinds = [
  ["plot2d", "Función 2D"],
  ["surface3d", "Superficie 3D"],
  ["curve3d", "Curva 3D"],
  ["parametric2d", "Curva paramétrica 2D"],
  ["vectorfield2d", "Campo vectorial 2D"],
  ["flow2d", "Líneas de corriente"],
  ["crossproduct", "Producto vectorial"],
  ["calculus", "Áreas e integrales"],
  ["experiment", "Experimento con datos"],
  ["slider", "Parámetro global"],
] as const;
type ChartKind = typeof chartKinds[number][0];

const surfacePresets = [
  ["waves", "Ondas", "cos(sqrt(x^2 + y^2))"],
  ["bowl", "Paraboloide", "x^2 + y^2"],
  ["saddle", "Silla de montar", "x^2 - y^2"],
  ["plane", "Plano", "x + y"],
] as const;

function ChartColorInput({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return <label className="bwjm-modal-field bwjm-chart-color">
    <span className="bwjm-modal-label">{label}</span>
    <input type="color" value={value} onChange={event => onChange(event.target.value)} />
  </label>;
}

export const ChartModal: React.FC<ChartModalProps> = ({ isOpen, documentVariables, onClose, onInsert }) => {
  const [kind, setKind] = useState<ChartKind>("plot2d");

  const [eq2d, setEq2d] = useState<string>("sin(x)");
  const [xMin2d, setXMin2d] = useState<string>("-5");
  const [xMax2d, setXMax2d] = useState<string>("5");
  const [color2d, setColor2d] = useState<string>("#0284c7");

  const [eq3d, setEq3d] = useState<string>(surfacePresets[0][2]);
  const [xMin3d, setXMin3d] = useState<string>("-4");
  const [xMax3d, setXMax3d] = useState<string>("4");
  const [yMin3d, setYMin3d] = useState<string>("-4");
  const [yMax3d, setYMax3d] = useState<string>("4");
  const [samples3d, setSamples3d] = useState<string>("40");
  const [surfaceSolid, setSurfaceSolid] = useState(false);
  const [surfaceColor, setSurfaceColor] = useState("#0284c7");

  const [curveX, setCurveX] = useState<string>("cos(t)");
  const [curveY, setCurveY] = useState<string>("sin(t)");
  const [curveZ, setCurveZ] = useState<string>("t / 3");
  const [curveTMin, setCurveTMin] = useState<string>("0");
  const [curveTMax, setCurveTMax] = useState<string>("2π");
  const [curveColor, setCurveColor] = useState<string>("#0284c7");
  const [parametricColor, setParametricColor] = useState("#0284c7");
  const [flowColor, setFlowColor] = useState("#6366f1");
  const [experimentColor, setExperimentColor] = useState("#0284c7");
  const [crossColor, setCrossColor] = useState("#0284c7");
  const [sampleFormula, setSampleFormula] = useState<string>("sin(t)");
  const [sampleMin, setSampleMin] = useState("0");
  const [sampleMax, setSampleMax] = useState("6.28");
  const [sampleCount, setSampleCount] = useState<string>("101");

  const [fieldX, setFieldX] = useState<string>("-y");
  const [fieldY, setFieldY] = useState<string>("x");
  const [fieldXMin, setFieldXMin] = useState<string>("-3");
  const [fieldXMax, setFieldXMax] = useState<string>("3");
  const [fieldYMin, setFieldYMin] = useState<string>("-3");
  const [fieldYMax, setFieldYMax] = useState<string>("3");
  const [fieldDensity, setFieldDensity] = useState<string>("12");
  const [fieldColor, setFieldColor] = useState("#0284c7");

  const [sliderName, setSliderName] = useState<string>("a");
  const [sliderMin, setSliderMin] = useState<string>("0.1");
  const [sliderMax, setSliderMax] = useState<string>("5");
  const [sliderStep, setSliderStep] = useState<string>("0.1");
  const [sliderDefault, setSliderDefault] = useState<string>("1.0");
  const [coefficientValues, setCoefficientValues] = useState<Partial<Record<ChartKind, Record<string, string>>>>({});

  if (!isOpen) return null;

  const expressions = kind === "surface3d" ? [eq3d] : kind === "plot2d" ? [eq2d]
    : kind === "curve3d" ? [curveX, curveY, curveZ] : kind === "parametric2d" ? [curveX, curveY]
    : kind === "vectorfield2d" ? [fieldX, fieldY] : [];
  let coefficientNames: string[] = [];
  let invalidExpression = expressions.some(expression => !expression.trim());
  try {
    coefficientNames = extractFreeParameters(expressions).filter(name => !documentVariables.includes(name));
  } catch {
    invalidExpression = true;
  }
  const coefficients = coefficientNames.map(name => {
    const values = coefficientValues[kind];
    const text = values && Object.prototype.hasOwnProperty.call(values, name) ? values[name] : "1";
    return { name, text, value: text.trim() ? Number(text) : Number.NaN };
  });
  const invalidCoefficient = coefficients.some(({ value }) => !Number.isFinite(value) || Math.abs(value) > 1e6);
  const hasCurveDomain = kind === "curve3d" || kind === "parametric2d";
  const tMin = parseDomainLimit(curveTMin);
  const tMax = parseDomainLimit(curveTMax);
  const invalidCurveDomain = hasCurveDomain && (tMin === undefined || tMax === undefined || tMin >= tMax);
  const error = invalidCurveDomain ? "Escribe un límite inicial menor que el final. Puedes usar π, 2pi o π/2."
    : invalidExpression ? "Revisa las expresiones de la gráfica."
    : invalidCoefficient ? "Escribe un valor entre −1 000 000 y 1 000 000 para cada coeficiente."
    : null;

  let generatedCode = "";
  if (kind === "plot2d") {
    generatedCode = `\`\`\`plot2d\nequation: ${eq2d}\nx: [${xMin2d}, ${xMax2d}]\ncolor: "${color2d}"\n\`\`\``;
  } else if (kind === "surface3d") {
    const fence = String.fromCharCode(96).repeat(3);
    generatedCode = [
      fence+"surface3d","equation: "+eq3d,
      "x: ["+xMin3d+", "+xMax3d+"]","y: ["+yMin3d+", "+yMax3d+"]",
      "samples: "+samples3d,
      ...(surfaceSolid ? ["color: " + JSON.stringify(surfaceColor)] : []),
      fence,
    ].join("\n");
  } else if (kind === "curve3d") {
    const fence = String.fromCharCode(96).repeat(3);
    generatedCode = [
      fence+"curve3d","x: "+curveX,"y: "+curveY,"z: "+curveZ,
      "tDomain: ["+curveTMin+", "+curveTMax+"]",
      "color: "+JSON.stringify(curveColor),fence,
    ].join("\n");
  } else if (kind === "crossproduct") {
    generatedCode = ["```crossproduct", "u: [1, 0, 0]", "v: [0, 1, 0]", "colorU: " + JSON.stringify(crossColor), "```"].join("\n");
  } else if (kind === "flow2d") {
    generatedCode = [
      "```flow2d", 'field: ["-y", "x"]',
      "seeds: [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0]]",
      "x: [-3, 3]", "y: [-3, 3]", "tMax: 6.28",
      "stepSize: 0.04", "showParticles: false", "showVectors: true",
      "color: " + JSON.stringify(flowColor), "```",
    ].join("\n");
  } else if (kind === "parametric2d") {
    generatedCode = [
      "```parametric2d", "x: " + curveX, "y: " + curveY,
      "tDomain: [" + curveTMin + ", " + curveTMax + "]",
      "color: " + JSON.stringify(parametricColor), "samples: 200",
      "animated: false", "```",
    ].join("\n");
  } else if (kind === "experiment") {
    generatedCode = [
      "```functiontable", "id: experimento",
      "caption: Muestreo de una función", "variable: t",
      "domain: [" + sampleMin + ", " + sampleMax + "]",
      "samples: " + sampleCount, "columns: [tiempo, valor]",
      'expressions: ["' + sampleFormula + '"]', "precision: 5", "```", "",
      "```datachart", "tableRef: experimento", "kind: line",
      "x: tiempo", "y: valor", "title: Datos muestreados",
      "color: " + JSON.stringify(experimentColor), "```", "",
      "```statistics", "tableRef: experimento", "column: valor", "```",
    ].join("\n");
  } else if (kind === "vectorfield2d") {
    generatedCode = `\`\`\`vectorfield2d\nfield: ${JSON.stringify([fieldX, fieldY])}\nxDomain: [${fieldXMin}, ${fieldXMax}]\nyDomain: [${fieldYMin}, ${fieldYMax}]\ndensity: ${fieldDensity}\ncolor: ${JSON.stringify(fieldColor)}\n\`\`\``;
  } else {
    generatedCode = `\`\`\`slider\nname: ${sliderName}\nmin: ${sliderMin}\nmax: ${sliderMax}\nstep: ${sliderStep}\ndefault: ${sliderDefault}\n\`\`\``;
  }

  if (coefficients.length && !invalidCoefficient) {
    const parameters = coefficients.map(({ name, value }) => ({
      name, min: Math.min(-3, value), max: Math.max(3, value), step: 0.1, default: value,
    }));
    const fence = String.fromCharCode(96).repeat(3);
    const config = JSON.stringify({ enabled: true, parameters });
    generatedCode = generatedCode.slice(0, -fence.length) + "paramControls: " + config + "\n" + fence;
  }

  const handleConfirm = () => {
    if (error) return;
    onInsert(`\n${generatedCode}\n`);
    onClose();
  };

  return (
    <div className="bwjm-modal-overlay" onClick={onClose}>
      <div className="bwjm-modal-container bwjm-chart-modal" role="dialog" aria-modal="true" aria-labelledby="bwjm-chart-title" onClick={(e) => e.stopPropagation()}>
        <div className="bwjm-modal-header">
          <div className="bwjm-modal-title">
            <IconBarChart size={18} />
            <h2 id="bwjm-chart-title">Insertar gráfica</h2>
          </div>
          <button className="bwjm-modal-close" onClick={onClose} aria-label="Cerrar">
            <IconX size={16} />
          </button>
        </div>

        <div className="bwjm-modal-body">
          <div className="bwjm-tabs-bar" role="group" aria-label="Tipo de gráfica">
            {chartKinds.map(([id, label]) => <button key={id} type="button"
              className={"bwjm-tab-item" + (kind === id ? " active" : "")}
              aria-pressed={kind === id} onClick={() => setKind(id)}>
              <ChartKindIcon kind={id} />
              <span>{label}</span>
            </button>)}
          </div>

          {kind === "calculus" && (
            <CalculusWizard onInsert={(block) => { onInsert(block); onClose(); }} />
          )}
          {kind === "flow2d" && <div className="bwjm-modal-grid">
            <ChartColorInput label="Color de las trayectorias" value={flowColor} onChange={setFlowColor} />
            <p style={{ gridColumn: "1 / -1", color: "var(--text-muted)" }}>
              Inserta un campo rotacional 2D con partículas que siguen sus líneas de corriente mediante RK4. Edita después el campo y las semillas directamente en el archivo.
            </p>
          </div>}
          {kind === "crossproduct" && <div className="bwjm-modal-grid">
            <ChartColorInput label="Color del vector u" value={crossColor} onChange={setCrossColor} />
            <p style={{ gridColumn: "1 / -1", color: "var(--text-muted)" }}>
              Después de insertar, abre Personalizar gráfica para mover los vectores y cambiar las capas.
            </p>
          </div>}
          {kind === "parametric2d" && (
            <div className="bwjm-modal-grid">
              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">x(t)</label>
                <input className="bwjm-modal-input" value={curveX} onChange={e => setCurveX(e.target.value)} />
              </div>
              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">y(t)</label>
                <input className="bwjm-modal-input" value={curveY} onChange={e => setCurveY(e.target.value)} />
              </div>
              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">t mínimo</label>
                <input className="bwjm-modal-input" aria-label="t mínimo" aria-describedby="bwjm-curve-domain-help" value={curveTMin} onChange={e => setCurveTMin(e.target.value)} />
              </div>
              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">t máximo</label>
                <input className="bwjm-modal-input" aria-label="t máximo" aria-describedby="bwjm-curve-domain-help" value={curveTMax} onChange={e => setCurveTMax(e.target.value)} />
              </div>
              <ChartColorInput label="Color de la curva" value={parametricColor} onChange={setParametricColor} />
            </div>
          )}
          {kind === "experiment" && (
            <div className="bwjm-modal-grid">
              <div className="bwjm-modal-field full-width">
                <label className="bwjm-modal-label">Expresión a muestrear</label>
                <input className="bwjm-modal-input" value={sampleFormula} onChange={e => setSampleFormula(e.target.value)} />
              </div>
              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">Mínimo</label>
                <input className="bwjm-modal-input" value={sampleMin} onChange={e => setSampleMin(e.target.value)} />
              </div>
              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">Máximo</label>
                <input className="bwjm-modal-input" value={sampleMax} onChange={e => setSampleMax(e.target.value)} />
              </div>
              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">Número de muestras (2 a 500)</label>
                <input className="bwjm-modal-input" value={sampleCount} onChange={e => setSampleCount(e.target.value)} />
              </div>
              <ChartColorInput label="Color del gráfico" value={experimentColor} onChange={setExperimentColor} />
            </div>
          )}
          {kind === "plot2d" && (
            <div className="bwjm-modal-grid">
              <div className="bwjm-modal-field full-width">
                <label className="bwjm-modal-label">Ecuación y = f(x)</label>
                <input
                  type="text"
                  className="bwjm-modal-input"
                  value={eq2d}
                  onChange={(e) => setEq2d(e.target.value)}
                  placeholder="Ej. sin(x), x^2, a * x"
                />
              </div>

              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">Dominio X mínimo</label>
                <input
                  type="text"
                  className="bwjm-modal-input"
                  value={xMin2d}
                  onChange={(e) => setXMin2d(e.target.value)}
                />
              </div>

              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">Dominio X máximo</label>
                <input
                  type="text"
                  className="bwjm-modal-input"
                  value={xMax2d}
                  onChange={(e) => setXMax2d(e.target.value)}
                />
              </div>

              <ChartColorInput label="Color del trazo" value={color2d} onChange={setColor2d} />

            </div>
          )}

          {kind === "surface3d" && (
            <div className="bwjm-modal-grid">
              <fieldset className="bwjm-surface-presets full-width">
                <legend>Forma inicial</legend>
                <div className="bwjm-surface-choices">
                  {surfacePresets.map(([id, label, equation]) => <button key={id} type="button"
                    aria-pressed={eq3d === equation} onClick={() => setEq3d(equation)}>
                    <ChartKindIcon kind={id} />
                    <span>{label}</span>
                  </button>)}
                </div>
              </fieldset>
              <div className="bwjm-modal-field full-width">
                <label className="bwjm-modal-label">Ecuación z = f(x, y)</label>
                <input
                  type="text"
                  className="bwjm-modal-input"
                  value={eq3d}
                  onChange={(e) => setEq3d(e.target.value)}
                  placeholder="Ej. sin(sqrt(x^2 + y^2))"
                />
              </div>

              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">X [mín, máx]</label>
                <div className="bwjm-range-fields">
                  <input
                    type="text"
                    className="bwjm-modal-input"
                    value={xMin3d}
                    onChange={(e) => setXMin3d(e.target.value)}
                  />
                  <input
                    type="text"
                    className="bwjm-modal-input"
                    value={xMax3d}
                    onChange={(e) => setXMax3d(e.target.value)}
                  />
                </div>
              </div>

              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">Y [mín, máx]</label>
                <div className="bwjm-range-fields">
                  <input
                    type="text"
                    className="bwjm-modal-input"
                    value={yMin3d}
                    onChange={(e) => setYMin3d(e.target.value)}
                  />
                  <input
                    type="text"
                    className="bwjm-modal-input"
                    value={yMax3d}
                    onChange={(e) => setYMax3d(e.target.value)}
                  />
                </div>
              </div>

              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">Muestras por eje</label>
                <input
                  type="number"
                  className="bwjm-modal-input"
                  value={samples3d}
                  onChange={(e) => setSamples3d(e.target.value)}
                />
              </div>

              <label className="bwjm-modal-field">
                <span className="bwjm-modal-label">Color de la superficie</span>
                <select className="bwjm-modal-input" value={surfaceSolid ? "solid" : "height"}
                  onChange={event => setSurfaceSolid(event.target.value === "solid")}>
                  <option value="height">Escala por altura</option>
                  <option value="solid">Color uniforme</option>
                </select>
              </label>
              {surfaceSolid && <ChartColorInput label="Color uniforme" value={surfaceColor} onChange={setSurfaceColor} />}
            </div>
          )}

          {kind === "curve3d" && (
            <div className="bwjm-modal-grid">
              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">x(t)</label>
                <input
                  type="text"
                  className="bwjm-modal-input"
                  value={curveX}
                  onChange={(e) => setCurveX(e.target.value)}
                  placeholder="cos(t)"
                />
              </div>
              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">y(t)</label>
                <input
                  type="text"
                  className="bwjm-modal-input"
                  value={curveY}
                  onChange={(e) => setCurveY(e.target.value)}
                  placeholder="sin(t)"
                />
              </div>
              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">z(t)</label>
                <input
                  type="text"
                  className="bwjm-modal-input"
                  value={curveZ}
                  onChange={(e) => setCurveZ(e.target.value)}
                  placeholder="t / 3"
                />
              </div>
              <ChartColorInput label="Color de la curva" value={curveColor} onChange={setCurveColor} />
              <div className="bwjm-modal-field full-width">
                <label className="bwjm-modal-label">Dominio del parámetro t [mín, máx]</label>
                <div className="bwjm-modal-range-group">
                  <input
                    type="text"
                    className="bwjm-modal-input"
                    value={curveTMin}
                    aria-label="t mínimo"
                    aria-describedby="bwjm-curve-domain-help"
                    onChange={(e) => setCurveTMin(e.target.value)}
                  />
                  <input
                    type="text"
                    className="bwjm-modal-input"
                    value={curveTMax}
                    aria-label="t máximo"
                    aria-describedby="bwjm-curve-domain-help"
                    onChange={(e) => setCurveTMax(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {kind === "vectorfield2d" && (
            <div className="bwjm-modal-grid">
              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">Componente P(x, y)</label>
                <input
                  type="text"
                  className="bwjm-modal-input"
                  value={fieldX}
                  onChange={(e) => setFieldX(e.target.value)}
                  placeholder="-y"
                />
              </div>
              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">Componente Q(x, y)</label>
                <input
                  type="text"
                  className="bwjm-modal-input"
                  value={fieldY}
                  onChange={(e) => setFieldY(e.target.value)}
                  placeholder="x"
                />
              </div>
              <div className="bwjm-modal-field full-width">
                <label className="bwjm-modal-label">Dominio X [mín, máx]</label>
                <div className="bwjm-modal-range-group">
                  <input
                    type="text"
                    className="bwjm-modal-input"
                    value={fieldXMin}
                    onChange={(e) => setFieldXMin(e.target.value)}
                  />
                  <input
                    type="text"
                    className="bwjm-modal-input"
                    value={fieldXMax}
                    onChange={(e) => setFieldXMax(e.target.value)}
                  />
                </div>
              </div>
              <div className="bwjm-modal-field full-width">
                <label className="bwjm-modal-label">Dominio Y [mín, máx]</label>
                <div className="bwjm-modal-range-group">
                  <input
                    type="text"
                    className="bwjm-modal-input"
                    value={fieldYMin}
                    onChange={(e) => setFieldYMin(e.target.value)}
                  />
                  <input
                    type="text"
                    className="bwjm-modal-input"
                    value={fieldYMax}
                    onChange={(e) => setFieldYMax(e.target.value)}
                  />
                </div>
              </div>
              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">Densidad de flechas</label>
                <input
                  type="number"
                  className="bwjm-modal-input"
                  value={fieldDensity}
                  onChange={(e) => setFieldDensity(e.target.value)}
                />
              </div>
              <ChartColorInput label="Color de las flechas" value={fieldColor} onChange={setFieldColor} />
            </div>
          )}

          {kind === "slider" && (
            <div className="bwjm-modal-grid">
              <p style={{ gridColumn: "1 / -1", color: "#64748b", fontSize: "0.8rem" }}>
                El mismo parámetro puede usarse en varias gráficas.
              </p>
              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">Nombre del Parámetro</label>
                <input
                  type="text"
                  className="bwjm-modal-input"
                  value={sliderName}
                  onChange={(e) => setSliderName(e.target.value)}
                  placeholder="Ej. a, omega, n"
                />
              </div>

              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">Valor Inicial (Default)</label>
                <input
                  type="number"
                  step="any"
                  className="bwjm-modal-input"
                  value={sliderDefault}
                  onChange={(e) => setSliderDefault(e.target.value)}
                />
              </div>

              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">Mínimo</label>
                <input
                  type="number"
                  step="any"
                  className="bwjm-modal-input"
                  value={sliderMin}
                  onChange={(e) => setSliderMin(e.target.value)}
                />
              </div>

              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">Máximo</label>
                <input
                  type="number"
                  step="any"
                  className="bwjm-modal-input"
                  value={sliderMax}
                  onChange={(e) => setSliderMax(e.target.value)}
                />
              </div>

              <div className="bwjm-modal-field">
                <label className="bwjm-modal-label">Paso</label>
                <input
                  type="number"
                  step="any"
                  className="bwjm-modal-input"
                  value={sliderStep}
                  onChange={(e) => setSliderStep(e.target.value)}
                />
              </div>
            </div>
          )}

          {hasCurveDomain && <p id="bwjm-curve-domain-help" className="bwjm-chart-domain-help">Admite π, 2pi y π/2.</p>}
          {coefficients.length > 0 && <fieldset className="bwjm-chart-coefficients">
            <legend>Coeficientes</legend>
            <div className="bwjm-modal-grid">
              {coefficients.map(({ name, text }) => <label key={name} className="bwjm-modal-field">
                <span className="bwjm-modal-label">{name}</span>
                <input type="number" step="any" className="bwjm-modal-input" value={text}
                  onChange={event => {
                    const value = event.target.value;
                    setCoefficientValues(previous => ({
                      ...previous, [kind]: { ...previous[kind], [name]: value },
                    }));
                  }} />
              </label>)}
            </div>
          </fieldset>}
          {error && <p role="alert" className="bwjm-calculus-error">{error}</p>}
          {kind !== "calculus" && <details className="bwjm-chart-source">
            <summary>Ver código .bwjm</summary>
            <pre className="bwjm-code-preview">
              <code>{generatedCode}</code>
            </pre>
          </details>}
        </div>

        <div className="bwjm-modal-footer">
          <button className="bwjm-btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          {kind !== "calculus" && <button className="bwjm-btn-primary" disabled={Boolean(error)} onClick={handleConfirm}>
            <IconCheck size={14} />
            <span>Insertar</span>
          </button>}
        </div>
      </div>
    </div>
  );
};
