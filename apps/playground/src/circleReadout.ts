import type { ConicNode } from "@mathmd/ast";
import { resolveCircle, type CircleGeometry } from "./circleGeometry.js";

/** Pure readout data: formatting never changes the document's geometry. */
export interface CircleReadoutMetric {
  label: string;
  value: string;
  math?: boolean;
}
export const circleNumber = (number: number): string => {
  if (!Number.isFinite(number)) return "Indeterminado";
  return String(Number(number.toPrecision(8)) || 0);
};
const formatPoint = (p: readonly [number, number]): string =>
  "\\left(" + circleNumber(p[0]) + ",\\;" + circleNumber(p[1]) + "\\right)";
const piMultiple = (coefficient: number): string => {
  const coefficientText = circleNumber(coefficient);
  return coefficientText === "0" ? "0" : coefficientText === "1" ? "\\pi"
    : coefficientText === "-1" ? "-\\pi" : coefficientText + "\\pi";
};
const gcd = (a: number, b: number): number => {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
};

/** Stored angles use degrees for the SVG editor; report them as radians with pi. */
export function degreesToPiRadians(degrees: number): string {
  if (!Number.isFinite(degrees)) return "\\text{Indeterminado}";
  const ratio = degrees / 180;
  for (let denominator = 1; denominator <= 360; denominator++) {
    const numerator = Math.round(ratio * denominator);
    if (Math.abs(ratio - numerator / denominator) > 1e-10) continue;
    if (numerator === 0) return "0";
    const divisor = gcd(numerator, denominator);
    const p = numerator / divisor, q = denominator / divisor;
    const numeratorTex = Math.abs(p) === 1 ? "\\pi" : Math.abs(p) + "\\pi";
    const sign = p < 0 ? "-" : "";
    return q === 1 ? sign + numeratorTex : sign + "\\frac{" + numeratorTex + "}{" + q + "}";
  }
  return "\\approx " + circleNumber(degrees * Math.PI / 180) + "\\;\\mathrm{rad}";
}

/** Preserve simple radicals for circles derived from equations and 3 points. */
function radicalRadius(radius: number, mode: ConicNode["mode"]): {
  radius: string; circumference: string; area: string;
} | null {
  if (mode !== "general" && mode !== "three-points") return null;
  const squared = radius * radius;
  const integer = Math.round(squared);
  if (integer < 1 || integer > 1_000_000 ||
      Math.abs(squared - integer) > 1e-10 * Math.max(1, integer)) return null;
  let outside = 1, inside = integer;
  for (let factor = 2; factor * factor <= inside; factor++) {
    while (inside % (factor * factor) === 0) {
      inside /= factor * factor;
      outside *= factor;
    }
  }
  if (inside === 1) return null;
  const root = "\\sqrt{" + inside + "}";
  return {
    radius: (outside === 1 ? "" : outside) + root,
    circumference: (2 * outside) + root + "\\pi",
    area: piMultiple(integer),
  };
}
export function getCircleReadout(
  node: Pick<ConicNode, "mode" | "showEquation" | "showRadius" | "showDiameter" | "showChord" |
    "showSecant" | "showTangent" | "radiusAngle" | "diameterAngle" | "chordStartAngle" |
    "chordEndAngle" | "secantStartAngle" | "secantEndAngle" | "tangentAngle">,
  geometry: CircleGeometry,
): CircleReadoutMetric[] {
  const { center, radius } = geometry;
  const radical = radicalRadius(radius, node.mode);
  const metrics: CircleReadoutMetric[] = [
    { label: "Definición", value: node.mode === "three-points" ? "Tres puntos"
      : node.mode === "general" ? "Ecuación general"
      : node.mode === "canonical" ? "Ecuación canónica" : "Centro y radio" },
    { label: "Centro", value: formatPoint(center), math: true },
    { label: "Radio", value: radical?.radius ?? circleNumber(radius), math: true },
    { label: "Diámetro", value: radical ? "2\\left(" + radical.radius + "\\right)"
      : circleNumber(2 * radius), math: true },
    { label: "Longitud de circunferencia",
      value: radical?.circumference ?? piMultiple(2 * radius), math: true },
    { label: "Área del círculo", value: radical?.area ?? piMultiple(radius * radius), math: true },
  ];
  if (node.showEquation !== false) {
    metrics.push(
      { label: "Ecuación canónica", value: geometry.canonicalTex, math: true },
      { label: "Ecuación general", value: geometry.generalTex, math: true },
    );
  }
  metrics.push(
    { label: "Cortes con eje X", value: geometry.xIntersections.length
      ? geometry.xIntersections.map(formatPoint).join(",\\;") : "Ninguno",
      math: geometry.xIntersections.length > 0 },
    { label: "Cortes con eje Y", value: geometry.yIntersections.length
      ? geometry.yIntersections.map(formatPoint).join(",\\;") : "Ninguno",
      math: geometry.yIntersections.length > 0 },
  );
  const angle = (label: string, degrees: number) => metrics.push({
    label, value: degreesToPiRadians(degrees), math: true,
  });
  if (node.showRadius) angle("Dirección del radio", node.radiusAngle ?? 30);
  if (node.showDiameter) angle("Dirección del diámetro", node.diameterAngle ?? 0);
  if (node.showChord) {
    angle("Cuerda: ángulo inicial", node.chordStartAngle ?? 35);
    angle("Cuerda: ángulo final", node.chordEndAngle ?? 140);
  }
  if (node.showSecant) {
    angle("Secante: ángulo inicial", node.secantStartAngle ?? 220);
    angle("Secante: ángulo final", node.secantEndAngle ?? 300);
  }
  if (node.showTangent) angle("Punto de tangencia: ángulo", node.tangentAngle ?? 60);
  return metrics;
}
export function circleMetricsForNode(node: ConicNode): CircleReadoutMetric[] {
  return getCircleReadout(node, resolveCircle(node));
}
