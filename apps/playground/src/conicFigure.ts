import type { ConicNode } from "@mathmd/ast";
import { createCircleSVG } from "./circleFigure.js";
import { createEllipseSVG } from "./ellipseFigure.js";
import { createParabolaSVG } from "./parabolaFigure.js";
import { createHyperbolaSVG } from "./hyperbolaFigure.js";

/** The same conic block delegates to its own scientific SVG renderer. */
export function createConicSVG(node:ConicNode):SVGSVGElement{
  if((node.conicType??"circle")==="circle")return createCircleSVG(node);
  if(node.conicType==="ellipse")return createEllipseSVG(node);
  if(node.conicType==="parabola")return createParabolaSVG(node);
  return createHyperbolaSVG(node);
}
