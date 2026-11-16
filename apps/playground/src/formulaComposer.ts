/** Formula composition shared by the guided editor and its tests. */
export type FormulaMode = "inline" | "block" | "numbered";
export type FormulaKind =
  | "expression" | "fraction" | "root" | "power" | "integral"
  | "sum" | "limit" | "derivative" | "matrix"
  | "partial" | "mixed-partial" | "gradient" | "directional" | "jacobian"
  | "hessian" | "double-integral" | "triple-integral" | "iterated-triple"
  | "line-integral" | "surface-integral" | "vector" | "matrix3"
  | "system" | "cases" | "aligned" | "parametric" | "polar";

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
  { id: "partial", label: "Derivada parcial", symbol: "∂/∂x", description: "Derivada parcial",
    fields: [{ key: "function", label: "Función", value: "f(x,y)", placeholder: "" }, { key: "variable", label: "Respecto de", value: "x", placeholder: "" }] },
  { id: "mixed-partial", label: "Derivada parcial mixta", symbol: "∂²", description: "Derivada parcial mixta",
    fields: [{ key: "function", label: "Función", value: "f(x,y)", placeholder: "" }, { key: "first", label: "Primera variable", value: "x", placeholder: "" }, { key: "second", label: "Segunda variable", value: "y", placeholder: "" }] },
  { id: "gradient", label: "Gradiente", symbol: "∇f", description: "Gradiente",
    fields: [{ key: "function", label: "Función", value: "f", placeholder: "" }, { key: "x", label: "Componente x", value: "f_x", placeholder: "" }, { key: "y", label: "Componente y", value: "f_y", placeholder: "" }, { key: "z", label: "Componente z", value: "f_z", placeholder: "" }] },
  { id: "directional", label: "Derivada direccional", symbol: "Dᵤf", description: "Derivada direccional",
    fields: [{ key: "function", label: "Función", value: "f", placeholder: "" }, { key: "direction", label: "Dirección", value: "\\\\mathbf{u}", placeholder: "" }] },
  { id: "jacobian", label: "Jacobiano de dos variables", symbol: "J", description: "Jacobiano de dos variables",
    fields: [{ key: "x", label: "Primera función", value: "x(u,v)", placeholder: "" }, { key: "y", label: "Segunda función", value: "y(u,v)", placeholder: "" }, { key: "u", label: "Variable u", value: "u", placeholder: "" }, { key: "v", label: "Variable v", value: "v", placeholder: "" }] },
  { id: "hessian", label: "Matriz hessiana", symbol: "H", description: "Matriz hessiana",
    fields: [{ key: "function", label: "Función", value: "f", placeholder: "" }] },
  { id: "double-integral", label: "Integral doble", symbol: "∬", description: "Integral doble",
    fields: [{ key: "region", label: "Región", value: "D", placeholder: "" }, { key: "integrand", label: "Integrando", value: "f(x,y)", placeholder: "" }, { key: "differential", label: "Elemento", value: "dA", placeholder: "" }] },
  { id: "triple-integral", label: "Integral triple", symbol: "∭", description: "Integral triple",
    fields: [{ key: "region", label: "Región", value: "E", placeholder: "" }, { key: "integrand", label: "Integrando", value: "f(x,y,z)", placeholder: "" }, { key: "differential", label: "Elemento", value: "dV", placeholder: "" }] },
  { id: "iterated-triple", label: "Integral triple iterada", symbol: "∫∫∫", description: "Integral triple iterada",
    fields: [{ key: "a", label: "Límite exterior inferior", value: "a", placeholder: "" }, { key: "b", label: "Límite exterior superior", value: "b", placeholder: "" }, { key: "c", label: "Límite medio inferior", value: "c", placeholder: "" }, { key: "d", label: "Límite medio superior", value: "d", placeholder: "" }, { key: "e", label: "Límite interior inferior", value: "e", placeholder: "" }, { key: "f", label: "Límite interior superior", value: "f", placeholder: "" }, { key: "function", label: "Integrando", value: "g(x,y,z)", placeholder: "" }] },
  { id: "line-integral", label: "Integral de línea", symbol: "∮", description: "Integral de línea",
    fields: [{ key: "curve", label: "Curva", value: "C", placeholder: "" }, { key: "field", label: "Campo", value: "\\\\mathbf{F}", placeholder: "" }] },
  { id: "surface-integral", label: "Integral de superficie", symbol: "∬S", description: "Integral de superficie",
    fields: [{ key: "surface", label: "Superficie", value: "S", placeholder: "" }, { key: "field", label: "Campo", value: "\\\\mathbf{F}", placeholder: "" }] },
  { id: "vector", label: "Vector de tres componentes", symbol: "⟨ ⟩", description: "Vector de tres componentes",
    fields: [{ key: "x", label: "Componente x", value: "x", placeholder: "" }, { key: "y", label: "Componente y", value: "y", placeholder: "" }, { key: "z", label: "Componente z", value: "z", placeholder: "" }] },
  { id: "matrix3", label: "Matriz de 3 por 3", symbol: "3×3", description: "Matriz de 3 por 3",
    fields: [{ key: "a", label: "Elemento 1,1", value: "a", placeholder: "" }, { key: "b", label: "Elemento 1,2", value: "b", placeholder: "" }, { key: "c", label: "Elemento 1,3", value: "c", placeholder: "" }, { key: "d", label: "Elemento 2,1", value: "d", placeholder: "" }, { key: "e", label: "Elemento 2,2", value: "e", placeholder: "" }, { key: "f", label: "Elemento 2,3", value: "f", placeholder: "" }, { key: "g", label: "Elemento 3,1", value: "g", placeholder: "" }, { key: "h", label: "Elemento 3,2", value: "h", placeholder: "" }, { key: "i", label: "Elemento 3,3", value: "i", placeholder: "" }] },
  { id: "system", label: "Sistema de dos ecuaciones", symbol: "{", description: "Sistema de dos ecuaciones",
    fields: [{ key: "first", label: "Primera ecuación", value: "x+y=1", placeholder: "" }, { key: "second", label: "Segunda ecuación", value: "x-y=0", placeholder: "" }] },
  { id: "cases", label: "Función por tramos", symbol: "{", description: "Función por tramos",
    fields: [{ key: "first", label: "Primer valor", value: "x^2", placeholder: "" }, { key: "condition1", label: "Condición primera", value: "x\\\\ge 0", placeholder: "" }, { key: "second", label: "Segundo valor", value: "0", placeholder: "" }, { key: "condition2", label: "Condición segunda", value: "x<0", placeholder: "" }] },
  { id: "aligned", label: "Ecuaciones alineadas", symbol: "=", description: "Ecuaciones alineadas",
    fields: [{ key: "first", label: "Primera fila", value: "a&=b+c", placeholder: "" }, { key: "second", label: "Segunda fila", value: "&=d", placeholder: "" }] },
  { id: "parametric", label: "Curva paramétrica", symbol: "(x,y)", description: "Curva paramétrica",
    fields: [{ key: "x", label: "Coordenada x(t)", value: "\\\\cos t", placeholder: "" }, { key: "y", label: "Coordenada y(t)", value: "\\\\sin t", placeholder: "" }] },
  { id: "polar", label: "Curva polar", symbol: "r(θ)", description: "Curva polar",
    fields: [{ key: "radius", label: "Radio", value: "r", placeholder: "" }, { key: "expression", label: "Expresión", value: "1+\\\\cos\\\\theta", placeholder: "" }] },
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
    case "partial": return "\\frac{\\partial}{\\partial " + group("variable") + "}" + group("function");
    case "mixed-partial": return "\\frac{\\partial^2 " + group("function") + "}{\\partial " + value("first") + "\\,\\partial " + value("second") + "}";
    case "gradient": return "\\nabla " + value("function") + "=\\left\\langle " + [value("x"), value("y"), value("z")].join(",\\;") + "\\right\\rangle";
    case "directional": return "D_{" + value("direction") + "}" + value("function") + "=\\nabla " + value("function") + "\\cdot " + value("direction");
    case "jacobian": return "\\frac{\\partial(" + value("x") + "," + value("y") + ")}{\\partial(" + value("u") + "," + value("v") + ")}";
    case "hessian": return "H_{" + value("function") + "}=\\begin{pmatrix}" + value("function") + "_{xx}&" + value("function") + "_{xy}\\\\ " + value("function") + "_{yx}&" + value("function") + "_{yy}\\end{pmatrix}";
    case "double-integral": return "\\iint_{" + value("region") + "} " + value("integrand") + "\\," + value("differential");
    case "triple-integral": return "\\iiint_{" + value("region") + "} " + value("integrand") + "\\," + value("differential");
    case "iterated-triple": return "\\int_{" + value("a") + "}^{" + value("b") + "}\\int_{" + value("c") + "}^{" + value("d") + "}\\int_{" + value("e") + "}^{" + value("f") + "} " + value("function") + "\\,dz\\,dy\\,dx";
    case "line-integral": return "\\int_{" + value("curve") + "}" + value("field") + "\\cdot d\\mathbf{r}";
    case "surface-integral": return "\\iint_{" + value("surface") + "}" + value("field") + "\\cdot\\mathbf{n}\\,dS";
    case "vector": return "\\left\\langle " + [value("x"),value("y"),value("z")].join(",\\;") + "\\right\\rangle";
    case "matrix3": return "\\begin{bmatrix}" + [value("a"),value("b"),value("c")].join("&") + "\\\\ " + [value("d"),value("e"),value("f")].join("&") + "\\\\ " + [value("g"),value("h"),value("i")].join("&") + "\\end{bmatrix}";
    case "system": return "\\begin{cases}" + value("first") + "\\\\ " + value("second") + "\\end{cases}";
    case "cases": return "\\begin{cases}" + value("first") + " & " + value("condition1") + "\\\\ " + value("second") + " & " + value("condition2") + "\\end{cases}";
    case "aligned": return "\\begin{aligned}" + value("first") + "\\\\ " + value("second") + "\\end{aligned}";
    case "parametric": return "\\begin{cases}x(t)=" + value("x") + "\\\\ y(t)=" + value("y") + "\\end{cases}";
    case "polar": return value("radius") + "(\\theta)=" + value("expression");
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
