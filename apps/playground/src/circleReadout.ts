import type { ConicNode } from "@mathmd/ast";
import { resolveCircle, type CircleGeometry } from "./circleGeometry.js";
import { circleAuxiliaryLines, circleLineTex } from "./circleConstructions.js";
import { exactAxisIntersections, exactRadiusAndMeasures, exactScalarTex } from "./circleExact.js";

export interface CircleReadoutMetric { label:string;value:string;math?:boolean }
export const circleNumber=(number:number):string=>{
  if(!Number.isFinite(number))return "Indeterminado";
  return String(Number(number.toPrecision(8))||0);
};
const formatPoint=(point:readonly[number,number]):string=>
  "\\left("+exactScalarTex(point[0])+",\\;"+exactScalarTex(point[1])+"\\right)";
const gcd=(a:number,b:number):number=>{
  a=Math.abs(a);b=Math.abs(b);while(b)[a,b]=[b,a%b];return a||1;
};
/** SVG stores degrees; this readout always presents radians, simplifying rational pi. */
export function degreesToPiRadians(degrees:number):string{
  if(!Number.isFinite(degrees))return "\\text{Indeterminado}";
  const ratio=degrees/180;
  for(let denominator=1;denominator<=360;denominator++){
    const numerator=Math.round(ratio*denominator);
    if(Math.abs(ratio-numerator/denominator)>1e-10)continue;
    if(numerator===0)return "0";
    const divisor=gcd(numerator,denominator),p=numerator/divisor,q=denominator/divisor;
    const top=(Math.abs(p)===1?"":Math.abs(p))+"\\pi";
    return (p<0?"-":"")+(q===1?top:"\\frac{"+top+"}{"+q+"}");
  }
  return "\\approx "+circleNumber(degrees*Math.PI/180)+"\\;\\mathrm{rad}";
}
export function getCircleReadout(
  node:Pick<ConicNode,
    "mode"|"showEquation"|"showRadius"|"showDiameter"|"showChord"|
    "showSecant"|"showTangent"|"radiusAngle"|"diameterAngle"|"chordStartAngle"|
    "chordEndAngle"|"secantStartAngle"|"secantEndAngle"|"tangentAngle"|
    "tangentMode"|"tangentPoint">,
  geometry:CircleGeometry,
):CircleReadoutMetric[]{
  const measures=exactRadiusAndMeasures(geometry,
    node.mode==="general"||node.mode==="three-points");
  const intercepts=exactAxisIntersections(geometry);
  const values:CircleReadoutMetric[]=[
    {label:"Definición",value:node.mode==="three-points"?"Tres puntos":
      node.mode==="general"?"Ecuación general":
      node.mode==="canonical"?"Ecuación canónica":"Centro y radio"},
    {label:"Centro",value:formatPoint(geometry.center),math:true},
    {label:"Radio",value:measures.radius,math:true},
    {label:"Diámetro",value:measures.diameter,math:true},
    {label:"Longitud de circunferencia",value:measures.length,math:true},
    {label:"Área del círculo",value:measures.area,math:true},
  ];
  if(node.showEquation!==false)values.push(
    {label:"Ecuación canónica",value:geometry.canonicalTex,math:true},
    {label:"Ecuación general",value:geometry.generalTex,math:true},
  );
  values.push(
    {label:"Cortes con eje X",value:intercepts.x,math:intercepts.x!=="Ninguno"},
    {label:"Cortes con eje Y",value:intercepts.y,math:intercepts.y!=="Ninguno"},
  );
  const angle=(label:string,degrees:number)=>values.push({
    label,value:degreesToPiRadians(degrees),math:true,
  });
  if(node.showRadius)angle("Dirección del radio",node.radiusAngle??30);
  if(node.showDiameter)angle("Dirección del diámetro",node.diameterAngle??0);
  if(node.showChord){
    angle("Cuerda: ángulo inicial",node.chordStartAngle??35);
    angle("Cuerda: ángulo final",node.chordEndAngle??140);
  }
  if(node.showSecant){
    angle("Secante: ángulo inicial",node.secantStartAngle??220);
    angle("Secante: ángulo final",node.secantEndAngle??300);
  }
  if(node.showTangent&&node.tangentMode!=="point")
    angle("Punto de tangencia: ángulo",node.tangentAngle??60);

  const lines=circleAuxiliaryLines(node,geometry);
  let tangents=0;
  for(const item of lines){
    const name=item.kind==="tangent"?"Tangente "+(++tangents):
      item.kind==="chord"?"Cuerda":"Secante";
    values.push({label:name+" · ecuación",value:circleLineTex(item.line),math:true});
    if(item.kind==="tangent")
      values.push({label:name+" · contacto",value:formatPoint(item.touches[0]),math:true});
  }
  if(node.showTangent&&node.tangentMode==="point"&&node.tangentPoint){
    values.push({label:"Punto P de tangencia",value:formatPoint(node.tangentPoint),math:true});
    if(!tangents)values.push({label:"Tangentes reales",value:"Ninguna: P está dentro del círculo"});
  }
  return values;
}
export function circleMetricsForNode(node:ConicNode):CircleReadoutMetric[]{
  return getCircleReadout(node,resolveCircle(node));
}
