import type { ConicNode } from "@mathmd/ast";
import { compileExpression, evaluateExpression } from "@mathmd/math";

export type ParabolaPoint=[number,number];
export interface ParabolaCoefficients { A:number;B:number;C:number;D:number;E:number;F:number }
export interface ParabolaLine { a:number;b:number;c:number }
export interface ParabolaGeometry {
  vertex:ParabolaPoint;
  focus:ParabolaPoint;
  directrix:ParabolaLine;
  axisLine:ParabolaLine;
  p:number;
  rotation:number;
  axis:"x"|"y";
  latusRectum:number;
  latusEndpoints:[ParabolaPoint,ParabolaPoint];
  canonicalTex:string;
  generalTex:string;
  transformTex?:string;
  coefficients:ParabolaCoefficients;
}
const fmt=(v:number)=>String(Math.abs(v)<1e-11?0:Number(v.toPrecision(9)));
const shift=(name:string,v:number)=>"("+name+(v<0?"+"+fmt(-v):v>0?"-"+fmt(v):"")+")";
const term=(value:number,symbol:string,first=false)=>{
  if(Math.abs(value)<1e-10)return "";
  const magnitude=Math.abs(value),sign=value<0?"-":first?"":"+";
  return sign+(symbol&&Math.abs(magnitude-1)<1e-10?"":fmt(magnitude))+symbol;
};
export const parabolaPoint=(g:Pick<ParabolaGeometry,"vertex"|"rotation">,u:number,v:number):ParabolaPoint=>{
  const c=Math.cos(g.rotation),s=Math.sin(g.rotation);
  return [g.vertex[0]+u*c-v*s,g.vertex[1]+u*s+v*c];
};
export function coefficientsFromParabola(vertex:ParabolaPoint,p:number,rotation:number):ParabolaCoefficients {
  const [h,k]=vertex,c=Math.cos(rotation),s=Math.sin(rotation);
  const vx=-s,vy=c,axis=c*h+s*k,trans=vx*h+vy*k;
  const A=vx*vx,B=2*vx*vy,C=vy*vy;
  const D=-2*trans*vx-4*p*c,E=-2*trans*vy-4*p*s;
  const F=trans*trans+4*p*axis;
  return {A,B,C,D,E,F};
}
export function parabolaFromVertex(
  vertex:ParabolaPoint,p:number,axis:"x"|"y"="x",rotation=0,
):ParabolaGeometry {
  if(![...vertex,p,rotation].every(Number.isFinite)||p===0||Math.abs(p)>10000||
    vertex.some(n=>Math.abs(n)>10000)||Math.abs(rotation)>1e5)
    throw new Error("Indica un vértice finito y un parámetro p distinto de cero.");
  const theta=rotation+(axis==="y"?Math.PI/2:0);
  const g={vertex,rotation:theta},[h,k]=vertex;
  const focus=parabolaPoint(g,p,0);
  const start=parabolaPoint(g,p,-2*Math.abs(p)),end=parabolaPoint(g,p,2*Math.abs(p));
  const u=[Math.cos(theta),Math.sin(theta)],v=[-u[1],u[0]];
  const directrix={a:u[0],b:u[1],c:p-u[0]*h-u[1]*k};
  const axisLine={a:v[0],b:v[1],c:-v[0]*h-v[1]*k};
  const coefficients=coefficientsFromParabola(vertex,p,theta);
  const zero=Math.abs(Math.sin(theta))<1e-10;
  const vertical=Math.abs(Math.cos(theta))<1e-10;
  const canonicalTex=zero
    ? shift("y",k)+"^2="+fmt(4*p*u[0])+shift("x",h)
    : vertical
      ? shift("x",h)+"^2="+fmt(4*p*u[1])+shift("y",k)
      : "V^2="+fmt(4*p)+"U";
  const transformTex=!zero&&!vertical
    ? "U="+fmt(u[0])+shift("x",h)+(u[1]<0?"-":"+")+fmt(Math.abs(u[1]))+shift("y",k)+
      ",\\quad V="+fmt(v[0])+shift("x",h)+(v[1]<0?"-":"+")+fmt(Math.abs(v[1]))+shift("y",k)
    :undefined;
  const generalTex=[
    term(coefficients.A,"x^2",true),term(coefficients.B,"xy"),term(coefficients.C,"y^2"),
    term(coefficients.D,"x"),term(coefficients.E,"y"),term(coefficients.F,"")
  ].filter(Boolean).join("")+"=0";
  return {vertex,focus,directrix,axisLine,p,rotation:theta,axis,
    latusRectum:4*Math.abs(p),latusEndpoints:[start,end],
    coefficients,canonicalTex,generalTex,transformTex};
}
export function parabolaFromFocusDirectrix(
  focus:ParabolaPoint,line:ParabolaLine,
):ParabolaGeometry {
  const {a,b,c}=line,norm=Math.hypot(a,b);
  if(![...focus,a,b,c].every(Number.isFinite)||norm<=1e-10||norm>1e8)
    throw new Error("La directriz debe ser una recta Ax+By+C=0 válida.");
  const unit:[number,number]=[a/norm,b/norm];
  const signed=(a*focus[0]+b*focus[1]+c)/norm,p=signed/2;
  if(Math.abs(p)<=1e-10*Math.max(1,Math.hypot(...focus)))
    throw new Error("El foco no puede estar sobre la directriz.");
  const vertex:ParabolaPoint=[focus[0]-p*unit[0],focus[1]-p*unit[1]];
  return parabolaFromVertex(vertex,p,"x",Math.atan2(unit[1],unit[0]));
}
export function parabolaFromGeneral(input:ParabolaCoefficients):ParabolaGeometry{
  const {A,B,C,D,E,F}=input;
  if(![A,B,C,D,E,F].every(Number.isFinite))
    throw new Error("Los seis coeficientes deben ser números finitos.");
  const scale=Math.max(Math.abs(A),Math.abs(B),Math.abs(C));
  if(scale<=1e-12)
    throw new Error("No hay término cuadrático: no es una parábola.");
  const det=4*A*C-B*B;
  if(Math.abs(det)>1e-9*scale*scale)
    throw new Error("La ecuación no es parabólica: B²−4AC debe ser cero.");
  const lambda=A+C;
  if(Math.abs(lambda)<=1e-12*scale)
    throw new Error("La parte cuadrática no tiene rango uno.");
  const transverse:ParabolaPoint=Math.abs(A)>=Math.abs(C)?[A,B/2]:[B/2,C];
  const norm=Math.hypot(...transverse),w:ParabolaPoint=[transverse[0]/norm,transverse[1]/norm];
  let u:ParabolaPoint=[-w[1],w[0]];
  const dominant=Math.abs(u[0])>=Math.abs(u[1])?u[0]:u[1];
  if(dominant<0)u=[-u[0],-u[1]];
  const v:ParabolaPoint=[-u[1],u[0]];
  const ds=D*v[0]+E*v[1],du=D*u[0]+E*u[1];
  if(Math.abs(du)<=1e-10*Math.max(1,Math.abs(D),Math.abs(E)))
    throw new Error("La ecuación es degenerada: faltan términos lineales en el eje.");
  const s0=-ds/(2*lambda),t0=-(F-ds*ds/(4*lambda))/du;
  const vertex:ParabolaPoint=[s0*v[0]+t0*u[0],s0*v[1]+t0*u[1]];
  return parabolaFromVertex(vertex,-du/(4*lambda),"x",Math.atan2(u[1],u[0]));
}
/** Parse only simple quadratic expressions, verify independently and reject non-parabolas. */
export function parseParabolaEquation(raw:string):ParabolaCoefficients{
  const expression=raw.replace(/²/g,"^2").replace(/−/g,"-").replace(/\s+/g,"")
    .replace(/xy/gi,"x*y");
  if(expression.length>320||!new RegExp("^[0-9xy+*/^().=-]+$","i").test(expression)||
    expression.split("=").length!==2)
    throw new Error("Introduce una ecuación cuadrática en x e y.");
  const [left,right]=expression.split("=");
  if(!left||!right)throw new Error("Completa ambos lados de la ecuación.");
  const lhs=compileExpression(left),rhs=compileExpression(right);
  const at=(x:number,y:number):number=>{
    const value=evaluateExpression(lhs,{x,y})-evaluateExpression(rhs,{x,y});
    if(typeof value!=="number"||!Number.isFinite(value))
      throw new Error("La ecuación debe producir valores reales finitos.");
    return value;
  };
  const F=at(0,0),xp=at(1,0),xm=at(-1,0),yp=at(0,1),ym=at(0,-1);
  const A=(xp+xm)/2-F,C=(yp+ym)/2-F,D=(xp-xm)/2,E=(yp-ym)/2;
  const B=at(1,1)-A-C-D-E-F;
  const coeffs={A,B,C,D,E,F};
  for(const [x,y] of [[2,0],[0,2],[2,3],[-2,-3],[.37,.91],[-1.25,2.5]]){
    const exact=at(x,y),predicted=A*x*x+B*x*y+C*y*y+D*x+E*y+F;
    if(Math.abs(exact-predicted)>1e-8*Math.max(1,Math.abs(exact),Math.abs(predicted)))
      throw new Error("La ecuación debe ser de segundo grado.");
  }
  parabolaFromGeneral(coeffs);
  return coeffs;
}
export function parabolaParametricPoint(g:ParabolaGeometry,t:number):ParabolaPoint{
  return parabolaPoint(g,g.p*t*t,2*g.p*t);
}
export function parabolaTangentNormal(g:ParabolaGeometry,t:number):{
  point:ParabolaPoint;tangent:ParabolaLine;normal:ParabolaLine;
}{
  const point=parabolaParametricPoint(g,t),c=Math.cos(g.rotation),s=Math.sin(g.rotation);
  const nx=-c-t*s,ny=-s+t*c;
  const tangent={a:nx,b:ny,c:-(nx*point[0]+ny*point[1])};
  const normal={a:-ny,b:nx,c:ny*point[0]-nx*point[1]};
  return {point,tangent,normal};
}
export function parabolaAxisIntersections(g:ParabolaGeometry):{
  x:ParabolaPoint[];y:ParabolaPoint[];
}{
  const {A,B,C,D,E,F}=g.coefficients;
  const roots=(a:number,b:number,c:number):number[]=>{
    const eps=1e-10*Math.max(1,Math.abs(a),Math.abs(b),Math.abs(c));
    if(Math.abs(a)<eps)return Math.abs(b)<eps?[]:[-c/b];
    const disc=b*b-4*a*c;
    if(disc< -eps)return [];
    if(Math.abs(disc)<=eps)return [-b/(2*a)];
    const root=Math.sqrt(Math.max(0,disc));
    return [(-b-root)/(2*a),(-b+root)/(2*a)].sort((x,y)=>x-y);
  };
  return {
    x:roots(A,D,F).map(x=>[x,0]),
    y:roots(C,E,F).map(y=>[0,y]),
  };
}
export function parabolaParametricTex(g:ParabolaGeometry):string{
  const fmtN=(n:number)=>String(Number(n.toPrecision(7))||0),u=Math.cos(g.rotation),v=Math.sin(g.rotation);
  const [h,k]=g.vertex;
  const expression=(start:number,quad:number,linear:number)=>{
    const terms=[[quad,"t^2"],[linear,"t"]] as const;
    return (Math.abs(start)<1e-11?"":fmtN(start))+
      terms.filter(([value])=>Math.abs(value)>1e-10)
        .map(([value,symbol])=>(value<0?"-":"+")+fmtN(Math.abs(value))+symbol).join("");
  };
  const x=expression(h,g.p*u,-2*g.p*v);
  const y=expression(k,g.p*v,2*g.p*u);
  const clean=(str:string)=>str.startsWith("+")?str.slice(1):str||"0";
  return "\\begin{cases}x(t)="+clean(x)+"\\\\y(t)="+clean(y)+"\\end{cases},\\quad t\\in\\mathbb{R}";
}
export function resolveParabola(node:Pick<ConicNode,"mode"|"center"|"focalParameter"|
 "axis"|"rotation"|"focus"|"directrix"|"A"|"B"|"C"|"D"|"E"|"F">):ParabolaGeometry{
  if(node.mode==="focus-directrix"){
    if(!node.focus||!node.directrix)throw new Error("Falta foco o directriz.");
    const {A,B,C}=node.directrix;
    return parabolaFromFocusDirectrix(node.focus,{a:A,b:B,c:C});
  }
  if(node.mode==="general"){
    const coeff=[node.A,node.B,node.C,node.D,node.E,node.F];
    if(coeff.some(value=>value===undefined))throw new Error("Faltan coeficientes generales.");
    return parabolaFromGeneral({
      A:node.A!,B:node.B!,C:node.C!,D:node.D!,E:node.E!,F:node.F!,
    });
  }
  return parabolaFromVertex(node.center??[0,0],node.focalParameter??1,
    node.axis??"x",node.rotation??0);
}
export function serializeParabolaBlock(mode:"canonical"|"focus-directrix"|"general",
  geom:ParabolaGeometry,options:Record<string,number|boolean|string>,
  extra?:{focus?:ParabolaPoint;directrix?:{A:number;B:number;C:number};
    coefficients?:ParabolaCoefficients},
):string{
  const lines=["```conic","conicType: parabola","mode: "+mode];
  if(mode==="focus-directrix"&&extra?.focus&&extra.directrix){
    lines.push("focus: "+JSON.stringify(extra.focus),
      "directrix: "+JSON.stringify(extra.directrix));
  }else if(mode==="general"&&extra?.coefficients){
    for(const key of ["A","B","C","D","E","F"] as const)
      lines.push(key+": "+extra.coefficients[key]);
  }else{
    lines.push("center: "+JSON.stringify(geom.vertex),"focalParameter: "+geom.p,
      "axis: x","rotation: "+geom.rotation);
  }
  for(const [name,value] of Object.entries(options))lines.push(name+": "+JSON.stringify(value));
  lines.push("```");
  return "\n"+lines.join("\n")+"\n";
}
