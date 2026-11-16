import type { EllipseCoefficients } from "./ellipseEquation.js";
import { exactRootTex, exactScalarTex, rationalNumber } from "./circleExact.js";

const point=(x:string,y:string)=>"\\left("+x+",\\;"+y+"\\right)";
const solve=(a:number,b:number,c:number):string[]=>{
  const disc=b*b-4*a*c,eps=1e-11*Math.max(1,Math.abs(b*b),Math.abs(4*a*c));
  if(disc< -eps)return [];
  const h=-b/(2*a);
  if(Math.abs(disc)<=eps)return [exactScalarTex(h)];
  const square=disc/(4*a*a),r=Math.sqrt(Math.max(0,square));
  const approximate=[h-r,h+r].sort((x,y)=>x-y);
  if([a,b,c].some(v=>!rationalNumber(v))||!rationalNumber(square)||!rationalNumber(h))
    return approximate.map(exactScalarTex);
  const root=exactRootTex(square);
  if(root===null)return approximate.map(exactScalarTex);
  const base=Math.abs(h)<1e-12?"":exactScalarTex(h);
  return approximate.map((value,index)=>{
    const rational=rationalNumber(value);
    if(rational)return exactScalarTex(value);
    if(base)return base+(index===0?"-":"+")+root;
    return index===0?"-"+root:root;
  });
};
/** For rational quadratic coefficients prefer exact intercepts with simplified radicals. */
export function ellipseAxisCrossingTex(coefficients:EllipseCoefficients):{
  x:string;y:string;
}{
  const format=(roots:string[],horizontal:boolean)=>roots.length
    ? roots.map(root=>horizontal?point(root,"0"):point("0",root)).join(",\\;"):"Ninguno";
  return {
    x:format(solve(coefficients.A,coefficients.D,coefficients.F),true),
    y:format(solve(coefficients.C,coefficients.E,coefficients.F),false),
  };
}
