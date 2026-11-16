import type { ConicNode } from "@mathmd/ast";
import { renderToString } from "katex";
import { resolveCircle, type CircleGeometry } from "./circleGeometry.js";
import { getCircleReadout, type CircleReadoutMetric } from "./circleReadout.js";

const mathValue = (tex: string, label: string): HTMLElement => {
  const span = document.createElement("span");
  span.className = "bwjm-circle-math";
  span.innerHTML = renderToString(tex, {
    displayMode: false, throwOnError: false, trust: false,
    maxExpand: 1000, maxSize: 20, output: "htmlAndMathml",
  });
  span.title = label;
  return span;
};

const addReadoutValue = (parent: HTMLElement, item: CircleReadoutMetric): void => {
  if (item.math) {
    parent.appendChild(mathValue(item.value, item.label));
  } else {
    parent.textContent = item.value;
  }
};

const metric = (item: CircleReadoutMetric): HTMLElement => {
  const row = document.createElement("div");
  const label = document.createElement("dt");
  label.textContent = item.label;
  const value = document.createElement("dd");
  addReadoutValue(value, item);
  row.append(label, value);
  return row;
};

const section = (label: string, items: CircleReadoutMetric[], className = ""): HTMLElement => {
  const container = document.createElement("div");
  container.className = "bwjm-circle-section " + className;
  const heading = document.createElement("h4");
  heading.textContent = label;
  const list = document.createElement("dl");
  list.className = "bwjm-circle-detail-list";
  for (const item of items) list.appendChild(metric(item));
  container.append(heading, list);
  return container;
};

/**
 * One semantic report for both the inserted .bwjm graph and the composer preview.
 * The mathematical data always comes from getCircleReadout; no duplicate UI calculations.
 */
export function buildCircleReport(
  node: ConicNode,
  geometry: CircleGeometry = resolveCircle(node),
): HTMLElement {
  const items = getCircleReadout(node, geometry);
  const find = (label: string) => items.find(item => item.label === label);
  const select = (labels: string[]) =>
    labels.map(find).filter((item): item is CircleReadoutMetric => item !== undefined);

  const panel = document.createElement("section");
  panel.className = "bwjm-curve-readout bwjm-circle-report";
  panel.setAttribute("aria-label", "Propiedades de la circunferencia");

  const header = document.createElement("div");
  header.className = "bwjm-circle-report-header";
  const heading = document.createElement("h3");
  heading.textContent = "Propiedades de la circunferencia";
  const definition = document.createElement("span");
  definition.className = "bwjm-circle-mode";
  definition.textContent = find("Definición")?.value ?? "Circunferencia";
  header.append(heading, definition);
  panel.appendChild(header);

  if (node.showEquation !== false) {
    const equation = find("Ecuación canónica");
    if (equation) {
      const formula = document.createElement("div");
      formula.className = "bwjm-circle-main-equation";
      const caption = document.createElement("span");
      caption.className = "bwjm-circle-eyebrow";
      caption.textContent = "Ecuación canónica";
      const math = document.createElement("div");
      math.className = "bwjm-circle-main-equation-math";
      addReadoutValue(math, equation);
      formula.append(caption, math);
      panel.appendChild(formula);
    }
  }

  const highlights = document.createElement("dl");
  highlights.className = "bwjm-circle-highlights";
  for (const item of select(["Centro", "Radio", "Diámetro"])) {
    highlights.appendChild(metric(item));
  }
  panel.appendChild(highlights);

  const details = document.createElement("div");
  details.className = "bwjm-circle-details";
  details.appendChild(section("Medidas", select(["Longitud de circunferencia", "Área del círculo"])));
  details.appendChild(section("Intersecciones", select(["Cortes con eje X", "Cortes con eje Y"])));
  panel.appendChild(details);

  const general = find("Ecuación general");
  if (general && node.showEquation !== false) {
    panel.appendChild(section("Forma general", [general], "bwjm-circle-general"));
  }
  const angles = items.filter(item =>
    item.label.startsWith("Dirección") || item.label.startsWith("Cuerda:") ||
    item.label.startsWith("Secante:") || item.label.startsWith("Punto de tangencia:"));
  if (angles.length) panel.appendChild(section("Ángulos en radianes", angles, "bwjm-circle-angles"));
  return panel;
}
