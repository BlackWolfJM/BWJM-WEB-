import type { ConicNode } from "@mathmd/ast";
import { ellipsePoint, resolveEllipse, type EllipseGeometry } from "./ellipseGeometry.js";

/** A single SVG scene with curve, geometry aids and labels, independent of any other conic. */
export function createEllipseSVG(
  node: ConicNode, geom: EllipseGeometry = resolveEllipse(node),
):SVGSVGElement {
  const ns="http://www.w3.org/2000/svg";
  const make=(tag:string,attrs:Record<string,string|number>={})=>{
    const element=document.createElementNS(ns,tag);
    for(const [name,value] of Object.entries(attrs))element.setAttribute(name,String(value));
    return element;
  };
  const svg=make("svg",{xmlns:ns,viewBox:"0 0 720 460",
    role:"img","aria-label":"Elipse con focos, ejes y elementos geométricos"}) as SVGSVGElement;
  svg.style.width="100%";
  svg.style.maxHeight="460px";
  const {center,a,b,c,rotation}=geom;
  const visibleDirectrix=node.showDirectrices === true && geom.directrixOffset !== undefined &&
    geom.directrixOffset <= a*3.4;
  const extent=Math.max(4,a*1.7,b*2,visibleDirectrix?geom.directrixOffset!*1.15:0);
  const scale=Math.min(310/extent,190/extent);
  const X=(v:number)=>360+(v-center[0])*scale;
  const Y=(v:number)=>230-(v-center[1])*scale;
  const color=node.color??"#2563eb";
  const line=(from:[number,number],to:[number,number],stroke:string,role:string,dash=false)=>{
    svg.appendChild(make("line",{x1:X(from[0]),y1:Y(from[1]),x2:X(to[0]),y2:Y(to[1]),
      stroke,"stroke-width":1.8,"data-role":role,
      ...(dash?{"stroke-dasharray":"6 5"}:{})}));
  };
  const point=(x:number,y:number,label:string,role:string,fill="#0d9488")=>{
    svg.appendChild(make("circle",{cx:X(x),cy:Y(y),r:4.2,fill,"data-role":role}));
    const txt=make("text",{x:X(x)+6,y:Y(y)-9,"font-size":12,fill});
    txt.textContent=label;
    svg.appendChild(txt);
  };
  svg.appendChild(make("rect",{width:720,height:460,fill:"transparent"}));
  const step=Math.max(0.5,Math.pow(10,Math.floor(Math.log10(extent/4))));
  for(let i=-Math.ceil(extent/step);i<=Math.ceil(extent/step);i++){
    const x=center[0]+i*step,y=center[1]+i*step;
    line([x,center[1]-extent],[x,center[1]+extent],"#94a3b829","grid");
    line([center[0]-extent,y],[center[0]+extent,y],"#94a3b829","grid");
  }
  line([0,center[1]-extent],[0,center[1]+extent],"#64748b","axis");
  line([center[0]-extent,0],[center[0]+extent,0],"#64748b","axis");
  const coords:string[]=[];
  for(let index=0;index<=320;index++){
    const t=2*Math.PI*index/320;
    const [x,y]=ellipsePoint(geom,a*Math.cos(t),b*Math.sin(t));
    coords.push(X(x)+","+Y(y));
  }
  svg.appendChild(make("polygon",{points:coords.join(" "),fill:color,
    "fill-opacity":0.055,stroke:color,"stroke-width":2.8,"data-role":"ellipse-curve"}));
  if(node.showAxes !== false){
    line(geom.vertices[0],geom.vertices[1],"#c99635","major-axis",true);
    line(geom.coVertices[0],geom.coVertices[1],"#c99635","minor-axis",true);
  }
  if(visibleDirectrix){
    const delta=geom.directrixOffset!;
    for(const sign of [-1,1]){
      line(ellipsePoint(geom,sign*delta,-b*2.1),ellipsePoint(geom,sign*delta,b*2.1),
        "#d97706","directrix",true);
    }
  }
  if(node.showLatusRectum){
    for(const sign of [-1,1]){
      const y=b*b/a;
      line(ellipsePoint(geom,sign*c,-y),ellipsePoint(geom,sign*c,y),
        "#8b5cf6","latus-rectum");
    }
  }
  if(node.showFocus !== false){
    point(...geom.focus1,"F₁","focus","#c66c37");
    point(...geom.focus2,"F₂","focus","#c66c37");
  }
  if(node.showVertices !== false){
    point(...geom.vertices[0],"V₁","vertex");
    point(...geom.vertices[1],"V₂","vertex");
  }
  if(node.showCoVertices){
    point(...geom.coVertices[0],"B₁","co-vertex","#2563eb");
    point(...geom.coVertices[1],"B₂","co-vertex","#2563eb");
  }
  if(node.showTangent){
    const t=(node.tangentAngle??45)*Math.PI/180;
    const on=ellipsePoint(geom,a*Math.cos(t),b*Math.sin(t));
    const delta=ellipsePoint({center:[0,0],rotation},-a*Math.sin(t),b*Math.cos(t));
    const length=Math.hypot(delta[0],delta[1])||1;
    const dir:[number,number]=[delta[0]/length,delta[1]/length];
    const spread=extent*0.8;
    line([on[0]-spread*dir[0],on[1]-spread*dir[1]],
      [on[0]+spread*dir[0],on[1]+spread*dir[1]],"#e87934","tangent",true);
    point(...on,"T","tangent-point","#e87934");
  }
  if(node.showCenter !== false)point(...center,"C","center");
  return svg;
}
