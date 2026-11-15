import { renderToString } from "katex";
import { parseMarkdown } from "@mathmd/parser";

export type FormulaMode = "inline" | "block" | "numbered";

export function typesetFormula(tex: string, displayMode: boolean): string {
  return renderToString(tex, {
    displayMode,
    output: "htmlAndMathml",
    throwOnError: true,
    trust: false,
    maxExpand: 1000,
    maxSize: 20,
  });
}

export function prepareFormula(input: string, mode: FormulaMode, number: string) {
  const tex = input.trim();
  if (!tex) return { error: "Escribe una fórmula." } as const;
  const label = number.trim();
  if (mode === "numbered" && label && !/^[\p{L}\p{N} .()_-]{1,40}$/u.test(label)) {
    return { error: "Usa hasta 40 letras, números, espacios o signos . ( ) _ - en la etiqueta." } as const;
  }
  const display = mode !== "inline";
  const expression = mode === "numbered" ? tex + " \\tag{" + (label || "1") + "}" : tex;
  const source = display ? "\n\n$$\n" + expression + "\n$$\n\n" : "$" + expression + "$";
  const nodes = parseMarkdown(source).children;
  const node = nodes?.length === 1 ? nodes[0] : undefined;
  const math = display ? node : node?.children?.length === 1 ? node.children[0] : undefined;
  if (math?.type !== (display ? "math" : "inlineMath") ||
    math.value?.replace(/\r\n?/g, "\n") !== expression.replace(/\r\n?/g, "\n")) {
    return { error: "Escribe solo el contenido LaTeX. Usa el modo en bloque para fórmulas de varias líneas." } as const;
  }
  try {
    return { source, html: typesetFormula(expression, display) } as const;
  } catch {
    return { error: "Revisa la sintaxis LaTeX de la fórmula." } as const;
  }
}