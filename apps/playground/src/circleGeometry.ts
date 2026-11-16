import type { ConicNode } from "@mathmd/ast";
import { compileExpression, evaluateExpression } from "@mathmd/math";

export interface CircleCoefficients {
  A: number; B: number; C: number; D: number; E: number; F: number;
}
export interface CircleGeometry {
  center: [number, number];
  radius: number;
  coefficients: CircleCoefficients;
  canonicalTex: string;
  generalTex: string;
  xIntersections: Array<[number, number]>;
  yIntersections: Array<[number, number]>;
}
const fmt = (n: number): string => {
  const rounded = Number(n.toPrecision(9));
  return Object.is(rounded, -0) ? "0" : String(rounded);
};
const signed = (value: number): string => value < 0 ? "+" + fmt(-value) : value > 0 ? "-" + fmt(value) : "";
const eqPart = (letter: string, translation: number) => "(" + letter + signed(translation) + ")^2";

export function circleFromCenterRadius(center: [number, number], radius: number): CircleGeometry {
  const [h, k] = center;
  if (![h, k, radius].every(Number.isFinite) || radius <= 0 || radius > 10000 ||
    Math.abs(h) > 10000 || Math.abs(k) > 10000)
    throw new Error("El centro debe ser finito y el radio positivo (máximo 10000).");
  const coefficients = { A: 1, B: 0, C: 1, D: -2*h, E: -2*k, F: h*h+k*k-radius*radius };
  const cross = (shift: number, index: 0|1): Array<[number,number]> => {
    const disc = radius*radius - shift*shift;
    if (disc < -1e-9*Math.max(1,radius*radius)) return [];
    const delta = Math.sqrt(Math.max(0,disc));
    const first: [number,number] = index === 0 ? [h-delta,0] : [0,k-delta];
    if (delta < 1e-9) return [first];
    const second: [number,number] = index === 0 ? [h+delta,0] : [0,k+delta];
    return [first,second];
  };
  const terms = [
    "x^2+y^2",
    coefficients.D ? (coefficients.D > 0 ? "+" : "") + fmt(coefficients.D) + "x" : "",
    coefficients.E ? (coefficients.E > 0 ? "+" : "") + fmt(coefficients.E) + "y" : "",
    coefficients.F ? (coefficients.F > 0 ? "+" : "") + fmt(coefficients.F) : "",
  ];
  return { center:[h,k],radius,coefficients,
    canonicalTex: eqPart("x",h)+"+"+eqPart("y",k)+"="+fmt(radius*radius),
    generalTex: terms.join("")+"=0",
    xIntersections: cross(k,0), yIntersections: cross(h,1) };
}

export function circleFromCoefficients(c: CircleCoefficients): CircleGeometry {
  const { A,B,C,D,E,F } = c;
  if (![A,B,C,D,E,F].every(Number.isFinite) ||
    Math.abs(A)<1e-12 || Math.abs(A-C)>1e-8*Math.max(1,Math.abs(A),Math.abs(C)) ||
    Math.abs(B)>1e-8*Math.max(1,Math.abs(A)))
    throw new Error("Una circunferencia real exige A=C distinto de cero y B=0.");
  const center: [number,number] = [-D/(2*A),-E/(2*A)];
  const radiusSquared = center[0]**2+center[1]**2-F/A;
  if (!(radiusSquared>1e-12) || !Number.isFinite(radiusSquared))
    throw new Error("La ecuación no define una circunferencia real de radio positivo.");
  return circleFromCenterRadius(center,Math.sqrt(radiusSquared));
}

/** Accepts both (x-h)^2+(y-k)^2=r^2 and Ax²+Bxy+Cy²+Dx+Ey+F=0.
 * Only arithmetic expressions in x and y are allowed. Their polynomial identity is
 * checked beyond the six interpolation points, so nonlinear functions are rejected.
 */
export function parseCircleEquation(input: string): CircleCoefficients {
  const cleaned = input.replace(/²/g,"^2").replace(/−/g,"-").replace(/\s+/g,"");
  if (cleaned.length>256 || !/^[0-9xy+\-*/^().=]+$/i.test(cleaned) ||
    cleaned.split("=").length!==2) throw new Error("Escribe una ecuación numérica en x e y con un signo =.");
  const [left,right] = cleaned.split("=");
  if (!left || !right) throw new Error("Completa ambos lados de la ecuación.");
  const a=compileExpression(left),b=compileExpression(right);
  const sample=(x:number,y:number)=>{
    const result=evaluateExpression(a,{x,y})-evaluateExpression(b,{x,y});
    if (!Number.isFinite(result)) throw new Error("La ecuación produce un valor no finito.");
    return result;
  };
  const F=sample(0,0), xp=sample(1,0),xm=sample(-1,0),yp=sample(0,1),ym=sample(0,-1);
  const A=(xp+xm)/2-F, C=(yp+ym)/2-F, D=(xp-xm)/2, E=(yp-ym)/2;
  const B=sample(1,1)-A-C-D-E-F;
  const coefficients={A,B,C,D,E,F};
  for (const [x,y] of [[2,0],[0,2],[2,3],[-1.25,2.5],[3,-2]]){
    const calculated=A*x*x+B*x*y+C*y*y+D*x+E*y+F;
    const actual=sample(x,y);
    if (Math.abs(calculated-actual)>1e-7*Math.max(1,Math.abs(actual),Math.abs(calculated)))
      throw new Error("La ecuación debe ser cuadrática en x e y.");
  }
  circleFromCoefficients(coefficients);
  return coefficients;
}

export function circleFromThreePoints(
  p1:[number,number],p2:[number,number],p3:[number,number],
): CircleGeometry {
  const [[x1,y1],[x2,y2],[x3,y3]]=[p1,p2,p3];
  if (![x1,y1,x2,y2,x3,y3].every(Number.isFinite))
    throw new Error("Los tres puntos deben tener coordenadas finitas.");
  const det=2*(x1*(y2-y3)+x2*(y3-y1)+x3*(y1-y2));
  const scale=Math.max(1,...[x1,y1,x2,y2,x3,y3].map(Math.abs));
  if (Math.abs(det)<1e-10*scale*scale)
    throw new Error("Los tres puntos no pueden ser colineales.");
  const s1=x1*x1+y1*y1,s2=x2*x2+y2*y2,s3=x3*x3+y3*y3;
  const h=(s1*(y2-y3)+s2*(y3-y1)+s3*(y1-y2))/det;
  const k=(s1*(x3-x2)+s2*(x1-x3)+s3*(x2-x1))/det;
  return circleFromCenterRadius([h,k],Math.hypot(x1-h,y1-k));
}

/** Resolve actual geometry from the persisted definition, not stale visual defaults. */
export function resolveCircle(node: Pick<ConicNode,
  "mode"|"center"|"radius"|"A"|"B"|"C"|"D"|"E"|"F"|"pointA"|"pointB"|"pointC">): CircleGeometry {
  if (node.mode==="general") return circleFromCoefficients({
    A:node.A!,B:node.B!,C:node.C!,D:node.D!,E:node.E!,F:node.F!,
  });
  if (node.mode==="three-points") return circleFromThreePoints(node.pointA!,node.pointB!,node.pointC!);
  return circleFromCenterRadius(node.center??[0,0],node.radius??2);
}

export function serializeCircleBlock(
  mode:"center-radius"|"canonical"|"general"|"three-points",
  geometry: CircleGeometry,
  options: Record<string,boolean|number|string>,
  points?:Array<[number,number]>,
):string {
  const rows=["```conic","conicType: circle","mode: "+mode];
  if(mode==="general") for(const key of ["A","B","C","D","E","F"] as const)
    rows.push(key+": "+geometry.coefficients[key]);
  else if(mode==="three-points" && points?.length===3)
    ["pointA","pointB","pointC"].forEach((name,i)=>rows.push(name+": "+JSON.stringify(points[i])));
  else rows.push("center: "+JSON.stringify(geometry.center),"radius: "+geometry.radius);
  for(const [key,val] of Object.entries(options)) rows.push(key+": "+JSON.stringify(val));
  rows.push("```");
  return "\n"+rows.join("\n")+"\n";
}
