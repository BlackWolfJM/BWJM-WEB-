import type { ConicNode } from "@mathmd/ast";
import { ellipsePoint, resolveEllipse, type EllipseGeometry } from "./ellipseGeometry.js";
import { coefficientsFromEllipse, ellipseAxisCrossings, ellipseTangentNormal } from "./ellipseEquation.js";

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
  const wantsDirectrices=node.showDirectrices === true && geom.directrixOffset !== undefined;
  const visibleDirectrix=wantsDirectrices && geom.directrixOffset!<=a*4;
  const extent=node.viewSpan??Math.max(4,a*1.7,b*2,
    visibleDirectrix?geom.directrixOffset!*1.15:0);
  const view=node.viewCenter??center;
  const scale=Math.min(310/extent,190/extent);
  const X=(v:number)=>360+(v-view[0])*scale;
  const Y=(v:number)=>230-(v-view[1])*scale;
  const color=node.color??"#2563eb";
  const line=(from:[number,number],to:[number,number],stroke:string,role:string,dash=false)=>{
    svg.appendChild(make("line",{x1:X(from[0]),y1:Y(from[1]),x2:X(to[0]),y2:Y(to[1]),
      stroke,"stroke-width":1.8,"data-role":role,
      ...(dash?{"stroke-dasharray":"6 5"}:{})}));
  };
  const point=(x:number,y:number,label:string,role:string,fill="#0d9488",handle?:string)=>{
    if(handle&&node.showInteractiveControls===true){
      const hit=make("circle",{cx:X(x),cy:Y(y),r:13,fill:"transparent",
        "data-handle":handle,tabindex:0,role:"button","aria-label":"Arrastrar "+label,
        "data-role":role});
      hit.setAttribute("class","bwjm-ellipse-drag-handle");
      svg.appendChild(hit);
    }
    const dot=make("circle",{cx:X(x),cy:Y(y),r:4.5,fill,"data-role":role,
      ...(handle&&node.showInteractiveControls===true?{"data-handle":handle}:{})});
    if(handle&&node.showInteractiveControls===true)dot.setAttribute("class","bwjm-ellipse-drag-handle");
    svg.appendChild(dot);
    const txt=make("text",{x:X(x)+6,y:Y(y)-9,"font-size":12,fill,
      "pointer-events":"none"});
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
      line(ellipsePoint(geom,sign*delta,-extent),ellipsePoint(geom,sign*delta,extent),
        "#d97706","directrix",true);
    }
  } else if(wantsDirectrices){
    const notice=make("text",{x:14,y:24,fill:"#b45309","font-size":12,
      "data-role":"directrix-out-of-scale"});
    notice.textContent="Directrices fuera de escala; consulta sus ecuaciones";
    svg.appendChild(notice);
  }
  if(node.showLatusRectum){
    for(const sign of [-1,1]){
      const y=b*b/a;
      line(ellipsePoint(geom,sign*c,-y),ellipsePoint(geom,sign*c,y),
        "#8b5cf6","latus-rectum");
    }
  }
  if(node.showFocus !== false){
    point(...geom.focus1,"F₁","focus","#c66c37","focus1");
    point(...geom.focus2,"F₂","focus","#c66c37","focus2");
  }
  if(node.showVertices !== false){
    point(...geom.vertices[0],"V₁","vertex","#0d9488","vertex1");
    point(...geom.vertices[1],"V₂","vertex","#0d9488","vertex2");
  }
  if(node.showCoVertices){
    point(...geom.coVertices[0],"B₁","co-vertex","#2563eb","coVertex1");
    point(...geom.coVertices[1],"B₂","co-vertex","#2563eb","coVertex2");
  }
  if(node.showIntersections){
    const original=node.mode==="general"&&[node.A,node.B,node.C,node.D,node.E,node.F].every(Number.isFinite)
      ? {A:node.A!,B:node.B!,C:node.C!,D:node.D!,E:node.E!,F:node.F!}
      : coefficientsFromEllipse(center,a,b,rotation);
    const crossings=ellipseAxisCrossings(original);
    for(const [i,p] of crossings.x.entries())point(...p,"X"+(i+1),"axis-intersection","#db2777");
    for(const [i,p] of crossings.y.entries())point(...p,"Y"+(i+1),"axis-intersection","#db2777");
  }
  if(node.showTangent||node.showNormal){
    const data=ellipseTangentNormal(geom,(node.tangentAngle??45)*Math.PI/180);
    const through=(nx:number,ny:number,stroke:string,role:string)=>{
      const magnitude=Math.hypot(nx,ny);
      if(!(magnitude>0))return;
      const dx=-ny/magnitude,dy=nx/magnitude,spread=extent*1.2;
      line([data.point[0]-spread*dx,data.point[1]-spread*dy],
        [data.point[0]+spread*dx,data.point[1]+spread*dy],stroke,role,true);
    };
    if(node.showTangent)through(data.tangent.a,data.tangent.b,"#e87934","tangent");
    if(node.showNormal)through(data.normal.a,data.normal.b,"#a855f7","normal");
    point(...data.point,"T","tangent-point","#e87934","tangentAngle");
  }
  if(node.showCenter !== false)point(...center,"C","center","#0d9488","center");
  return svg;
}
