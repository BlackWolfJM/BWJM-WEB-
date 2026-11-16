import type { ConicNode } from "@mathmd/ast";

export interface EllipseGeometry {
  center: [number,number];
  a: number;
  b: number;
  c: number;
  eccentricity: number;
  rotation: number;
  focus1: [number,number];
  focus2: [number,number];
  vertices: [[number,number],[number,number]];
  coVertices: [[number,number],[number,number]];
  canonicalTex: string;
  generalTex: string;
  transformTex?: string;
  latusRectum: number;
  directrixOffset?: number;
}
const clean=(v:number)=>Math.abs(v)<1e-11?0:Number(v.toPrecision(9));
const fmt=(v:number)=>String(clean(v));
const shifted=(name:string,v:number)=>"("+name+(v<0?"+"+fmt(-v):v>0?"-"+fmt(v):"")+")";
const addTerm=(value:number,symbol:string,first=false)=>{
  if(Math.abs(value)<1e-9)return "";
  const sign=value<0?"-":first?"":"+";
  const magnitude=Math.abs(value);
  return sign+(Math.abs(magnitude-1)<1e-9?"":fmt(magnitude))+symbol;
};
const finite=(numbers:number[])=>numbers.every(Number.isFinite);
export const ellipsePoint=(geometry:Pick<EllipseGeometry,"center"|"rotation">,
  u:number,v:number):[number,number]=>{
  const [h,k]=geometry.center,t=geometry.rotation;
  return [h+u*Math.cos(t)-v*Math.sin(t), k+u*Math.sin(t)+v*Math.cos(t)];
};
export function ellipseFromCenter(
  center:[number,number],a:number,b:number,axis:"x"|"y"="x",rotation=0,
):EllipseGeometry {
  if(!finite([...center,a,b,rotation])||a<=0||b<=0||a>10000||b>10000||
    b>a||center.some(v=>Math.abs(v)>10000))
    throw new Error("Se requieren centro finito y 0 < b ≤ a ≤ 10000.");
  const theta=rotation+(axis==="y"?Math.PI/2:0);
  const geometry={center,rotation:theta};
  const c=Math.sqrt(Math.max(0,a*a-b*b)),eccentricity=c/a;
  const focus1=ellipsePoint(geometry,-c,0),focus2=ellipsePoint(geometry,c,0);
  const vertices:[typeof focus1,typeof focus1]=[
    ellipsePoint(geometry,-a,0),ellipsePoint(geometry,a,0)];
  const coVertices:[typeof focus1,typeof focus1]=[
    ellipsePoint(geometry,0,-b),ellipsePoint(geometry,0,b)];
  const [h,k]=center;
  const x=shifted("x",h),y=shifted("y",k);
  const near=(v:number,target:number)=>Math.abs(Math.sin(v-target))<1e-10;
  const horizontal=near(theta,0) && Math.cos(theta)>0;
  const vertical=near(theta,Math.PI/2) && Math.sin(theta)>0;
  const denominatorA=fmt(a*a),denominatorB=fmt(b*b);
  const canonicalTex=horizontal
    ?"\\frac{"+x+"^2}{"+denominatorA+"}+\\frac{"+y+"^2}{"+denominatorB+"}=1"
    :vertical
    ?"\\frac{"+y+"^2}{"+denominatorA+"}+\\frac{"+x+"^2}{"+denominatorB+"}=1"
    :"\\frac{X^2}{"+denominatorA+"}+\\frac{Y^2}{"+denominatorB+"}=1";
  const tCos=fmt(Math.cos(theta)),tSin=fmt(Math.sin(theta));
  const transformTex=!horizontal&&!vertical
    ?"X="+tCos+x+"+"+tSin+y+",\\quad Y=-"+tSin+x+"+"+tCos+y : undefined;
  const ct=Math.cos(theta),st=Math.sin(theta),aa=b*b,bb=a*a;
  const A=aa*ct*ct+bb*st*st, B=2*(aa-bb)*ct*st,C=aa*st*st+bb*ct*ct;
  const D=-2*A*h-B*k,E=-B*h-2*C*k,F=A*h*h+B*h*k+C*k*k-a*a*b*b;
  const generalTex=[
    addTerm(A,"x^2",true),addTerm(B,"xy"),addTerm(C,"y^2"),
    addTerm(D,"x"),addTerm(E,"y"),addTerm(F,"")
  ].filter(Boolean).join("")+"=0";
  return {
    center,a,b,c,eccentricity,rotation:theta,focus1,focus2,vertices,coVertices,
    canonicalTex,generalTex,transformTex,latusRectum:2*b*b/a,
    directrixOffset:c>1e-10?a*a/c:undefined,
  };
}

export function ellipseFromFoci(
  focus1:[number,number],focus2:[number,number],sumDistances:number,
):EllipseGeometry {
  if(!finite([...focus1,...focus2,sumDistances])||sumDistances<=0||
    [...focus1,...focus2].some(v=>Math.abs(v)>10000))
    throw new Error("Introduce dos focos finitos y una suma de distancias positiva.");
  const dx=focus2[0]-focus1[0],dy=focus2[1]-focus1[1];
  const c=Math.hypot(dx,dy)/2,a=sumDistances/2;
  if(a<=c+1e-10*Math.max(1,a))
    throw new Error("La suma de distancias debe superar la distancia entre los focos.");
  const b=Math.sqrt((a-c)*(a+c));
  const center:[number,number]=[(focus1[0]+focus2[0])/2,(focus1[1]+focus2[1])/2];
  return ellipseFromCenter(center,a,b,"x",c>1e-10?Math.atan2(dy,dx):0);
}

/** Existing canonical documents stay valid; focal documents derive their actual axes. */
export function resolveEllipse(node:Pick<ConicNode,"mode"|"center"|"semiMajorAxis"|
 "semiMinorAxis"|"axis"|"rotation"|"focus1"|"focus2"|"sumDistances">):EllipseGeometry {
  if(node.mode==="foci"){
    if(!node.focus1||!node.focus2||!node.sumDistances)
      throw new Error("La definición por focos requiere dos focos y suma de distancias.");
    return ellipseFromFoci(node.focus1,node.focus2,node.sumDistances);
  }
  return ellipseFromCenter(node.center??[0,0],node.semiMajorAxis??3,
    node.semiMinorAxis??2,node.axis??"x",node.rotation??0);
}

export function serializeEllipseBlock(mode:"canonical"|"foci",
  geometry:EllipseGeometry,options:Record<string,number|boolean|string>,
  foci?:{focus1:[number,number];focus2:[number,number];sumDistances:number}):string {
  const rows=["\`\`\`conic","conicType: ellipse","mode: "+mode];
  if(mode==="foci" && foci){
    rows.push("focus1: "+JSON.stringify(foci.focus1),"focus2: "+JSON.stringify(foci.focus2),
      "sumDistances: "+foci.sumDistances);
  }else{
    rows.push("center: "+JSON.stringify(geometry.center),
      "semiMajorAxis: "+geometry.a,"semiMinorAxis: "+geometry.b,
      "axis: x","rotation: "+geometry.rotation);
  }
  for(const [name,value] of Object.entries(options)) rows.push(name+": "+JSON.stringify(value));
  rows.push("\`\`\`");
  return "\n"+rows.join("\n")+"\n";
}
