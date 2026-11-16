import type { ConicNode } from "@mathmd/ast";
import {
  hyperbolaAxisIntersections,hyperbolaParametricPoint,hyperbolaPoint,
  hyperbolaTangentNormal,resolveHyperbola,type HyperbolaGeometry,
  type HyperbolaPoint,type HyperbolaLine,type HyperbolaBranch,
} from "./hyperbolaGeometry.js";

export function hyperbolaView(node:Pick<ConicNode,"viewCenter"|"viewSpan">,g:HyperbolaGeometry){
  const viewCenter=node.viewCenter??g.center;
  const span=node.viewSpan??Math.max(4,g.c*1.7,g.b*2.1);
  const scale=Math.min(308/span,188/span);
  return {viewCenter,span,scale};
}
export function hyperbolaWorldFromSVG(
  node:Pick<ConicNode,"viewCenter"|"viewSpan">,g:HyperbolaGeometry,
  x:number,y:number,
):HyperbolaPoint{
  const {viewCenter,scale}=hyperbolaView(node,g);
  return [viewCenter[0]+(x-360)/scale,viewCenter[1]-(y-230)/scale];
}

/** One rotated Cartesian view for both branches and all constructions. */
export function createHyperbolaSVG(
  node:ConicNode,g:HyperbolaGeometry=resolveHyperbola(node),
):SVGSVGElement{
  const ns="http://www.w3.org/2000/svg";
  const make=(tag:string,attrs:Record<string,string|number>={})=>{
    const item=document.createElementNS(ns,tag);
    for(const [key,value] of Object.entries(attrs))item.setAttribute(key,String(value));
    return item;
  };
  const svg=make("svg",{xmlns:ns,viewBox:"0 0 720 460",role:"img",
    "aria-label":"Hipérbola con focos, asíntotas, rectángulo auxiliar y elementos geométricos"}) as SVGSVGElement;
  svg.style.width="100%";svg.style.maxHeight="460px";
  const {viewCenter,span,scale}=hyperbolaView(node,g),color=node.color??"#2563eb";
  const X=(x:number)=>360+(x-viewCenter[0])*scale;
  const Y=(y:number)=>230-(y-viewCenter[1])*scale;
  const line=(a:HyperbolaPoint,b:HyperbolaPoint,stroke:string,role:string,dashed=false,width=1.7)=>{
    svg.appendChild(make("line",{x1:X(a[0]),y1:Y(a[1]),x2:X(b[0]),y2:Y(b[1]),
      stroke,"stroke-width":width,"data-role":role,
      ...(dashed?{"stroke-dasharray":"6 5"}:{})}));
  };
  const through=(equation:HyperbolaLine,stroke:string,role:string,dashed=true,width=1.9)=>{
    const magnitude=Math.hypot(equation.a,equation.b);
    if(!(magnitude>1e-11))return;
    const distance=-(equation.a*viewCenter[0]+equation.b*viewCenter[1]+equation.c)/
      (magnitude*magnitude);
    const middle:HyperbolaPoint=[
      viewCenter[0]+distance*equation.a,viewCenter[1]+distance*equation.b,
    ];
    const dx=-equation.b/magnitude,dy=equation.a/magnitude,length=span*3;
    line([middle[0]-length*dx,middle[1]-length*dy],
      [middle[0]+length*dx,middle[1]+length*dy],stroke,role,dashed,width);
  };
  const marker=(p:HyperbolaPoint,name:string,role:string,fill="#0d9488",handle?:string)=>{
    if(handle&&node.showInteractiveControls===true){
      const hit=make("circle",{cx:X(p[0]),cy:Y(p[1]),r:13,fill:"transparent",
        "data-handle":handle,"data-role":role,tabindex:0,role:"button",
        "aria-label":"Arrastrar "+name});
      hit.setAttribute("class","bwjm-hyperbola-drag-handle");
      svg.appendChild(hit);
    }
    const dot=make("circle",{cx:X(p[0]),cy:Y(p[1]),r:4.7,fill,
      "data-role":role,...(handle&&node.showInteractiveControls===true?{"data-handle":handle}:{})});
    if(handle&&node.showInteractiveControls===true)dot.setAttribute("class","bwjm-hyperbola-drag-handle");
    svg.appendChild(dot);
    const label=make("text",{x:X(p[0])+7,y:Y(p[1])-9,fill,
      "font-size":12,"pointer-events":"none"});
    label.textContent=name;svg.appendChild(label);
  };
  const rect=make("rect",{width:720,height:460,fill:"transparent"});
  svg.appendChild(rect);
  const step=Math.max(.25,Math.pow(10,Math.floor(Math.log10(span/4))));
  const minX=viewCenter[0]-span*1.7,maxX=viewCenter[0]+span*1.7;
  const minY=viewCenter[1]-span*1.7,maxY=viewCenter[1]+span*1.7;
  for(let i=Math.ceil(minX/step);i<=Math.floor(maxX/step);i++)
    line([i*step,minY],[i*step,maxY],"#94a3b82b","grid",false,.65);
  for(let i=Math.ceil(minY/step);i<=Math.floor(maxY/step);i++)
    line([minX,i*step],[maxX,i*step],"#94a3b82b","grid",false,.65);
  line([0,minY],[0,maxY],"#64748b","cartesian-axis",false,1);
  line([minX,0],[maxX,0],"#64748b","cartesian-axis",false,1);

  if(node.showAxes!==false){
    const length=span*2;
    line(hyperbolaPoint(g,-length,0),hyperbolaPoint(g,length,0),
      "#c99a38","transverse-axis",true);
    line(hyperbolaPoint(g,0,-length),hyperbolaPoint(g,0,length),
      "#c99a38","conjugate-axis",true);
  }
  if(node.showRectangle){
    svg.appendChild(make("polygon",{points:g.rectangle.map(([x,y])=>X(x)+","+Y(y)).join(" "),
      stroke:"#8b5cf6","stroke-width":1.7,"stroke-dasharray":"5 4",
      fill:"#8b5cf6","fill-opacity":.045,"data-role":"auxiliary-rectangle"}));
  }
  if(node.showAsymptotes!==false)
    for(const asymptote of g.asymptotes)through(asymptote,"#d97706","asymptote",true,2);
  if(node.showDirectrices){
    for(const [i,directrix] of g.directrices.entries()){
      through(directrix,"#d97706","directrix",true,1.8);
      const p=hyperbolaPoint(g,i===0?-g.directrixOffset:g.directrixOffset,0);
      marker(p,i===0?"D₁":"D₂","directrix-foot","#d97706");
    }
  }
  const limit=Math.min(3.4,Math.max(1.75,Math.asinh(span*1.3/g.b)));
  // Curves remain visible above all construction layers.
  for(const branch of [-1,1] as const){
    const points:string[]=[];
    for(let j=0;j<=420;j++){
      const t=-limit+(2*limit*j/420);
      const [x,y]=hyperbolaParametricPoint(g,t,branch);
      points.push(X(x)+","+Y(y));
    }
    svg.appendChild(make("polyline",{points:points.join(" "),fill:"none",stroke:color,
      "stroke-width":3,"stroke-linejoin":"round","stroke-linecap":"round",
      "data-role":branch===1?"right-branch":"left-branch"}));
  }
  if(node.showLatusRectum){
    line(g.latusEndpoints[0],g.latusEndpoints[1],
      "#8b5cf6","latus-rectum",false,2.2);
    line(g.latusEndpoints[2],g.latusEndpoints[3],
      "#8b5cf6","latus-rectum",false,2.2);
    for(const [index,p] of g.latusEndpoints.entries())
      marker(p,"L"+(index+1),"latus-endpoint","#8b5cf6");
  }
  if(node.showFocus!==false){
    marker(g.focus1,"F₁","focus","#be6d39","focus1");
    marker(g.focus2,"F₂","focus","#be6d39","focus2");
  }
  if(node.showVertices!==false){
    marker(g.vertices[0],"V₁","vertex","#0d9488","vertex1");
    marker(g.vertices[1],"V₂","vertex","#0d9488","vertex2");
  }
  if(node.showCoVertices){
    marker(g.conjugateVertices[0],"B₁","co-vertex","#2563eb","coVertex1");
    marker(g.conjugateVertices[1],"B₂","co-vertex","#2563eb","coVertex2");
  }
  if(node.showIntersections){
    const crossings=hyperbolaAxisIntersections(g);
    for(const [i,p] of crossings.x.entries())marker(p,"X"+(i+1),"axis-intersection","#db2777");
    for(const [i,p] of crossings.y.entries())marker(p,"Y"+(i+1),"axis-intersection","#db2777");
  }
  if(node.showTangent||node.showNormal){
    const branch=(node.hyperbolaBranch??1) as HyperbolaBranch;
    const selected=hyperbolaTangentNormal(g,node.tangentParameter??0,branch);
    if(node.showTangent)through(selected.tangent,"#ea7735","tangent",true,2.1);
    if(node.showNormal)through(selected.normal,"#a855f7","normal",true,2.1);
    marker(selected.point,"T","tangent-point","#ea7735","tangentParameter");
  }
  if(node.showCenter!==false)marker(g.center,"C","center","#0f766e","center");
  return svg;
}
