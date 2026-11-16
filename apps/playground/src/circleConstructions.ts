import type { ConicNode } from "@mathmd/ast";
import type { CircleGeometry } from "./circleGeometry.js";

export type CirclePoint = [number,number];
export type CircleAngleKey = "radiusAngle"|"diameterAngle"|"chordStartAngle"|
  "chordEndAngle"|"secantStartAngle"|"secantEndAngle"|"tangentAngle";
export interface CircleLine { a:number; b:number; c:number }
export interface CircleAuxiliaryLine {
  kind:"tangent"|"chord"|"secant";
  line:CircleLine;
  touches:CirclePoint[];
  through?:CirclePoint;
}
const EPS=1e-9;
export const circlePointAt=(geo:CircleGeometry,degrees:number):CirclePoint=>{
  const theta=degrees*Math.PI/180;
  return [geo.center[0]+geo.radius*Math.cos(theta),
    geo.center[1]+geo.radius*Math.sin(theta)];
};
export const angleAtCircle=(center:readonly number[],point:readonly number[]):number=>
  Math.atan2(point[1]-center[1],point[0]-center[0])*180/Math.PI;
export const angleDifference=(a:number,b:number):number=>
  Math.abs(Math.sin((a-b)*Math.PI/360));

export const lineThrough=(first:CirclePoint,second:CirclePoint):CircleLine|null=>{
  const dx=second[0]-first[0],dy=second[1]-first[1];
  if(Math.hypot(dx,dy)<EPS)return null;
  return {a:-dy,b:dx,c:dy*first[0]-dx*first[1]};
};
const tangentAt=(center:CirclePoint,point:CirclePoint):CircleLine=>{
  const a=point[0]-center[0],b=point[1]-center[1];
  return {a,b,c:-a*point[0]-b*point[1]};
};
export function tangentsFromPoint(geo:CircleGeometry,point:CirclePoint):CircleAuxiliaryLine[]{
  const [vx,vy]=[point[0]-geo.center[0],point[1]-geo.center[1]];
  const distance2=vx*vx+vy*vy,r2=geo.radius*geo.radius;
  if(!point.every(Number.isFinite)||distance2<r2-EPS*Math.max(1,r2))return [];
  if(Math.abs(distance2-r2)<=EPS*Math.max(1,r2)){
    return [{kind:"tangent",line:tangentAt(geo.center,point),touches:[point],through:point}];
  }
  const factor=r2/distance2;
  const perpendicular=geo.radius*Math.sqrt(Math.max(0,distance2-r2))/distance2;
  return [-1,1].map(sign=>{
    const touch:CirclePoint=[
      geo.center[0]+factor*vx+sign*perpendicular*(-vy),
      geo.center[1]+factor*vy+sign*perpendicular*vx,
    ];
    return {kind:"tangent",line:tangentAt(geo.center,touch),touches:[touch],through:point};
  });
}
export function circleAuxiliaryLines(
  node:Pick<ConicNode,"showChord"|"showSecant"|"showTangent"|"chordStartAngle"|
    "chordEndAngle"|"secantStartAngle"|"secantEndAngle"|"tangentAngle"|
    "tangentMode"|"tangentPoint">,geo:CircleGeometry,
):CircleAuxiliaryLine[]{
  const results:CircleAuxiliaryLine[]=[];
  if(node.showChord){
    const a=circlePointAt(geo,node.chordStartAngle??35);
    const b=circlePointAt(geo,node.chordEndAngle??140);
    const line=lineThrough(a,b);
    if(line)results.push({kind:"chord",line,touches:[a,b]});
  }
  if(node.showSecant){
    const a=circlePointAt(geo,node.secantStartAngle??220);
    const b=circlePointAt(geo,node.secantEndAngle??300);
    const line=lineThrough(a,b);
    if(line)results.push({kind:"secant",line,touches:[a,b]});
  }
  if(node.showTangent){
    if(node.tangentMode==="point"&&node.tangentPoint){
      results.push(...tangentsFromPoint(geo,node.tangentPoint));
    }else{
      const touch=circlePointAt(geo,node.tangentAngle??60);
      results.push({kind:"tangent",line:tangentAt(geo.center,touch),touches:[touch]});
    }
  }
  return results;
}
export function pointOnCircle(
  point:CirclePoint,geo:CircleGeometry,tolerance=1e-8,
):boolean=>Math.abs(Math.hypot(point[0]-geo.center[0],point[1]-geo.center[1])-geo.radius)
  <=tolerance*Math.max(1,geo.radius);

/** Normalize rational lines to primitive integers; otherwise signal an approximation. */
export function circleLineTex(line:CircleLine):string{
  const max=Math.max(Math.abs(line.a),Math.abs(line.b),Math.abs(line.c));
  if(!(max>0)||!Number.isFinite(max))return "\\text{Recta indeterminada}";
  let values=[line.a/max,line.b/max,line.c/max];
  const zero=(n:number)=>Math.abs(n)<1e-12?0:n;
  values=values.map(zero);
  let ints:number[]|undefined;
  for(let d=1;d<=120;d++){
    const ns=values.map(v=>Math.round(v*d));
    if(ns.every((v,i)=>Math.abs(v/d-values[i])<2e-11)&&ns.some(v=>v!==0)){
      ints=ns;break;
    }
  }
  let approximated=false;
  if(ints){
    const gcd=(x:number,y:number):number=>{x=Math.abs(x);y=Math.abs(y);while(y)[x,y]=[y,x%y];return x||1;};
    const div=ints.reduce((g,n)=>gcd(g,n),0);
    values=ints.map(v=>v/div);
  }else{
    values=values.map(v=>Number(v.toPrecision(6)));
    approximated=true;
  }
  const first=values.find(v=>Math.abs(v)>1e-12);
  if(first!==undefined&&first<0)values=values.map(v=>-v);
  const terms=values.map((v,i)=>{
    if(!v)return "";
    const symbol=["x","y",""][i];
    const abs=Math.abs(v);
    return { sign:v<0?"-":"+", text:(symbol&&Math.abs(abs-1)<1e-12?"":String(abs))+symbol };
  }).filter((v):v is {sign:string;text:string}=>Boolean(v));
  const expr=terms.map((part,i)=>(i===0&&part.sign==="+"?"":part.sign)+part.text).join("");
  return (approximated?"\\approx ":"")+expr+"=0";
}
