import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RIBBON_GROUPS } from "../src/Ribbon.js";
import { chartKinds, ChartModal } from "../src/ChartModal.js";
import { ConicComposer } from "../src/ConicComposer.js";

describe("Unified graphics and conics entry", () => {
  it("exposes just one insertion action in the ribbon", () => {
    const graphActions = RIBBON_GROUPS.Insertar.flatMap(group => group.actions)
      .filter(action => action.icon === "graph");
    expect(graphActions).toHaveLength(1);
    expect(graphActions[0].id).toBe("graph");
    expect(graphActions[0].label).toBe("Gráficos y superficies");
    const ids: string[] = RIBBON_GROUPS.Insertar.flatMap(group => group.actions).map(action => action.id);
    expect(ids).not.toContain("conic");
  });

  it("lists the four conics under one gallery category, without a separate circle tab", () => {
    const choices = chartKinds.map(([id]) => id);
    expect(choices).toContain("conics");
    expect(choices).not.toContain("circle");
    expect(choices.filter(id => id === "conics")).toHaveLength(1);
  });

  it("renders the shared cónicas selector with all four existing figures", () => {
    const html = renderToStaticMarkup(React.createElement(ConicComposer,
      { onClose: () => {}, onInsert: () => {} }));
    expect(html).toContain("Tipo de cónica");
    for(const label of ["Circunferencia", "Elipse", "Parábola", "Hipérbola"])
      expect(html).toContain(label);
    // The circle builder's detailed modes remain available in the unified dialog.
    expect(html).toContain("Tres puntos no colineales");
    expect(html).toContain("Ecuación general");
  });

  it("keeps the main graphs dialog and its existing categories", () => {
    const html = renderToStaticMarkup(React.createElement(ChartModal,
      { isOpen: true, documentVariables: [], onClose: () => {}, onInsert: () => {} }));
    for(const label of ["Cónicas","Superficie 3D","Campo vectorial 2D","Áreas e integrales"])
      expect(html).toContain(label);
  });
});
