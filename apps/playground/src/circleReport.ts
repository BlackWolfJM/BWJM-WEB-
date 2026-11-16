import type { ConicNode } from "@mathmd/ast";
import { renderToString } from "katex";
import { resolveCircle, type CircleGeometry } from "./circleGeometry.js";
import { getCircleReadout } from "./circleReadout.js";

/** A compact, accessible definition list matching the trajectory data panel. */
export function buildCircleReport(node: ConicNode,
  geometry: CircleGeometry = resolveCircle(node)): HTMLElement {
  const section = document.createElement("section");
  section.className = "bwjm-curve-readout bwjm-circle-report";
  section.setAttribute("aria-label", "Datos de la circunferencia");

  const header = document.createElement("div");
  header.className = "bwjm-trajectory-header";
  const heading = document.createElement("strong");
  heading.textContent = "Datos de la circunferencia";
  header.appendChild(heading);
  section.appendChild(header);

  const values = document.createElement("dl");
  values.className = "bwjm-trajectory-values";
  for (const item of getCircleReadout(node, geometry)) {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    term.textContent = item.label;
    const detail = document.createElement("dd");
    if (item.math) {
      detail.innerHTML = renderToString(item.value, {
        displayMode: false, throwOnError: false, trust: false,
        maxExpand: 1000, maxSize: 20, output: "htmlAndMathml",
      });
      detail.setAttribute("aria-label", item.label + ": " + item.value);
    } else {
      detail.textContent = item.value;
    }
    row.append(term, detail);
    values.appendChild(row);
  }
  section.appendChild(values);
  return section;
}
