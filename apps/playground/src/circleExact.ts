import type { CircleGeometry } from "./circleGeometry.js";

/** Exact rational recovery is deliberately conservative: no 0.3333 -> 1/3 guesses. */
export interface Rational { numerator:number; denominator:number }
const gcd=(a:number,b:number):number=>{
  a=Math.abs(a);b=Math.abs(b);while(b)[a,b]=[b,a%b];return a||1;
};
export function rationalNumber(value:number):Rational|null{
  if(!Number.isFinite(value)||Math.abs(value)>1e6)return null;
  for(let d=1;d<=1000;d++){
    const n=Math.round(value*d);
    if(Math.abs(n)>2e8)continue;
    if(Math.abs(value-n/d)<=3e-13*Math.max(1,Math.abs(value))){
      const div=gcd(n,d);
      return {numerator:n/div,denominator:d/div};
    }
  }
  return null;
}
const fmt=(value:number)=>String(Number(value.toPrecision(8))||0);
const rationalTex=(value:Rational):string=>{
  if(value.denominator===1)return String(value.numerator);
  const decimal=value.numerator/value.denominator;
  // Short terminating decimals remain readable, but exact recurring fractions do not.
  const str=String(decimal);
  if(!str.includes("e")&&str.includes(".")&&str.split(".")[1].length<=4)
    return str;
  return "\\frac{"+value.numerator+"}{"+value.denominator+"}";
};
export function exactScalarTex(value:number):string{
  const rational=rationalNumber(value);
  return rational?rationalTex(rational):"\\approx "+fmt(value);
}
/** Return the exact positive square root of a rational radicand when recognizable. */
export function exactRootTex(square:number):string|null{
  if(square < -1e-12)return null;
  if(Math.abs(square)<=1e-12)return "0";
  const q=rationalNumber(square);
  if(!q || q.numerator<=0 || q.numerator*q.denominator>1e9)return null;
  // sqrt(p/q) = sqrt(p*q)/q; pull out maximal perfect-square factor.
  let inside=q.numerator*q.denominator,outside=1;
  for(let factor=2;factor*factor<=inside;factor++){
    while(inside%(factor*factor)===0){
      inside/=factor*factor;
      outside*=factor;
    }
  }
  const common=gcd(outside,q.denominator);
  outside/=common;
  const denominator=q.denominator/common;
  const top=inside===1?String(outside):
    (outside===1?"":String(outside))+"\\sqrt{"+inside+"}";
  return denominator===1?top:"\\frac{"+top+"}{"+denominator+"}";
}
const exactSignedRoot=(center:number,square:number,sign:-1|1):string=>{
  const root=exactRootTex(square);
  if(root===null)return "\\approx "+fmt(center+sign*Math.sqrt(Math.max(0,square)));
  if(root==="0")return exactScalarTex(center);
  const base=rationalNumber(center);
  if(!base)return "\\approx "+fmt(center+sign*Math.sqrt(Math.max(0,square)));
  const rootValue=Math.sqrt(Math.max(0,square));
  const result=rationalNumber(center+sign*rootValue);
  if(result)return rationalTex(result);
  const baseTex=base.numerator===0?"":rationalTex(base);
  const isSimple=/^[0-9]+$/.test(root)||root.startsWith("\\frac{");
  const term=isSimple&&root.startsWith("\\frac{")?"\\left("+root+"\\right)":root;
  return baseTex?(baseTex+(sign>0?"+":"-")+term):(sign<0?"-":"")+term;
};
const exactPair=(x:string,y:string):string=>"\\left("+x+",\\;"+y+"\\right)";
/** Mathematically derived intercepts preserve radicals, fractions or marked approximations. */
export function exactAxisIntersections(geometry:CircleGeometry):{
  x:string; y:string;
}{
  const [h,k]=geometry.center,r2=geometry.radius*geometry.radius;
  const axis=(shift:number,anchor:number,horizontal:boolean):string=>{
    const square=r2-shift*shift;
    if(square< -1e-10*Math.max(1,r2))return "Ninguno";
    const a=exactSignedRoot(anchor,Math.max(0,square),-1);
    const b=exactSignedRoot(anchor,Math.max(0,square),1);
    const point=(coord:string)=>horizontal?exactPair(coord,"0"):exactPair("0",coord);
    return Math.sqrt(Math.max(0,square))<=1e-9?point(a):point(a)+",\\;"+point(b);
  };
  return {x:axis(k,h,true),y:axis(h,k,false)};
}
export function exactRadiusAndMeasures(geometry:CircleGeometry,allowRoot:boolean):{
  radius:string;diameter:string;length:string;area:string;
}{
  const r=geometry.radius;
  const root=allowRoot?exactRootTex(r*r):null;
  const radius=root&&root!=="0"?root:exactScalarTex(r);
  const double=exactScalarTex(2*r);
  const coefficient=exactScalarTex(r*r);
  const pi=(value:string)=>value==="1"?"\\pi":value==="0"?"0":value+"\\pi";
  const length=root&&root!=="0"?
    (root.startsWith("\\sqrt")?"2"+root+"\\pi":root.startsWith("\\frac")?"2\\left("+root+"\\right)\\pi":
      pi(exactScalarTex(2*r))):pi(double);
  return {radius,diameter:root&&root!=="0"?"2\\left("+root+"\\right)":double,
    length,area:pi(coefficient)};
}
