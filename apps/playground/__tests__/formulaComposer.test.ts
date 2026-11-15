import { describe, expect, it } from "vitest";
import { renderToString } from "katex";
import { parseMarkdown } from "@mathmd/parser";
import {
  FORMULA_TEMPLATES, defaultFormulaValues, buildGuidedFormula,
  normalizeFormulaInput, serializeFormula,
} from "../src/formulaComposer.js";

describe("Visual formula composer", () => {
  it("generates valid KaTeX for every guided formula type", () => {
    for (const template of FORMULA_TEMPLATES) {
      const latex = buildGuidedFormula(template.id, defaultFormulaValues(template.id));
      expect(latex.length).toBeGreaterThan(0);
      const html = renderToString(latex, { throwOnError: true, displayMode: true });
      expect(html).toContain("katex");
    }
  });

  it("creates a correct integral and a 2x2 matrix", () => {
    expect(buildGuidedFormula("integral", defaultFormulaValues("integral")))
      .toBe("\\int_{0}^{1} x^2\\,dx");
    const matrix = buildGuidedFormula("matrix", defaultFormulaValues("matrix"));
    expect(matrix).toContain("\\begin{bmatrix}");
    expect(matrix).toContain(" \\\\ ");
    expect(matrix).toContain("\\end{bmatrix}");
  });

  it("accepts pasted Markdown math wrappers without duplicating them", () => {
    const latex = "\\frac{1}{2}";
    expect(normalizeFormulaInput("$" + latex + "$")).toBe(latex);
    expect(normalizeFormulaInput("$$\n" + latex + "\n$$")).toBe(latex);
    expect(normalizeFormulaInput("\\(" + latex + "\\)")).toBe(latex);
    expect(normalizeFormulaInput("\\[" + latex + "\\]")).toBe(latex);
    expect(serializeFormula("$" + latex + "$", "inline")).toBe("$" + latex + "$");
    expect(serializeFormula("$$" + latex + "$$", "block")).toBe("\n\n$$\n" + latex + "\n$$\n\n");
  });

  it("inserts Markdown that the document reader parses as math", () => {
    const inline = parseMarkdown(serializeFormula("x^2+1", "inline"));
    const para = inline.children?.[0];
    expect(para?.type).toBe("paragraph");
    expect(para?.children?.[0]?.type).toBe("inlineMath");

    const block = parseMarkdown(serializeFormula("\\frac{x}{y}", "block"));
    expect(block.children?.[0]?.type).toBe("math");
    expect(block.children?.[0]?.value).toBe("\\frac{x}{y}");

    const numbered = parseMarkdown(serializeFormula("a+b", "numbered", "2"));
    expect(numbered.children?.[0]?.type).toBe("math");
    expect(numbered.children?.[0]?.value).toContain("\\tag{2}");
  });

  it("rejects empty formulas and unsafe equation labels", () => {
    expect(() => serializeFormula("", "inline")).toThrow();
    expect(() => serializeFormula("x^2", "numbered", "bad}tag")).toThrow();
  });

  it("retains field changes in generated LaTeX", () => {
    const fields = { ...defaultFormulaValues("fraction"), top: "x+1", bottom: "2" };
    expect(buildGuidedFormula("fraction", fields)).toBe("\\frac{x+1}{2}");
  });
});
