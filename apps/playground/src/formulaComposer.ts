/** Formula composition shared by the guided editor and its tests. */
export type FormulaMode = "inline" | "block" | "numbered";
export type FormulaKind =
  | "expression" | "fraction" | "root" | "power" | "integral"
  | "sum" | "limit" | "derivative" | "matrix";

export interface FormulaField {
  key: string;
  label: string;
  value: string;
  placeholder: string;
}
export interface FormulaTemplate {
  id: FormulaKind;
  label: string;
  symbol: string;
  description: string;
  fields: readonly FormulaField[];
}
export type FormulaValues = Record<string, string>;

export const FORMULA_TEMPLATES: readonly FormulaTemplate[] = [
  { id: "expression", label: "Expresión", symbol: "x + y", description: "Escribe una expresión matemática",
    fields: [{ key: "expression", label: "Expresión matemática", value: "x^2 + 1", placeholder: "Ej. x^2 + 1" }] },
  { id: "fraction", label: "Fracción", symbol: "a/b", description: "Numerador sobre denominador",
    fields: [
      { key: "top", label: "Numerador", value: "a+b", placeholder: "Ej. a+b" },
      { key: "bottom", label: "Denominador", value: "c", placeholder: "Ej. c" },
    ] },
  { id: "root", label: "Raíz", symbol: "√x", description: "Raíz cuadrada",
    fields: [{ key: "radicand", label: "Número o expresión dentro de la raíz", value: "x+1", placeholder: "Ej. x+1" }] },
  { id: "power", label: "Potencia", symbol: "xⁿ", description: "Base y exponente",
    fields: [
      { key: "base", label: "Base", value: "x", placeholder: "Ej. x" },
      { key: "exponent", label: "Exponente", value: "2", placeholder: "Ej. 2" },
    ] },
  { id: "integral", label: "Integral", symbol: "∫", description: "Integral definida con límites",
    fields: [
      { key: "lower", label: "Límite inferior", value: "0", placeholder: "Ej. 0" },
      { key: "upper", label: "Límite superior", value: "1", placeholder: "Ej. 1" },
      { key: "integrand", label: "Función a integrar", value: "x^2", placeholder: "Ej. x^2" },
      { key: "variable", label: "Variable de integración", value: "x", placeholder: "Ej. x" },
    ] },
  { id: "sum", label: "Sumatoria", symbol: "Σ", description: "Suma con índice y límites",
    fields: [
      { key: "index", label: "Índice", value: "i", placeholder: "Ej. i" },
      { key: "lower", label: "Desde", value: "1", placeholder: "Ej. 1" },
      { key: "upper", label: "Hasta", value: "n", placeholder: "Ej. n" },
      { key: "term", label: "Término", value: "i^2", placeholder: "Ej. i^2" },
    ] },
  { id: "limit", label: "Límite", symbol: "lim", description: "Límite de una expresión",
    fields: [
      { key: "variable", label: "Variable", value: "x", placeholder: "Ej. x" },
      { key: "approaches", label: "Se aproxima a", value: "0", placeholder: "Ej. 0" },
      { key: "expression", label: "Función", value: "\\frac{\\sin x}{x}", placeholder: "Ej. x^2" },
    ] },
  { id: "derivative", label: "Derivada", symbol: "d/dx", description: "Derivada respecto de una variable",
    fields: [
      { key: "function", label: "Función", value: "x^2", placeholder: "Ej. x^2" },
      { key: "variable", label: "Respecto de", value: "x", placeholder: "Ej. x" },
    ] },
  { id: "matrix", label: "Matriz 2×2", symbol: "[a b; c d]", description: "Matriz con cuatro celdas",
    fields: [
      { key: "a", label: "Fila 1, columna 1", value: "a", placeholder: "a" },
      { key: "b", label: "Fila 1, columna 2", value: "b", placeholder: "b" },
      { key: "c", label: "Fila 2, columna 1", value: "c", placeholder: "c" },
      { key: "d", label: "Fila 2, columna 2", value: "d", placeholder: "d" },
    ] },
];

export function getFormulaTemplate(kind: FormulaKind): FormulaTemplate {
  const found = FORMULA_TEMPLATES.find(item => item.id === kind);
  if (!found) throw new Error("Tipo de fórmula desconocido");
  return found;
}

export function defaultFormulaValues(kind: FormulaKind): FormulaValues {
  return Object.fromEntries(getFormulaTemplate(kind).fields.map(field => [field.key, field.value]));
}

/** Remove math fences pasted from Markdown without altering the inner LaTeX. */
export function normalizeFormulaInput(source: string): string {
  let tex = source.trim();
  if (tex.startsWith("$$") && tex.endsWith("$$") && tex.length > 4) {
    tex = tex.slice(2, -2).trim();
  } else if (tex.startsWith("$") && tex.endsWith("$") && tex.length > 2) {
    tex = tex.slice(1, -1).trim();
  } else if (tex.startsWith("\\[") && tex.endsWith("\\]")) {
    tex = tex.slice(2, -2).trim();
  } else if (tex.startsWith("\\(") && tex.endsWith("\\)")) {
    tex = tex.slice(2, -2).trim();
  }
  return tex;
}

export function buildGuidedFormula(kind: FormulaKind, values: FormulaValues): string {
  const value = (key: string) => (values[key] ?? "").trim();
  const group = (key: string) => "{" + value(key) + "}";
  switch (kind) {
    case "expression": return value("expression");
    case "fraction": return "\\frac" + group("top") + group("bottom");
    case "root": return "\\sqrt" + group("radicand");
    case "power": return group("base") + "^" + group("exponent");
    case "integral":
      return "\\int_" + group("lower") + "^" + group("upper") +
        " " + value("integrand") + "\\,d" + value("variable");
    case "sum":
      return "\\sum_{" + value("index") + "=" + value("lower") + "}^" +
        group("upper") + " " + value("term");
    case "limit":
      return "\\lim_{" + value("variable") + "\\to " + value("approaches") +
        "} " + value("expression");
    case "derivative":
      return "\\frac{d}{d" + value("variable") + "}\\left(" + value("function") + "\\right)";
    case "matrix":
      return "\\begin{bmatrix}" + value("a") + " & " + value("b") +
        " \\\\ " + value("c") + " & " + value("d") + "\\end{bmatrix}";
  }
}

export function serializeFormula(source: string, mode: FormulaMode, label = "1"): string {
  const tex = normalizeFormulaInput(source);
  if (!tex) throw new Error("La fórmula está vacía");
  const cleanLabel = label.trim() || "1";
  if (mode === "numbered" && !/^[\p{L}\p{N} .()_-]{1,40}$/u.test(cleanLabel)) {
    throw new Error("El número debe tener entre 1 y 40 letras o números");
  }
  const body = mode === "numbered" ? tex + " \\tag{" + cleanLabel + "}" : tex;
  return mode === "inline" ? "$" + body + "$" : "\n\n$$\n" + body + "\n$$\n\n";
}
