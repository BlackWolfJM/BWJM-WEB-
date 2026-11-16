import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CircleComposer } from "../src/CircleComposer.js";
import { circleFromCenterRadius } from "../src/circleGeometry.js";
import { getCircleReadout } from "../src/circleReadout.js";

describe("Circle panel presentation", () => {
  it("uses a dedicated preview mount instead of a hardcoded blue plain-text report", () => {
    const html = renderToStaticMarkup(React.createElement(CircleComposer, {
      onInsert: () => {}, onClose: () => {},
    }));
    expect(html).toContain("Vista previa de las propiedades matemáticas");
    expect(html).toContain("bwjm-circle-preview-report");
    expect(html).not.toContain("Ecuación: (");
    expect(html).not.toContain('class="bwjm-calculus-report"');
  });

  it("updates the mathematical values when the center and radius change", () => {
    const before = getCircleReadout({mode:"center-radius",showEquation:true},
      circleFromCenterRadius([0,0],3));
    const after = getCircleReadout({mode:"center-radius",showEquation:true},
      circleFromCenterRadius([-4.62,3.48],5.25));
    const value = (rows: typeof before, label: string) => rows.find(item => item.label===label)?.value;
    expect(value(before,"Longitud de circunferencia")).toBe("6\\pi");
    expect(value(after,"Longitud de circunferencia")).toBe("10.5\\pi");
    expect(value(after,"Área del círculo")).toBe("27.5625\\pi");
    expect(value(before,"Centro")).not.toBe(value(after,"Centro"));
    expect(value(after,"Ecuación canónica")).toContain("(x+4.62)^2");
  });
});
