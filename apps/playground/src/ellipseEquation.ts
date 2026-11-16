import { compileExpression, evaluateExpression } from "@mathmd/math";

export type EllipsePoint = [number, number];
export interface EllipseCoefficients { A:number; B:number; C:number; D:number; E:number; F:number }
export interface EllipseDefinition {
  center:EllipsePoint; a:number; b:number; rotation:number;
}
export interface EllipseLine { a:number; b:number; c:number }
const finite=(numbers:number[])=>numbers.every(Number.isFinite);

/** Fits the six coefficients, then verifies independent samples to reject higher-degree expressions. */
export function parseEllipseEquation(raw:string):EllipseCoefficients {
  const input=raw.replace(/²/g,"^2").replace(/−/g,"-").replace(/\s+/g,"")
    .replace(/xy/gi,"x*y");
  if(input.length>320||!new RegExp("^[0-9xy+*/^().=-]+$","i").test(input)||
    input.split("=").length!==2)throw new Error("Escribe una ecuación de segundo grado en x e y.");
  const [lhs,rhs]=input.split("=");
  if(!lhs||!rhs)throw new Error("Completa ambos miembros de la ecuación.");
  const l=compileExpression(lhs),r=compileExpression(rhs);
  const at=(x:number,y:number)=>{
    const v=evaluateExpression(l,{x,y})-evaluateExpression(r,{x,y});
    if(typeof v!=="number"||!Number.isFinite(v))
      throw new Error("La ecuación debe producir números reales finitos.");
    return v;
  };
  const F=at(0,0),xp=at(1,0),xm=at(-1,0),yp=at(0,1),ym=at(0,-1);
  const A=(xp+xm)/2-F,C=(yp+ym)/2-F,D=(xp-xm)/2,E=(yp-ym)/2;
  const B=at(1,1)-A-C-D-E-F;
  const coeffs={A,B,C,D,E,F};
  for(const [x,y] of [[2,0],[0,2],[2,3],[-1.25,2.5],[3,-2],[-2,-3],[.37,.91]]){
    const predicted=A*x*x+B*x*y+C*y*y+D*x+E*y+F;
    const observed=at(x,y);
    if(Math.abs(predicted-observed)>1e-8*Math.max(1,Math.abs(predicted),Math.abs(observed)))
      throw new Error("La expresión debe ser cuadrática (grado como máximo 2).");
  }
  ellipseFromGeneral(coeffs); // Reject hyperbolas, parabolas and imaginary ellipses.
  return coeffs;
}

/** Positive-definite completion of squares, including Bxy rotations. */
export function ellipseFromGeneral(input:EllipseCoefficients):EllipseDefinition {
  const all=[input.A,input.B,input.C,input.D,input.E,input.F];
  if(!finite(all))throw new Error("Los coeficientes deben ser finitos.");
  const sign=input.A<0?-1:1;
  const {A,B,C,D,E,F}=Object.fromEntries(
    Object.entries(input).map(([k,v])=>[k,sign*v]),
  ) as unknown as EllipseCoefficients;
  const det=4*A*C-B*B,unit=Math.max(1,Math.abs(A),Math.abs(B),Math.abs(C));
  if(A<=1e-13*unit||det<=1e-12*unit*unit)
    throw new Error("La ecuación no representa una elipse real (B²−4AC debe ser negativo).");
  const h=(B*E-2*C*D)/det,k=(B*D-2*A*E)/det;
  const R=A*h*h+B*h*k+C*k*k-F;
  if(!Number.isFinite(R)||R<=1e-12*Math.max(1,Math.abs(F),Math.abs(R)))
    throw new Error("La ecuación no tiene una elipse real de tamaño positivo.");
  const discriminant=Math.hypot(A-C,B);
  const low=(A+C-discriminant)/2,high=(A+C+discriminant)/2;
  if(!(low>0&&high>0))throw new Error("La forma cuadrática debe ser definida positiva.");
  const a=Math.sqrt(R/low),b=Math.sqrt(R/high);
  const rotation=discriminant<1e-10*unit?0:
    .5*Math.atan2(B,A-C)+Math.PI/2;
  if(!finite([h,k,a,b,rotation])||a>10000||b>10000||
    Math.max(Math.abs(h),Math.abs(k))>10000)
    throw new Error("La elipse supera los límites de representación admitidos.");
  return {center:[h,k],a,b,rotation};
}

export function coefficientsFromEllipse(center:EllipsePoint,a:number,b:number,rotation:number):EllipseCoefficients{
  const ct=Math.cos(rotation),st=Math.sin(rotation),aa=b*b,bb=a*a;
  const A=aa*ct*ct+bb*st*st,B=2*(aa-bb)*ct*st,C=aa*st*st+bb*ct*ct;
  const [h,k]=center,D=-2*A*h-B*k,E=-B*h-2*C*k;
  const F=A*h*h+B*h*k+C*k*k-a*a*b*b;
  return {A,B,C,D,E,F};
}

export function ellipseAxisCrossings(
  coefficients:EllipseCoefficients,
):{x:EllipsePoint[];y:EllipsePoint[]}{
  const roots=(a:number,b:number,c:number):number[]=>{
    const disc=b*b-4*a*c,eps=1e-11*Math.max(1,Math.abs(b*b),Math.abs(4*a*c));
    if(disc < -eps)return [];
    if(Math.abs(disc)<=eps)return [-b/(2*a)];
    const square=Math.sqrt(Math.max(0,disc));
    return [(-b-square)/(2*a),(-b+square)/(2*a)].sort((p,q)=>p-q);
  };
  return {
    x:roots(coefficients.A,coefficients.D,coefficients.F).map(x=>[x,0]),
    y:roots(coefficients.C,coefficients.E,coefficients.F).map(y=>[0,y]),
  };
}

export function ellipseParametricPoint(
  geometry:EllipseDefinition,t:number,
):EllipsePoint {
  const {center:[h,k],a,b,rotation:theta}=geometry;
  const cos=Math.cos(theta),sin=Math.sin(theta);
  return [h+a*Math.cos(t)*cos-b*Math.sin(t)*sin,
    k+a*Math.cos(t)*sin+b*Math.sin(t)*cos];
}

export function ellipseTangentNormal(
  geometry:EllipseDefinition,t:number,
):{point:EllipsePoint;tangent:EllipseLine;normal:EllipseLine}{
  const point=ellipseParametricPoint(geometry,t);
  const {rotation:theta,center:[h,k],a,b}=geometry;
  const u=(point[0]-h)*Math.cos(theta)+(point[1]-k)*Math.sin(theta);
  const v=-(point[0]-h)*Math.sin(theta)+(point[1]-k)*Math.cos(theta);
  const nx=u*Math.cos(theta)/(a*a)-v*Math.sin(theta)/(b*b);
  const ny=u*Math.sin(theta)/(a*a)+v*Math.cos(theta)/(b*b);
  const tangent={a:nx,b:ny,c:-(nx*point[0]+ny*point[1])};
  const normal={a:-ny,b:nx,c:ny*point[0]-nx*point[1]};
  return {point,tangent,normal};
}

export function ellipseParametricTex(geometry:EllipseDefinition):string{
  const fmt=(value:number)=>String(Number(value.toPrecision(7))||0);
  const [h,k]=geometry.center,theta=geometry.rotation,cs=Math.cos(theta),sn=Math.sin(theta);
  const term=(coef:number,unit:string)=>Math.abs(coef)<1e-10?"":(coef<0?"-":"+")+fmt(Math.abs(coef))+unit;
  const expression=(start:number,first:number,second:number):string=>{
    const all=(Math.abs(start)<1e-10?"":fmt(start))+term(first,"\\cos t")+term(second,"\\sin t");
    return (all.startsWith("+")?all.slice(1):all)||"0";
  };
  const x=expression(h,geometry.a*cs,-geometry.b*sn);
  const y=expression(k,geometry.a*sn,geometry.b*cs);
  return "\\begin{cases}x(t)="+x+"\\\\y(t)="+y+"\\end{cases}\\quad 0\\le t<2\\pi";
}
