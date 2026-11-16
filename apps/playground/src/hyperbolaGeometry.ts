import type { ConicNode } from "@mathmd/ast";
import { compileExpression, evaluateExpression } from "@mathmd/math";

export type HyperbolaPoint=[number,number];
export type HyperbolaBranch=1|-1;
export interface HyperbolaCoefficients {A:number;B:number;C:number;D:number;E:number;F:number}
export interface HyperbolaLine {a:number;b:number;c:number}
export interface HyperbolaGeometry {
  center:HyperbolaPoint;
  a:number; b:number; c:number; eccentricity:number;
  rotation:number;
  focus1:HyperbolaPoint; focus2:HyperbolaPoint;
  vertices:[HyperbolaPoint,HyperbolaPoint];
  conjugateVertices:[HyperbolaPoint,HyperbolaPoint];
  rectangle:[HyperbolaPoint,HyperbolaPoint,HyperbolaPoint,HyperbolaPoint];
  asymptotes:[HyperbolaLine,HyperbolaLine];
  directrices:[HyperbolaLine,HyperbolaLine];
  latusEndpoints:[HyperbolaPoint,HyperbolaPoint,HyperbolaPoint,HyperbolaPoint];
  latusRectum:number;
  directrixOffset:number;
  coefficients:HyperbolaCoefficients;
  canonicalTex:string;generalTex:string;transformTex?:string;
}
const fmt=(n:number)=>String(Math.abs(n)<1e-11?0:Number(n.toPrecision(9)));
const shifted=(name:string,v:number)=>"("+name+(v<0?"+"+fmt(-v):v>0?"-"+fmt(v):"")+")";
const term=(value:number,symbol:string,first=false)=>{
  if(Math.abs(value)<1e-10)return "";
  const magnitude=Math.abs(value);
  return (value<0?"-":first?"":"+")+
    (symbol&&Math.abs(magnitude-1)<1e-10?"":fmt(magnitude))+symbol;
};
const finite=(values:readonly number[])=>values.every(Number.isFinite);
const toLine=(nx:number,ny:number,point:HyperbolaPoint):HyperbolaLine=>({
  a:nx,b:ny,c:-nx*point[0]-ny*point[1],
});
export const hyperbolaPoint=(g:Pick<HyperbolaGeometry,"center"|"rotation">,u:number,v:number):HyperbolaPoint=>{
  const cs=Math.cos(g.rotation),sn=Math.sin(g.rotation);
  return [g.center[0]+u*cs-v*sn,g.center[1]+u*sn+v*cs];
};
export function hyperbolaCoefficients(
  center:HyperbolaPoint,a:number,b:number,rotation:number,
):HyperbolaCoefficients{
  const ct=Math.cos(rotation),st=Math.sin(rotation),aa=b*b,bb=a*a;
  const A=aa*ct*ct-bb*st*st,B=2*(aa+bb)*ct*st,C=aa*st*st-bb*ct*ct;
  const [h,k]=center;
  const D=-2*A*h-B*k,E=-B*h-2*C*k;
  const F=A*h*h+B*h*k+C*k*k-aa*bb;
  return {A,B,C,D,E,F};
}
export function hyperbolaFromCenter(
  center:HyperbolaPoint,a:number,b:number,axis:"x"|"y"="x",rotation=0,
):HyperbolaGeometry{
  if(!finite([...center,a,b,rotation])||a<=0||b<=0||a>10000||b>10000||
    center.some(n=>Math.abs(n)>10000)||Math.abs(rotation)>1e5)
    throw new Error("Se requieren un centro finito y dos semiejes positivos no mayores que 10000.");
  const theta=rotation+(axis==="y"?Math.PI/2:0);
  const g={center,rotation:theta};
  const c=Math.hypot(a,b),eccentricity=c/a,directrixOffset=a*a/c;
  const focus1=hyperbolaPoint(g,-c,0),focus2=hyperbolaPoint(g,c,0);
  const vertices:[HyperbolaPoint,HyperbolaPoint]=[
    hyperbolaPoint(g,-a,0),hyperbolaPoint(g,a,0)];
  const conjugateVertices:[HyperbolaPoint,HyperbolaPoint]=[
    hyperbolaPoint(g,0,-b),hyperbolaPoint(g,0,b)];
  const rectangle:[
    HyperbolaPoint,HyperbolaPoint,HyperbolaPoint,HyperbolaPoint,
  ]=[
    hyperbolaPoint(g,-a,-b),hyperbolaPoint(g,a,-b),
    hyperbolaPoint(g,a,b),hyperbolaPoint(g,-a,b),
  ];
  const cos=Math.cos(theta),sin=Math.sin(theta);
  const u:HyperbolaPoint=[cos,sin],v:HyperbolaPoint=[-sin,cos];
  const asymptotes:[HyperbolaLine,HyperbolaLine]=([-1,1] as const).map(sign=>
    toLine(v[0]-sign*b/a*u[0],v[1]-sign*b/a*u[1],center),
  ) as [HyperbolaLine,HyperbolaLine];
  const directrices:[HyperbolaLine,HyperbolaLine]=[
    toLine(u[0],u[1],hyperbolaPoint(g,-directrixOffset,0)),
    toLine(u[0],u[1],hyperbolaPoint(g,directrixOffset,0)),
  ];
  const halfLatus=b*b/a;
  const latusEndpoints:[HyperbolaPoint,HyperbolaPoint,HyperbolaPoint,HyperbolaPoint]=[
    hyperbolaPoint(g,-c,-halfLatus),hyperbolaPoint(g,-c,halfLatus),
    hyperbolaPoint(g,c,-halfLatus),hyperbolaPoint(g,c,halfLatus),
  ];
  const horizontal=Math.abs(sin)<1e-10,vertical=Math.abs(cos)<1e-10;
  const [h,k]=center,x=shifted("x",h),y=shifted("y",k);
  const canonicalTex=horizontal
    ?"\\frac{"+x+"^2}{"+fmt(a*a)+"}-\\frac{"+y+"^2}{"+fmt(b*b)+"}=1"
    :vertical
      ?"\\frac{"+y+"^2}{"+fmt(a*a)+"}-\\frac{"+x+"^2}{"+fmt(b*b)+"}=1"
      :"\\frac{U^2}{"+fmt(a*a)+"}-\\frac{V^2}{"+fmt(b*b)+"}=1";
  const transformed=(n:number,v:string)=>(n<0?"-":"+")+fmt(Math.abs(n))+v;
  const transformTex=!horizontal&&!vertical
    ? "U="+fmt(cos)+x+transformed(sin,y)+",\\quad V="+
      fmt(-sin)+x+transformed(cos,y):undefined;
  const coefficients=hyperbolaCoefficients(center,a,b,theta);
  const {A,B,C,D,E,F}=coefficients;
  const generalTex=[
    term(A,"x^2",true),term(B,"xy"),term(C,"y^2"),
    term(D,"x"),term(E,"y"),term(F,""),
  ].filter(Boolean).join("")+"=0";
  return {center,a,b,c,eccentricity,rotation:theta,
    focus1,focus2,vertices,conjugateVertices,rectangle,asymptotes,directrices,
    latusEndpoints,latusRectum:2*b*b/a,directrixOffset,coefficients,
    canonicalTex,generalTex,transformTex};
}

export function hyperbolaFromFoci(
  focus1:HyperbolaPoint,focus2:HyperbolaPoint,difference:number,
):HyperbolaGeometry{
  if(!finite([...focus1,...focus2,difference])||
    [...focus1,...focus2].some(n=>Math.abs(n)>10000))
    throw new Error("Introduce dos focos finitos y una diferencia de distancias.");
  const distance=Math.hypot(focus2[0]-focus1[0],focus2[1]-focus1[1]);
  if(!(difference>0&&difference<distance))
    throw new Error("La diferencia de distancias (2a) debe ser mayor que 0 y menor que la distancia entre focos (2c).");
  const a=difference/2,c=distance/2,b=Math.sqrt((c-a)*(c+a));
  const center:HyperbolaPoint=[
    (focus1[0]+focus2[0])/2,(focus1[1]+focus2[1])/2,
  ];
  return hyperbolaFromCenter(center,a,b,"x",
    Math.atan2(focus2[1]-focus1[1],focus2[0]-focus1[0]));
}

export function hyperbolaFromGeneral(input:HyperbolaCoefficients):HyperbolaGeometry{
  const {A,B,C,D,E,F}=input;
  if(!finite([A,B,C,D,E,F]))
    throw new Error("Los coeficientes de la ecuación deben ser finitos.");
  const scale=Math.max(Math.abs(A),Math.abs(B),Math.abs(C));
  const delta=4*A*C-B*B;
  if(scale<=1e-12||delta>=-1e-10*scale*scale)
    throw new Error("La ecuación no representa una hipérbola: B²−4AC debe ser positivo.");
  const h=(B*E-2*C*D)/delta,k=(B*D-2*A*E)/delta;
  const R=-(A*h*h+B*h*k+C*k*k+D*h+E*k+F);
  if(!Number.isFinite(R)||Math.abs(R)<=1e-11*Math.max(1,Math.abs(F),Math.abs(R)))
    throw new Error("La ecuación es degenerada: dos rectas que se cortan.");
  const disc=Math.hypot(A-C,B);
  const low=(A+C-disc)/2,high=(A+C+disc)/2;
  const transverse=R>0?high:low,conjugate=R>0?low:high;
  if(!(transverse*R>0&&conjugate*R<0))
    throw new Error("La forma cuadrática no define una hipérbola real.");
  const a=Math.sqrt(R/transverse),b=Math.sqrt(-R/conjugate);
  let rotation=.5*Math.atan2(B,A-C);
  if(R<0)rotation+=Math.PI/2;
  return hyperbolaFromCenter([h,k],a,b,"x",rotation);
}

/** Interpret an equation with basic arithmetic and independently verify its quadratic coefficients. */
export function parseHyperbolaEquation(raw:string):HyperbolaCoefficients{
  const expression=raw.replace(/²/g,"^2").replace(/−/g,"-").replace(/\s+/g,"")
    .replace(/xy/gi,"x*y");
  if(expression.length>320||
    !new RegExp("^[0-9xy+*/^().=-]+$","i").test(expression)||
    expression.split("=").length!==2)
    throw new Error("Introduce una ecuación cuadrática en x e y.");
  const [left,right]=expression.split("=");
  if(!left||!right)throw new Error("Completa ambos miembros.");
  const lhs=compileExpression(left),rhs=compileExpression(right);
  const at=(x:number,y:number):number=>{
    const value=evaluateExpression(lhs,{x,y})-evaluateExpression(rhs,{x,y});
    if(typeof value!=="number"||!Number.isFinite(value))
      throw new Error("La ecuación debe tener valores reales finitos.");
    return value;
  };
  const F=at(0,0),xp=at(1,0),xm=at(-1,0),yp=at(0,1),ym=at(0,-1);
  const A=(xp+xm)/2-F,C=(yp+ym)/2-F,D=(xp-xm)/2,E=(yp-ym)/2;
  const B=at(1,1)-A-C-D-E-F,coefficients={A,B,C,D,E,F};
  for(const [x,y] of [[2,0],[0,2],[2,3],[-2,-3],[-1.25,2.5],[.37,.91]]){
    const predicted=A*x*x+B*x*y+C*y*y+D*x+E*y+F,actual=at(x,y);
    if(Math.abs(predicted-actual)>1e-8*Math.max(1,Math.abs(predicted),Math.abs(actual)))
      throw new Error("La expresión debe ser de grado dos.");
  }
  hyperbolaFromGeneral(coefficients);
  return coefficients;
}
export function hyperbolaParametricPoint(
  g:HyperbolaGeometry,t:number,branch:HyperbolaBranch=1,
):HyperbolaPoint{
  return hyperbolaPoint(g,branch*g.a*Math.cosh(t),g.b*Math.sinh(t));
}
export function hyperbolaTangentNormal(
  g:HyperbolaGeometry,t:number,branch:HyperbolaBranch=1,
):{point:HyperbolaPoint;tangent:HyperbolaLine;normal:HyperbolaLine}{
  const point=hyperbolaParametricPoint(g,t,branch);
  const U=branch*Math.cosh(t)/g.a,V=-Math.sinh(t)/g.b;
  const cos=Math.cos(g.rotation),sin=Math.sin(g.rotation);
  const nx=U*cos-V*sin,ny=U*sin+V*cos;
  const tangent=toLine(nx,ny,point);
  const normal=toLine(-ny,nx,point);
  return {point,tangent,normal};
}
export function hyperbolaAxisIntersections(g:HyperbolaGeometry):{
  x:HyperbolaPoint[];y:HyperbolaPoint[];
}{
  const {A,C,D,E,F}=g.coefficients;
  const roots=(a:number,b:number,c:number):number[]=>{
    const eps=1e-10*Math.max(1,Math.abs(a),Math.abs(b),Math.abs(c));
    if(Math.abs(a)<=eps)return Math.abs(b)<=eps?[]:[-c/b];
    const discriminant=b*b-4*a*c;
    if(discriminant< -eps)return [];
    if(Math.abs(discriminant)<=eps)return [-b/(2*a)];
    const root=Math.sqrt(discriminant);
    return [(-b-root)/(2*a),(-b+root)/(2*a)].sort((u,v)=>u-v);
  };
  return {
    x:roots(A,D,F).map(x=>[x,0]),
    y:roots(C,E,F).map(y=>[0,y]),
  };
}
export function hyperbolaParametricTex(g:HyperbolaGeometry):string{
  const fmtN=(n:number)=>String(Math.abs(n)<1e-10?0:Number(n.toPrecision(7)));
  const cos=Math.cos(g.rotation),sin=Math.sin(g.rotation),[h,k]=g.center;
  const expression=(base:number,a:number,b:number)=>{
    const pieces=[Math.abs(base)<1e-10?"":fmtN(base),
      Math.abs(a)<1e-10?"":((a<0?"\\mp ":"\\pm ")+fmtN(Math.abs(a))+"\\cosh t"),
      Math.abs(b)<1e-10?"":((b<0?"-":"+")+fmtN(Math.abs(b))+"\\sinh t")];
    return pieces.join("")||"0";
  };
  return "\\begin{cases}x_\\pm(t)="+expression(h,g.a*cos,-g.b*sin)+
    "\\\\y_\\pm(t)="+expression(k,g.a*sin,g.b*cos)+
    "\\end{cases},\\quad t\\in\\mathbb{R}";
}
export function resolveHyperbola(
  node:Pick<ConicNode,"mode"|"center"|"semiMajorAxis"|"semiMinorAxis"|
    "axis"|"rotation"|"focus1"|"focus2"|"diffDistances"|
    "A"|"B"|"C"|"D"|"E"|"F">,
):HyperbolaGeometry{
  if(node.mode==="foci"){
    if(!node.focus1||!node.focus2||node.diffDistances===undefined)
      throw new Error("Se requieren los dos focos y su diferencia de distancias.");
    return hyperbolaFromFoci(node.focus1,node.focus2,node.diffDistances);
  }
  if(node.mode==="general"){
    if([node.A,node.B,node.C,node.D,node.E,node.F].some(x=>x===undefined))
      throw new Error("Se necesitan los seis coeficientes de la ecuación.");
    return hyperbolaFromGeneral({
      A:node.A!,B:node.B!,C:node.C!,D:node.D!,E:node.E!,F:node.F!,
    });
  }
  return hyperbolaFromCenter(node.center??[0,0],node.semiMajorAxis??4,
    node.semiMinorAxis??2,node.axis??"x",node.rotation??0);
}
export function serializeHyperbolaBlock(
  mode:"canonical"|"foci"|"general",g:HyperbolaGeometry,
  options:Record<string,boolean|number|string>,
  input?:{focus1?:HyperbolaPoint;focus2?:HyperbolaPoint;diffDistances?:number;
    coefficients?:HyperbolaCoefficients},
):string{
  const fence=String.fromCharCode(96).repeat(3);
  const lines=[fence+"conic","conicType: hyperbola","mode: "+mode];
  if(mode==="foci"&&input?.focus1&&input.focus2&&input.diffDistances!==undefined){
    lines.push("focus1: "+JSON.stringify(input.focus1),
      "focus2: "+JSON.stringify(input.focus2),
      "diffDistances: "+input.diffDistances);
  }else if(mode==="general"&&input?.coefficients){
    for(const key of ["A","B","C","D","E","F"] as const)
      lines.push(key+": "+input.coefficients[key]);
  }else{
    lines.push("center: "+JSON.stringify(g.center),
      "semiMajorAxis: "+g.a,"semiMinorAxis: "+g.b,
      "axis: x","rotation: "+g.rotation);
  }
  for(const [key,value] of Object.entries(options))lines.push(key+": "+JSON.stringify(value));
  lines.push(fence);
  return "\n"+lines.join("\n")+"\n";
}
