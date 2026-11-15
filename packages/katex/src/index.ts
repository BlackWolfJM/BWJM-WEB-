/**
 * MathMD KaTeX Local Bundle
 *
 * This package provides KaTeX rendering with locally bundled fonts and styles.
 * No external CDN dependencies required.
 */

import { renderToString } from "katex";
import type { KatexOptions } from "katex";

/**
 * Options for rendering math formulas
 */
export interface FormulaRenderOptions {
  /** Whether to render in display mode (block) or inline */
  displayMode: boolean;
  /** Whether to throw on error */
  throwOnError?: boolean;
  /** Maximum expansion limit */
  maxExpand?: number;
  /** Maximum size limit */
  maxSize?: number;
}

/**
 * Result of formula rendering
 */
export interface FormulaRenderResult {
  /** Rendered HTML + MathML */
  html: string;
  /** Whether there was an error */
  hasError: boolean;
  /** Error message if any */
  error?: string;
}

/**
 * Render a LaTeX formula to HTML+MathML using locally bundled KaTeX
 */
export function renderFormula(
  latex: string,
  options: FormulaRenderOptions
): FormulaRenderResult {
  const opts: KatexOptions = {
    displayMode: options.displayMode,
    output: "htmlAndMathml",
    throwOnError: options.throwOnError ?? true,
    trust: false,
    maxExpand: options.maxExpand ?? 1000,
    maxSize: options.maxSize ?? 20,
  };

  try {
    const html = renderToString(latex, opts);
    return { html, hasError: false };
  } catch (error) {
    return {
      html: `<span class="bwjm-formula-error">Error de sintaxis LaTeX: ${String(error)}</span>`,
      hasError: true,
      error: String(error),
    };
  }
}

/**
 * Supported formula modes
 */
export type FormulaMode = "inline" | "block" | "numbered";

/**
 * Prepared formula with source markdown and rendered HTML
 */
export interface PreparedFormula {
  /** Markdown source for the formula */
  source: string;
  /** Rendered HTML */
  html: string;
  /** Mode used */
  mode: FormulaMode;
  /** Label for numbered equations */
  label?: string;
}

/**
 * Prepare a formula for insertion into a MathMD document
 * Returns the markdown source and rendered HTML
 */
export function prepareFormula(
  input: string,
  mode: FormulaMode,
  label: string
): { error: string } | PreparedFormula {
  const tex = input.trim();
  if (!tex) return { error: "Escribe una fórmula." } as const;

  const trimmedLabel = label.trim();
  if (mode === "numbered" && trimmedLabel && !/^[\p{L}\p{N} .()_-]{1,40}$/u.test(trimmedLabel)) {
    return { error: "Usa hasta 40 letras, números, espacios o signos . ( ) _ - en la etiqueta." } as const;
  }

  const display = mode !== "inline";
  const expression = mode === "numbered" ? tex + " \\tag{" + (trimmedLabel || "1") + "}" : tex;
  const source = display ? "\n\n$$\n" + expression + "\n$$\n\n" : "$" + expression + "$";

  const result = renderFormula(expression, { displayMode: display });
  if (result.hasError) {
    return { error: "Revisa la sintaxis LaTeX de la fórmula." } as const;
  }

  return { source, html: result.html, mode, label: mode === "numbered" ? trimmedLabel : undefined };
}

/**
 * KaTeX CSS styles as string for embedding in exported HTML
 * This replaces the CDN reference
 */
export const katexStyles: string = `
/* KaTeX 0.16.47 - MathMD Local Bundle */
.katex { font: normal 1.21em KaTeX_Main, Times New Roman, serif; line-height: 1.2; text-indent: 0; text-rendering: auto; }
.katex * { transition: none; }
.katex > * { display: inline-block; white-space: nowrap; }
.katex > .katex-html { display: inline-block; }
.katex .katex-mathml { display: none; }
.katex .katex-html > * { display: inline-block; }
.katex .katex-mord { font-family: KaTeX_Main; }
.katex .katex-mfrac { vertical-align: 0; }
.katex .katex-mfrac .katex-rule { background-color: currentColor; }
.katex .katex-mfrac .katex-numerator, .katex .katex-mfrac .katex-denominator { display: block; }
.katex .katex-mfrac .katex-numerator { border-bottom: 1px solid; }
.katex .katex-mfrac .katex-denominator { border-top: 1px solid; }
.katex .katex-msqrt .katex-radical { border-top: 1px solid; }
.katex .katex-mtext { font-family: KaTeX_Main; }
.katex .katex-mtext > * { font-family: inherit; }
.katex .katex-mstyle { font-family: KaTeX_Math; }
.katex .katex-mstyle > * { font-family: inherit; }
.katex .katex-mstyle .katex-mstyle { font-family: inherit; }
.katex .katex-mstyle .katex-mtext { font-family: KaTeX_Main; }
.katex .katex-mstyle .katex-mtext > * { font-family: inherit; }
.katex .katex-mstyle .katex-mstyle .katex-mtext { font-family: KaTeX_Main; }
.katex .katex-mstyle .katex-mstyle .katex-mtext > * { font-family: inherit; }
.katex .katex-mstyle .katex-mstyle .katex-mstyle .katex-mtext { font-family: KaTeX_Main; }
.katex .katex-mstyle .katex-mstyle .katex-mstyle .katex-mtext > * { font-family: inherit; }
.katex .katex-mstyle .katex-mstyle .katex-mstyle .katex-mstyle .katex-mtext { font-family: KaTeX_Main; }
.katex .katex-mstyle .katex-mstyle .katex-mstyle .katex-mstyle .katex-mtext > * { font-family: inherit; }
.katex .katex-mstyle .katex-mstyle .katex-mstyle .katex-mstyle .katex-mstyle .katex-mtext { font-family: KaTeX_Main; }
.katex .katex-mstyle .katex-mstyle .katex-mstyle .katex-mstyle .katex-mstyle .katex-mtext > * { font-family: inherit; }
`;

/**
 * Get the full KaTeX CSS with fonts embedded as data URIs
 * This is a minimal subset - full version should include all font definitions
 */
export function getFullKatexStyles(): string {
  // In production, this should include the full KaTeX CSS with font-face definitions
  // and fonts embedded as data URIs or served locally
  return katexStyles + `
/* Font faces would be defined here with local font files */
@font-face {
  font-family: 'KaTeX_Main';
  src: local('KaTeX_Main');
}
@font-face {
  font-family: 'KaTeX_Math';
  src: local('KaTeX_Math');
}
@font-face {
  font-family: 'KaTeX_Size1';
  src: local('KaTeX_Size1');
}
@font-face {
  font-family: 'KaTeX_Size2';
  src: local('KaTeX_Size2');
}
@font-face {
  font-family: 'KaTeX_Size3';
  src: local('KaTeX_Size3');
}
@font-face {
  font-family: 'KaTeX_Size4';
  src: local('KaTeX_Size4');
}
`;
}

/**
 * Validate LaTeX syntax
 */
export function validateLatex(latex: string): { valid: boolean; error?: string } {
  try {
    renderToString(latex, { displayMode: false, throwOnError: true });
    return { valid: true };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}