import type { SourceRange } from "@mathmd/ast";
import { parseMathMD } from "@mathmd/parser";
import type { ConicNode } from "@mathmd/ast";
import { circleFromCenterRadius, resolveCircle, type CircleGeometry } from "./circleGeometry.js";
import type { CircleInteraction } from "./circleDrag.js";
import { ellipseFromCenter, resolveEllipse, type EllipseGeometry } from "./ellipseGeometry.js";
import { coefficientsFromEllipse } from "./ellipseEquation.js";
import type { EllipseInteraction } from "./ellipseDrag.js";

type GraphOptionValue = boolean | number | string | readonly number[];

type SupportedBlock = "conic" | "curve3d" | "surface3d" | "parametric2d" | "vector2d" | "vector3d" |
  "crossproduct" | "line3d" | "plane3d" | "plot2d" | "vectorfield2d" | "flow2d" | "datachart" | "calculusviz";
const colorBlocks = new Set<SupportedBlock>([
  "conic", "plot2d", "surface3d", "curve3d", "parametric2d", "vectorfield2d", "flow2d", "datachart", "calculusviz",
]);
const crossProductOptions = new Set([
  "showPlane", "showNormal", "showArea", "showTriangle", "showVolume", "showSteps",
  "reverseOrder", "showDeterminant", "showRightHand",
  "showAnticommutative", "showDistributive", "showIdentities",
  "showCollapse", "collapseFactor", "collapseTarget",
  "showSignChallenge", "signChallengeMode", "signChallengeSeed",
]);
const line3dOptions = new Set([
  "showPoint", "showDirection", "showSegment", "segmentT", "tDomain",
  "paramName", "color", "colorPoint", "colorDirection", "labelPoint", "labelDirection", "label",
]);
const plane3dOptions = new Set([
  "mode", "showPoint", "showNormal", "showIntercepts", "xDomain", "yDomain",
  "color", "colorPoint", "colorNormal", "opacity", "labelPoint", "labelNormal", "labelU", "labelV", "label",
  // point-normal
  "point", "normal",
  // three-points
  "pointA", "pointB", "pointC",
  // point-vectors / parametric
  "vectorU", "vectorV",
  // general
  "A", "B", "C", "D",
]);
const allowedBooleanSettings = new Set([
  "animated", "showInfo", "showLegend", "showTNB", "showVectors",
  "contours", "showTrail", "showVelocity", "showAcceleration",
  "showTangent", "showNormal", "followParticle", "showSteps", "showPlane", "showArea",
  "grid", "showParticles",
]);

/**
 * Persist a supported property in a single .bwjm graph block.
 * The source range must match exactly; never mutate other blocks.
 */
function updateGraphField(
  source: string,
  range: SourceRange,
  blockType: SupportedBlock,
  key: string,
  value: GraphOptionValue | undefined,
): string {
  const { start, end } = range;
  if (!Number.isInteger(start.offset) || !Number.isInteger(end.offset) ||
    start.offset < 0 || end.offset > source.length || end.offset <= start.offset) return source;
  const original = source.slice(start.offset, end.offset);
  const fence = String.fromCharCode(96).repeat(3);
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  const lines = original.split(/\r?\n/);
  if (lines[0].trim() !== fence + blockType || lines[lines.length - 1].trim() !== fence) return source;
  const setting = new RegExp("^\\s*" + key + "\\s*:");
  const matching: number[] = [];
  for (let i = 1; i < lines.length - 1; i++) if (setting.test(lines[i])) matching.push(i);
  if (matching.length > 1) return source;
  const next = [...lines];
  if (value === undefined) {
    if (!matching.length) return source;
    next.splice(matching[0], 1);
    return source.slice(0, start.offset) + next.join(newline) + source.slice(end.offset);
  }
  const entry = key + ": " + JSON.stringify(value);
  if (matching.length) {
    const index = matching[0];
    const indent = lines[index].match(/^\s*/)?.[0] ?? "";
    if (Array.isArray(value)) {
      // A YAML sequence can continue on indented lines, or with unindented dashes.
      const continuation: number[] = [];
      for (let i = index + 1; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith("#")) continue;
        if (!lines[i].startsWith(indent + " ") && !lines[i].startsWith(indent + "- ") &&
          !(lines[index].includes("[") && line.startsWith("]"))) break;
        continuation.push(i);
      }
      continuation.reverse().forEach(line => next.splice(line, 1));
    }
    next[index] = indent + entry;
  } else next.splice(-1, 0, entry);
  return source.slice(0, start.offset) + next.join(newline) + source.slice(end.offset);
}

export function updateGraphOption(
  source: string,
  range: SourceRange,
  blockType: SupportedBlock,
  key: string,
  value: GraphOptionValue,
): string {
  if ((colorBlocks.has(blockType) && key === "color") ||
    (blockType === "crossproduct" && (key === "colorU" || key === "colorPlane")) ||
    (blockType === "surface3d" && key === "contourColor")) {
    if (typeof value !== "string" || !/^#[\da-f]{6}$/i.test(value)) return source;
    return updateGraphField(source, range, blockType, key, value);
  }
  if (blockType === "conic") {
    const allowed=new Set([
      "showCenter","showRadius","showDiameter","showChord","showSecant",
      "showTangent","showIntersections","showEquation","showInteractiveControls",
      "showFocus","showVertices","showAxes","showDirectrices","showCoVertices","showLatusRectum",
      "showNormal","showParametric",
    ]);
    if (!allowed.has(key) || typeof value !== "boolean") return source;
    const updated=updateGraphField(source,range,blockType,key,value);
    const end=range.end.offset+updated.length-source.length;
    const parsed=parseMathMD(updated.slice(range.start.offset,end)).children[0];
    return parsed?.type==="conic" ? updated : source;
  }
  if (blockType === "crossproduct") {
    if (!crossProductOptions.has(key)) return source;
    const updated = updateGraphField(source, range, blockType, key, value);
    if (updated === source) return source;
    const end = range.end.offset + updated.length - source.length;
    const node = parseMathMD(updated.slice(range.start.offset, end)).children[0];
    return node?.type === "crossproduct" ? updated : source;
  }
  if (blockType === "line3d") {
    if (!line3dOptions.has(key)) return source;
    const updated = updateGraphField(source, range, blockType, key, value);
    if (updated === source) return source;
    const end = range.end.offset + updated.length - source.length;
    const node = parseMathMD(updated.slice(range.start.offset, end)).children[0];
    return node?.type === "line3d" ? updated : source;
  }
  if (blockType === "plane3d") {
    if (!plane3dOptions.has(key)) return source;
    const updated = updateGraphField(source, range, blockType, key, value);
    if (updated === source) return source;
    const end = range.end.offset + updated.length - source.length;
    const node = parseMathMD(updated.slice(range.start.offset, end)).children[0];
    return node?.type === "plane3d" ? updated : source;
  }
  if (typeof value !== "boolean" && typeof value !== "number") return source;
  if (!allowedBooleanSettings.has(key)) return source;
  if (key === "showPlane" || key === "showArea") return source;
  const vector = blockType === "vector2d" || blockType === "vector3d";
  if ((vector && key !== "showSteps") || (!vector && key === "showSteps"))
    return source;
  return updateGraphField(source, range, blockType, key, value);
}

export function resetSurfaceColor(source: string, range: SourceRange): string {
  const updated = updateGraphField(source, range, "surface3d", "color", undefined);
  const end = range.end.offset + updated.length - source.length;
  return updated !== source && parseMathMD(updated.slice(range.start.offset, end)).children[0]?.type === "surface3d"
    ? updated : source;
}

export function updateCrossProductVector(
  source: string,
  range: SourceRange,
  key: "u" | "v" | "w" | "origin",
  value: readonly [number, number, number],
): string {
  if (value.length !== 3 || !value.every(Number.isFinite)) return source;
  const updated = updateGraphField(source, range, "crossproduct", key, value);
  if (updated === source) return source;
  const end = range.end.offset + updated.length - source.length;
  const node = parseMathMD(updated.slice(range.start.offset, end)).children[0];
  return node?.type === "crossproduct" && node[key]?.every((component, index) => component === value[index])
    ? updated : source;
}

/** Validated slider preference, stored in the native parametric2d block. */
export function updateGraphNumericOption(
  source: string,
  range: SourceRange,
  blockType: "parametric2d",
  key: "trailLength",
  value: number,
): string {
  if (key !== "trailLength" || !Number.isInteger(value) ||
    value < 2 || value > 500) return source;
  return updateGraphField(source, range, blockType, key, value);
}


/** Numeric circle controls persist center/radius into the same .bwjm block. */
export function updateCircleDimensions(
  source:string,range:SourceRange,center:readonly [number,number],radius:number,
):string {
  if(!center.every(Number.isFinite)||!Number.isFinite(radius)||radius<=0||radius>10000||
    center.some(v=>Math.abs(v)>10000))return source;
  const first=updateGraphField(source,range,"conic","center",center);
  const rangeAfter={...range,end:{...range.end,offset:range.end.offset+first.length-source.length}};
  const second=updateGraphField(first,rangeAfter,"conic","radius",radius);
  const end=range.end.offset+second.length-source.length;
  const parsed=parseMathMD(second.slice(range.start.offset,end)).children[0];
  return parsed?.type==="conic"&&
    parsed.mode!=="general"&&parsed.mode!=="three-points"&&
    parsed.radius===radius&&parsed.center?.every((v,i)=>v===center[i])?second:source;
}

/** Persist a canonical ellipse's editable parameters without touching other blocks. */
export function updateEllipseDimensions(
  source:string,range:SourceRange,center:readonly[number,number],a:number,b:number,
):string {
  if(!center.every(Number.isFinite)||center.some(v=>Math.abs(v)>10000)||
    !Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<=0||b>a||a>10000)return source;
  let next=source;
  let currentRange=range;
  for(const [key,value] of [
    ["center",center],["semiMajorAxis",a],["semiMinorAxis",b],
  ] as Array<[string,GraphOptionValue]>){
    const changed=updateGraphField(next,currentRange,"conic",key,value);
    currentRange={...currentRange,end:{...currentRange.end,
      offset:currentRange.end.offset+changed.length-next.length}};
    next=changed;
  }
  const parsed=parseMathMD(next.slice(range.start.offset,currentRange.end.offset)).children[0];
  return parsed?.type==="conic"&&parsed.conicType==="ellipse"&&
    (parsed.mode==="canonical"||parsed.mode==="center-axes")&&
    parsed.center?.every((v,i)=>v===center[i])&&
    parsed.semiMajorAxis===a&&parsed.semiMinorAxis===b?next:source;
}


/**
 * Persist circle interaction in the original construction mode. General circles
 * retain their quadratic coefficients and three-point circles keep three points.
 */
export function updateCircleInteraction(
  source:string,range:SourceRange,node:ConicNode,
  initial:CircleGeometry,change:CircleInteraction,
):string{
  const center=change.center??initial.center;
  const radius=change.radius??initial.radius;
  if(![...center,radius].every(Number.isFinite)||center.some(v=>Math.abs(v)>10000)||
    !(radius>0)||radius>10000)return source;
  let geometry:CircleGeometry;
  try{geometry=circleFromCenterRadius([center[0],center[1]],radius);}catch{return source;}
  const original=source.slice(range.start.offset,range.end.offset);
  if(!original.startsWith(String.fromCharCode(96).repeat(3)+"conic"))return source;
  const patches:Array<[string,GraphOptionValue]>=[];
  const moving=Boolean(change.center||change.radius);
  if(moving){
    if(node.mode==="general"){
      const factor=node.A??1;
      for(const key of ["A","B","C","D","E","F"] as const)
        patches.push([key,geometry.coefficients[key]*factor]);
    }else if(node.mode==="three-points"){
      const scale=radius/initial.radius;
      for(const key of ["pointA","pointB","pointC"] as const){
        const originalPoint=node[key];
        if(!originalPoint)return source;
        const point:[number,number]=[
          center[0]+scale*(originalPoint[0]-initial.center[0]),
          center[1]+scale*(originalPoint[1]-initial.center[1]),
        ];
        if(!point.every(Number.isFinite)||point.some(v=>Math.abs(v)>10000))return source;
        patches.push([key,point]);
      }
    }else if(node.mode==="canonical"||node.mode==="center-radius"||!node.mode){
      patches.push(["center",center],["radius",radius]);
    }else return source;
  }
  for(const [key,value] of Object.entries(change.angles??{})){
    if(!Number.isFinite(value)||Math.abs(value)>3600)return source;
    patches.push([key,value]);
  }
  if(change.tangentPoint){
    if(!change.tangentPoint.every(Number.isFinite))return source;
    patches.push(["tangentPoint",change.tangentPoint]);
  }
  if(!patches.length)return source;
  if(!node.viewCenter)patches.push(["viewCenter",initial.center]);
  if(!node.viewSpan)patches.push(["viewSpan",Math.max(3,initial.radius*1.55)]);
  let next=source,currentRange=range;
  for(const [key,value] of patches){
    const update=updateGraphField(next,currentRange,"conic",key,value);
    currentRange={...currentRange,end:{...currentRange.end,
      offset:currentRange.end.offset+update.length-next.length}};
    next=update;
  }
  const parsed=parseMathMD(next.slice(range.start.offset,currentRange.end.offset)).children[0];
  if(parsed?.type!=="conic"||parsed.conicType!=="circle")return source;
  try {
    const result=resolveCircle(parsed);
    if(Math.hypot(result.center[0]-center[0],result.center[1]-center[1])>1e-6||
       Math.abs(result.radius-radius)>1e-6)return source;
  }catch{return source;}
  return next;
}


/** One validated, mode-preserving update for ellipse pointer/keyboard interactions. */
export function updateEllipseInteraction(
  source:string,range:SourceRange,node:ConicNode,
  original:EllipseGeometry,change:EllipseInteraction,
):string{
  const center=change.center??original.center;
  const a=change.a??original.a,b=change.b??original.b;
  let nextGeometry:EllipseGeometry;
  try{nextGeometry=ellipseFromCenter(center,a,b,"x",original.rotation);}catch{return source;}
  const patches:Array<[string,GraphOptionValue]>=[];
  if(change.center||change.a!==undefined||change.b!==undefined){
    if(node.mode==="foci"){
      patches.push(["focus1",nextGeometry.focus1],["focus2",nextGeometry.focus2],
        ["sumDistances",2*nextGeometry.a]);
    }else if(node.mode==="general"){
      const baseline=coefficientsFromEllipse(original.center,original.a,original.b,original.rotation);
      const factor=(node.A??baseline.A)/baseline.A;
      const next=coefficientsFromEllipse(center,a,b,original.rotation);
      for(const key of ["A","B","C","D","E","F"] as const)
        patches.push([key,next[key]*factor]);
    }else if(node.mode==="canonical"||node.mode==="center-axes"){
      patches.push(["center",center],["semiMajorAxis",a],["semiMinorAxis",b]);
    }else return source;
  }
  if(change.tangentAngle!==undefined){
    if(!Number.isFinite(change.tangentAngle)||Math.abs(change.tangentAngle)>3600)return source;
    patches.push(["tangentAngle",change.tangentAngle]);
  }
  if(patches.length===0)return source;
  if(!node.viewCenter)patches.push(["viewCenter",original.center]);
  if(!node.viewSpan)patches.push(["viewSpan",Math.max(4,original.a*1.7,original.b*2,
    node.showDirectrices&&original.directrixOffset!==undefined&&
      original.directrixOffset<=original.a*4?original.directrixOffset*1.15:0)]);
  let nextSource=source,current=range;
  for(const [key,value] of patches){
    const changed=updateGraphField(nextSource,current,"conic",key,value);
    current={...current,end:{...current.end,offset:current.end.offset+changed.length-nextSource.length}};
    nextSource=changed;
  }
  const parsed=parseMathMD(nextSource.slice(range.start.offset,current.end.offset)).children[0];
  if(parsed?.type!=="conic"||parsed.conicType!=="ellipse")return source;
  try{
    const verified=resolveEllipse(parsed);
    const delta=Math.hypot(verified.center[0]-center[0],verified.center[1]-center[1]);
    if(delta>1e-5*Math.max(1,a)||Math.abs(verified.a-a)>1e-5*Math.max(1,a)||
      Math.abs(verified.b-b)>1e-5*Math.max(1,b))return source;
  }catch{return source;}
  return nextSource;
}
