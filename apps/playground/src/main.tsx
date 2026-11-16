import React, { useState, useEffect, useRef, useMemo, useCallback, useSyncExternalStore, ChangeEvent } from "react";
import { renderToString } from "katex";
import "katex/dist/katex.min.css";
import { createRoot } from "react-dom/client";
import { parseMarkdown, parseMathMDWithMarkdown } from "@mathmd/parser";
import { MAX_LOCAL_IMAGE_BYTES, portableImageMarkdown, validateLocalRaster } from "./localImages.js";
import { compactImageEditor } from "./compactImageEditor.js";
import type { DocumentInsertSnapshot } from "./workspaceDocuments.js";
import { MathMDCore } from "@mathmd/core";
import { SVGRenderer } from "@mathmd/renderer-svg";
import { PlotlyRenderer } from "@mathmd/renderer-plotly";
import {
  findIntersections,
  computeExactArea,
  computeRiemannPartition,
  computeRevolutionVolume,
  computeCrossSection,
  computeKinematics,
  computeCrossProductScene,
  computeCrossProductStudy,
  describeCrossProductDeterminant,
  sampleVectorField2D,
  expressionToLatex,
  serializeScientificTable,
} from "@mathmd/math";
import type { CheckboxNode, MathMDNode, SliderNode, TimelineNode, DataTableNode, FunctionTableNode, Parametric2DNode } from "@mathmd/ast";
import type { CalculusVizResult, VectorStudyResult } from "@mathmd/math";
import { SidebarLeft, type OutlineItem, type SidebarTab, type SidebarMode } from "./SidebarLeft.js";
import {
  SIDEBAR_MODE_KEY, SIDEBAR_TAB_KEY,
  normalizeSidebarMode, normalizeSidebarTab,
  readSidebarPreference, saveSidebarPreference,
} from "./sidebarPreferences.js";
import { Ribbon, type RibbonAction } from "./Ribbon.js";
import { DocumentTabs } from "./DocumentTabs.js";
import { RIEMANN_LESSON_ID, computeRiemannLesson, updateRiemannLessonReport } from "./riemannLesson.js";
import { createCrossProductDeterminant, createCrossProductEditor, createCrossProductReport } from "./CrossProductEditor.js";
import { supportsAdaptiveParameters } from "./adaptiveGraphParameters.js";
import { resetSurfaceColor, updateCircleInteraction, updateEllipseDimensions, updateCrossProductVector, updateGraphOption, updateGraphNumericOption } from "./graphOptionSource.js";
import { DocumentSearch, type TextMatch } from "./DocumentSearch.js";
import { useDocumentWorkspace } from "./workspaceDocuments.js";
import { IconAtom, IconCheck } from "./icons.js";
import { FormulaModal } from "./FormulaModal.js";
import { createConicSVG } from "./conicFigure.js";
import { createCircleSVG } from "./circleFigure.js";
import { resolveCircle } from "./circleGeometry.js";
import { buildCircleReport } from "./circleReport.js";
import { buildEllipseReport } from "./ellipseReport.js";
import { createEllipseSVG } from "./ellipseFigure.js";
import { resolveEllipse } from "./ellipseGeometry.js";
import { mountEllipseControls } from "./ellipseControls.js";
import { mountCircleControls } from "./circleControls.js";
import { mountCircleDrag, type CircleInteraction } from "./circleDrag.js";
import type { FormulaKind, FormulaMode } from "./formulaComposer.js";
import { ImageModal, type ImageInsertion } from "./ImageModal.js";
import { insertEmbeddedImage } from "./documentImages.js";
import { createMarkdownReader } from "./markdownReader.js";
import "./markdownReader.css";
import markdownReaderStyles from "./markdownReader.css?inline";
import { ChartModal, chartKinds } from "./ChartModal.js";
import { CommandPalette, CommandItem } from "./CommandPalette.js";
import { createInlinePlayback, supportsInlinePlayback, type InlinePlaybackController } from "./inlineGraphPlayback.js";
import { readStoredTheme, persistStudioTheme, type StudioThemeId } from "./studioThemes.js";
import { persistDraft, getDraft, clearDraft } from "./workspaceDocuments.js";
import "./theme.css";

const graphLabels = new Map<string, string>(chartKinds);

function updateCalculusReport(report: HTMLElement, data: CalculusVizResult & { error?: string }): void {
  report.classList.toggle("has-error", Boolean(data.error));
  if (data.error) {
    report.textContent = "Error: " + data.error;
    return;
  }
  const format = (value: number, precision = 8) => Number.isFinite(value)
    ? String(Number(value.toPrecision(precision))) : "No determinado";
  const metric = document.createElement("strong");
  metric.textContent = data.valueLabel + ": " + format(data.value) + (data.unit === "valor" ? "" : " " + data.unit);
  const method = document.createElement("small");
  method.textContent = data.method;
  report.replaceChildren(metric, method);
  if (data.comparison) {
    const comparison = document.createElement("div");
    comparison.textContent = data.comparison.label + ": " + format(data.comparison.value) +
      " · Diferencia: " + format(data.comparison.difference, 4);
    report.append(comparison);
  }
  for (const message of data.warnings) {
    const warning = document.createElement("p");
    warning.className = "bwjm-calculus-warning";
    warning.textContent = message;
    report.append(warning);
  }
}

function updateTrajectoryReadout(
  panel: HTMLElement, trajectoryNode: Extract<MathMDNode, { type: "trajectory" | "curve3d" }>,
  vars: Readonly<Record<string, number>>, frameNode?: Extract<MathMDNode, { type: "frame" }>,
): void {
  const tVal = vars["t"] ?? (trajectoryNode.type === "curve3d" ? trajectoryNode.tDomain[0] : undefined) ?? 0;
  const x = trajectoryNode.x ?? "cos(t)";
  const y = trajectoryNode.y ?? "sin(t)";
  const z = trajectoryNode.z ?? "0";
  const kin = computeKinematics({ x, y, z }, tVal, vars);

  const isStationary = kin.isStationary || kin.speed < 1e-7;
  const crossMag = Math.sqrt(
    (kin.tangent.y * kin.binormal.z - kin.tangent.z * kin.binormal.y)**2 +
    (kin.tangent.z * kin.binormal.x - kin.tangent.x * kin.binormal.z)**2 +
    (kin.tangent.x * kin.binormal.y - kin.tangent.y * kin.binormal.x)**2
  );
  const isDegenerate = crossMag < 1e-7;
  const format = (value: number) => Number.isFinite(value) ? Number(value.toFixed(4)).toString() : "Indeterminado";
  const classification = (type: string | undefined) => type === "symbolic" ? " · simbólica"
    : type === "numerical" ? " · numérica" : "";
  const metrics = [
    ["Posición r(t)", "(" + [kin.position.x, kin.position.y, kin.position.z].map(format).join(", ") + ")"],
    ["Rapidez |v(t)|", format(kin.speed)],
    ["Aceleración tangencial", format(kin.tangentialAcceleration)],
    ["Aceleración normal", format(kin.normalAcceleration)],
    ["Curvatura κ", isStationary ? "Indeterminada" : format(kin.curvature) + classification(frameNode?.curvatureType)],
    ["Torsión τ", isDegenerate ? "Indeterminada" : format(kin.torsion) + classification(frameNode?.torsionType)],
    ["Radio osculador", isStationary || isDegenerate ? "Indeterminado" : format(kin.osculatingRadius)],
  ];
  panel.innerHTML = `
    <div class="bwjm-trajectory-header">
      <strong>Datos de la trayectoria</strong>
      <span>t = ${format(tVal)}</span>
    </div>
    <dl class="bwjm-trajectory-values">
      ${metrics.map(([label, value]) => "<div><dt>" + label + "</dt><dd>" + value + "</dd></div>").join("")}
    </dl>
  `;
}

function appendGraphSetting(table: HTMLTableSectionElement, name: string, control: HTMLInputElement | HTMLSelectElement,
  output?: HTMLOutputElement) {
  const row = table.insertRow();
  const heading = document.createElement("th");
  heading.scope = "row";
  const label = document.createElement("label");
  control.id = (table.parentElement?.id ?? "graph-settings") + "-" + row.rowIndex;
  label.htmlFor = control.id;
  label.textContent = name;
  heading.append(label);
  row.append(heading);
  const value = row.insertCell();
  if (output) {
    const range = document.createElement("div");
    range.className = "bwjm-graph-setting-range";
    output.htmlFor.add(control.id);
    range.append(control, output);
    value.append(range);
  } else value.append(control);
}

function appendGraphSettingGroup(table: HTMLTableSectionElement, title: string) {
  const heading = document.createElement("th");
  heading.colSpan = 2;
  heading.className = "bwjm-graph-settings-group";
  heading.textContent = title;
  table.insertRow().append(heading);
}

function appendGraphColor(controls: HTMLTableSectionElement, name: string, value: string | undefined,
  fallback: string, save: (color: string) => void): void {
  const input = document.createElement("input");
  input.type = "color";
  input.value = value && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
  input.onchange = () => save(input.value);
  appendGraphSetting(controls, name, input);
}

/** The document and interactive slider share this one educational readout. */
function updateVectorStudyReport(
  report: HTMLElement,
  data: { study?: VectorStudyResult; error?: string; showSteps?: boolean }
): void {
  const expanded = report.querySelector("details")?.open ?? false;
  report.replaceChildren();
  if (data.error) {
    report.textContent = "No se pudo construir el laboratorio: " + data.error;
    report.classList.add("has-error");
    return;
  }
  report.classList.remove("has-error");
  if (!data.study) return;
  const study = data.study;
  const heading = document.createElement("strong");
  heading.textContent = study.topic + " · Resultado: ⟨" +
    study.result.map(x => Number(x.toPrecision(10))).join(", ") + "⟩";
  report.appendChild(heading);
  const explanation = document.createElement("p");
  explanation.textContent = study.explanation;
  report.appendChild(explanation);
  const check = document.createElement("p");
  check.textContent = "Verificación: " + study.verification;
  report.appendChild(check);
  if (data.showSteps === false) return;
  const details = document.createElement("details");
  details.open = expanded;
  const summary = document.createElement("summary");
  summary.textContent = "Ver procedimiento (" + study.steps.length + " pasos)";
  details.appendChild(summary);
  const list = document.createElement("ol");
  for (const item of study.steps) {
    const li = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = item.title + ": ";
    li.appendChild(title);
    const math = document.createElement("span");
    math.textContent = item.expression;
    li.appendChild(math);
    const note = document.createElement("p");
    note.textContent = item.explanation;
    li.appendChild(note);
    list.appendChild(li);
  }
  details.appendChild(list);
  report.appendChild(details);
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMathToString(tex: string, displayMode: boolean): string {
  try {
    return renderToString(tex, {
      displayMode, throwOnError: false, trust: false, maxExpand: 1000,
      maxSize: 20, output: "htmlAndMathml",
    });
  } catch {
    return '<span class="bwjm-formula-error">No se pudo representar la fórmula.</span>';
  }
}

function renderTableBody(
  tbody: HTMLTableSectionElement,
  rows: ReadonlyArray<ReadonlyArray<string | number | boolean | null>>,
  precision: number = 6,
): void {
  tbody.replaceChildren();
  rows.forEach(values => {
    const tr = document.createElement("tr");
    values.forEach(value => {
      const td = document.createElement("td");
      const display = typeof value === "number" ? Number(value.toFixed(precision)) : value;
      td.textContent = display === null ? "—" : String(display);
      if (typeof value === "number") td.className = "numeric";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function renderStatisticsPanel(report: HTMLElement, data: any): void {
  report.replaceChildren();
  if (data?.error) { report.textContent = data.error; return; }
  if (!data?.summary) { report.textContent = "No hay muestras numéricas válidas."; return; }
  const metrics = { ...data.summary, ...(data.regression ?? {}) };
  Object.entries(metrics).forEach(([key, value]) => {
    const item = document.createElement("div");
    item.className = "bwjm-statistic";
    const label = document.createElement("span");
    label.textContent = key;
    const figure = document.createElement("strong");
    figure.textContent = typeof value === "number" ? String(Number(value.toPrecision(8))) : String(value);
    item.append(label, figure);
    report.appendChild(item);
  });
}

const SAMPLE_LESSONS: Record<string, { title: string; filename: string; content: string }> = {
  riemann: {
    title: "1. Área entre curvas y suma de Riemann",
    filename: "area_riemann.bwjm",
    content: `# Área entre curvas y suma de Riemann

Las curvas $f_a(x) = a\\cdot x$ y $g(x) = x^2$, con $a > 0$, se cruzan en $(0, 0)$ y $(a, a^2)$; la región encerrada está en $[0, a]$.

$$
A(a) = \\int_0^a (a\\cdot x - x^2)\\,dx = \\frac{a^3}{6}
$$

**Cuando $a = 1$**, el resultado particular es **1/6**; para otros valores de $a$, la referencia cambia junto con la región. La suma de punto medio aproxima esta área usando $n$ rectángulos.

## Parámetros de Riemann

\`\`\`slider
name: n
min: 2
max: 50
step: 1
default: 10
\`\`\`

\`\`\`slider
name: a
min: 0.1
max: 2
step: 0.1
default: 1
\`\`\`

## Ambas curvas, cruces y rectángulos en una escena

\`\`\`calculusviz
id: riemann-interactive
mode: area-dx
domain: [0, 2]
f: a*x
g: x^2
samples: 160
\`\`\`
`,
  },
  revolution: {
    title: "2. Sólidos de Revolución & Giro a 3π",
    filename: "solido_revolucion.bwjm",
    content: `# Sólido de Revolución y Giro Continuo

> **Regla geométrica (Sección 4):** Cuando una región plana gira en torno a un eje, tras $2\\pi$ se completa una vuelta entera. Continuar el barrido hasta $3\\pi$ añade un ciclo cinemático adicional, pero **el volumen del conjunto de puntos no varía tras $2\\pi$**.

El volumen del sólido generado por $y=x$ y $y=x^2$ al girar alrededor del eje $x$ es:

$$
V = \\pi \\int_{0}^{1} (x^2 - x^4)\\,dx = \\pi \\left[ \\frac{x^3}{3} - \\frac{x^5}{5} \\right]_0^1 = \\frac{2\\pi}{15} \\approx 0.41888
$$

## Control del Ángulo de Giro

Pulsa **Play** para observar el barrido en el espacio tridimensional de $0$ a $3\\pi$:

\`\`\`slider
name: alpha
min: 0.1
max: 9.42
step: 0.15
default: 6.28
\`\`\`

## Vista Tridimensional del Sólido

\`\`\`surface3d
equation: sqrt(x^2 + y^2) * sin(alpha * 0.1)
x: [-2, 2]
y: [-2, 2]
samples: 50
contours: true
\`\`\`
`,
  },
  surface: {
    title: "3. Superficie 3D y Oscilador Armónico",
    filename: "onda_armonica.bwjm",
    content: `# Superficie 3D y Oscilador Armónico

Visualización tridimensional interactiva de ondas estacionarias:

$$
z(x, y) = A \\cdot \\frac{\\sin(\\omega \\sqrt{x^2 + y^2})}{\\sqrt{x^2 + y^2}}
$$

\`\`\`slider
name: amplitud
min: 0.2
max: 3.0
step: 0.1
default: 1.5
\`\`\`

\`\`\`slider
name: frecuencia
min: 0.5
max: 4.0
step: 0.25
default: 1.5
\`\`\`

\`\`\`surface3d
equation: amplitud * sin(frecuencia * sqrt(x^2 + y^2 + 0.1))
x: [-6, 6]
y: [-6, 6]
samples: 55
contours: true
\`\`\`
`,
  },
  vector_calculus: {
    title: "4. Cinemática Espacial & Marco Frenet (TNB) en Hélice 3D",
    filename: "cinematica_helice_3d.bwjm",
    content: `# Cinemática Espacial y Triedro de Frenet-Serret

> **Geometría Diferencial de Curvas:** Para una partícula con trayectoria $\\mathbf{r}(t) = (\\cos t, \\sin t, t/3)$, el vector tangente $\\mathbf{T}$, la normal principal $\\mathbf{N}$ y la binormal $\\mathbf{B} = \\mathbf{T} \\times \\mathbf{N}$ constituyen un marco ortonormal móvil. La curvatura $\\kappa = 0.9$ y la torsión $\\tau = 0.3$ describen cómo la curva se flexiona y escapa de su plano osculador.

$$
\\mathbf{r}(t) = \\left( \\cos(t), \\sin(t), \\frac{t}{3} \\right), \\quad |\\mathbf{v}(t)| = \\frac{\\sqrt{10}}{3} \\approx 1.054, \\quad \\kappa = \\frac{9}{10} = 0.9, \\quad \\tau = \\frac{3}{10} = 0.3
$$

## Control de Tiempo y Movimiento

Ajusta el parámetro temporal $t$ o pulsa Play para activar la cinemática animada:

\`\`\`slider
name: t
min: 0.0
max: 6.28
step: 0.05
default: 1.57
\`\`\`

## Visualización Tridimensional de la Curva y Triedro Móvil

\`\`\`curve3d
x: cos(t)
y: sin(t)
z: t / 3
tDomain: [0, 6.28]
color: "#0284c7"
animated: true
showVectors: true
showTNB: true
showLegend: false
showInfo: false
\`\`\`
`,
  },
  vector_field: {
    title: "5. Campos Vectoriales 2D & Teorema de Green",
    filename: "campo_vectorial_green.bwjm",
    content: `# Campos Vectoriales, Circulación y Teorema de Green

> **Cálculo Vectorial:** Para el campo de velocidades en rotación rígida $\\mathbf{F}(x, y) = (-y, x)$, el rotacional mide la velocidad angular local $(\\nabla \\times \\mathbf{F})_z = 2$. Por el Teorema de Green, la circulación a lo largo de la frontera circular $C$ es igual a la integral doble del rotacional sobre el disco encerrado:

$$
\\oint_C \\mathbf{F} \\cdot d\\mathbf{r} = \\iint_D (\\nabla \\times \\mathbf{F})_z\\,dA = 2 \\cdot \\text{Área}(D) = 2\\pi \\approx 6.28318
$$

## Visualización del Campo Vectorial 2D

\`\`\`vectorfield2d
field: ["-y", "x"]
xDomain: [-3, 3]
yDomain: [-3, 3]
density: 12
color: "#0284c7"
\`\`\`
`,
  },
};

type ViewMode = "editor" | "split" | "reader";
const compactWorkspaceQuery = "(max-width: 960px)";

function subscribeToCompactWorkspace(listener: () => void): () => void {
  const query = window.matchMedia(compactWorkspaceQuery);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

function isCompactWorkspace(): boolean {
  return window.matchMedia(compactWorkspaceQuery).matches;
}

function extractOutline(source: string): OutlineItem[] {
  const lines = source.split("\n");
  const items: OutlineItem[] = [];
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;

    if (line.startsWith("# ")) {
      items.push({ level: 1, text: line.slice(2).trim(), lineNumber: i + 1 });
    } else if (line.startsWith("## ")) {
      items.push({ level: 2, text: line.slice(3).trim(), lineNumber: i + 1 });
    } else if (line.startsWith("### ")) {
      items.push({ level: 3, text: line.slice(4).trim(), lineNumber: i + 1 });
    }
  }

  return items;
}

export function BWJMStudio() {
  const {
    documents, activeId, markdown, filename, setMarkdown,
    openDocument, createDocument, selectDocument, closeDocument, markSaved, renameDocument,
    insertAtDocumentSnapshot,
  } = useDocumentWorkspace("sin_titulo.bwjm", "");
  const compactWorkspace = useSyncExternalStore(subscribeToCompactWorkspace, isCompactWorkspace);
  const [desktopView, setDesktopView] = useState<ViewMode>("split");
  const [compactView, setCompactView] = useState<Exclude<ViewMode, "split">>("reader");
  const viewMode = compactWorkspace ? compactView : desktopView;

  const [sliceX] = useState<number>(0.5);
  const [theme, setTheme] = useState<StudioThemeId>(readStoredTheme);
  // Appearance is a Studio preference, not a property of the scientific document.
  useEffect(() => { persistStudioTheme(theme); }, [theme]);

  // Auto-persist draft when content changes (debounced via localStorage)
  useEffect(() => {
    const timeout = setTimeout(() => {
      const currentDoc = documents.find(d => d.id === activeId);
      if (currentDoc && markdown !== currentDoc.savedContent) {
        persistDraft(filename, markdown);
      }
    }, 2000);
    return () => clearTimeout(timeout);
  }, [markdown, filename, activeId, documents]);

  // Recovery: check for unsaved draft on startup
  useEffect(() => {
    const draft = getDraft(filename);
    if (draft && draft !== markdown && draft.length > markdown.length * 0.1) {
      if (window.confirm(`Se encontró un borrador guardado de "${filename}" que no ha sido guardado.\n¿Desea recuperarlo?`)) {
        setMarkdown(draft);
      }
    }
  }, []); // Run only once on mount
  const [desktopSidebarMode, setDesktopSidebarMode] = useState<SidebarMode>(() =>
    normalizeSidebarMode(readSidebarPreference(SIDEBAR_MODE_KEY)));
  const [compactSidebarOpen, setCompactSidebarOpen] = useState(false);
  const sidebarMode: SidebarMode = compactWorkspace
    ? (compactSidebarOpen ? "expanded" : "hidden") : desktopSidebarMode;
  const compactSidebarVisible = compactWorkspace && compactSidebarOpen;
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(() =>
    normalizeSidebarTab(readSidebarPreference(SIDEBAR_TAB_KEY)));

  useEffect(() => {
    saveSidebarPreference(SIDEBAR_MODE_KEY, desktopSidebarMode);
  }, [desktopSidebarMode]);
  useEffect(() => {
    saveSidebarPreference(SIDEBAR_TAB_KEY, sidebarTab);
  }, [sidebarTab]);

  const showSidebar = () => {
    if (compactWorkspace) setCompactSidebarOpen(true);
    else setDesktopSidebarMode("expanded");
  };
  const hideSidebar = () => {
    if (compactWorkspace) setCompactSidebarOpen(false);
    else setDesktopSidebarMode("hidden");
  };
  const toggleSidebar = () => {
    if (compactWorkspace) setCompactSidebarOpen(value => !value);
    else setDesktopSidebarMode(value => value === "hidden" ? "expanded" : "hidden");
  };
  const showSidebarTab = (tab: SidebarTab) => {
    setSidebarTab(tab);
    showSidebar();
  };
  const setViewMode = (mode: ViewMode) => {
    if (!compactWorkspace) {
      setDesktopView(mode);
    } else if (mode !== "split") {
      setCompactView(mode);
      setCompactSidebarOpen(false);
    }
  };
  const [isRibbonCollapsed, setIsRibbonCollapsed] = useState(false);
  const [imageTarget, setImageTarget] = useState<{ id: string; source: string; offset: number }>();
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState<boolean>(false);
  const [formulaPreset, setFormulaPreset] = useState<{ kind: FormulaKind; mode: FormulaMode }>({
    kind: "expression", mode: "block",
  });
  const openFormulaComposer = (kind: FormulaKind = "expression", mode: FormulaMode = "block") => {
    setFormulaPreset({ kind, mode });
    setIsFormulaModalOpen(true);
  };
  const [isChartModalOpen, setIsChartModalOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [examplePickerOpen, setExamplePickerOpen] = useState(false);
  const [imageMessage, setImageMessage] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const workspaceLayoutRef = useRef<HTMLDivElement>(null);
  const compactViewRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<MathMDCore | null>(null);
  const activeTimersRef = useRef<Map<string, number>>(new Map());
  const plotlyRenderersRef = useRef<Map<string, PlotlyRenderer>>(new Map());
  const svgRenderersRef = useRef<Map<string, SVGRenderer>>(new Map());
  const openGraphSettingsRef = useRef<Set<string>>(new Set());
  const openCrossProductStepsRef = useRef<Set<string>>(new Set());
  const playbackRef = useRef<InlinePlaybackController | null>(null);
  const liveAnalysisRef = useRef<(() => void) | null>(null);
  const riemannUpdateRef = useRef<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const imageDestinationRef = useRef<DocumentInsertSnapshot | null>(null);

  useEffect(() => {
    if (compactSidebarVisible) {
      workspaceLayoutRef.current?.querySelector<HTMLButtonElement>(".bwjm-sidebar-close")?.focus();
    }
  }, [compactSidebarVisible]);

  const closeSidebar = () => {
    hideSidebar();
    if (compactWorkspace) {
      compactViewRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus();
    }
  };

  const editorView = useMemo(() => compactImageEditor(markdown), [markdown]);
  const { document: doc, root: markdownRoot } = useMemo(() => parseMathMDWithMarkdown(markdown), [markdown]);
  const outline = useMemo(() => extractOutline(markdown), [markdown]);
  
  const timelines = useMemo(() => 
    doc.children.filter(node => node.type === "timeline") as TimelineNode[], 
  [doc]);

  const wordCount = useMemo(() => {
    const clean = markdown.replace(/^\[bwjm-imagen-\d+\]: data:image\/[^\r\n]*/gim, "")
      .replace(/[#*`>$~-]/g, " ").trim();
    return clean ? clean.split(/\s+/).length : 0;
  }, [markdown]);

  // The visual editor shows short image markers; keep source bytes in markdown.
  const charCount = editorView.text.length;
  const lineCount = editorView.text.split("\n").length;

  const clearTimers = () => {
    activeTimersRef.current.forEach((id) => window.clearInterval(id));
    activeTimersRef.current.clear();
  };

  const clearRenderers = () => {
    playbackRef.current?.dispose();
    playbackRef.current = null;
    plotlyRenderersRef.current.forEach((renderer) => renderer.destroy());
    plotlyRenderersRef.current.clear();
    svgRenderersRef.current.clear();
  };

  useEffect(() => {
    return () => {
      clearTimers();
      clearRenderers();
    };
  }, []);

  const insertAtCursor = (prefix: string, suffix = "") => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMarkdown((prev) => prev + prefix + suffix);
      return;
    }
    const start = editorView.toSourceOffset(textarea.selectionStart, "start");
    const end = editorView.toSourceOffset(textarea.selectionEnd, "end");
    const selected = markdown.substring(start, end);
    const replacement = prefix + selected + suffix;
    const next = markdown.substring(0, start) + replacement + markdown.substring(end);
    const nextEditor = compactImageEditor(next);
    setMarkdown(next);
    if (compactWorkspace) setViewMode("editor");
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        nextEditor.toVisibleOffset(start + prefix.length, "start"),
        nextEditor.toVisibleOffset(start + prefix.length + selected.length, "end"),
      );
    }, 10);
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (imageTarget) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey &&
        (e.code === "Backslash" || e.code === "IntlBackslash")) {
        // Ctrl+B remains the editor's bold shortcut.
        e.preventDefault();
        toggleSidebar();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "F1") {
        e.preventDefault();
        setIsRibbonCollapsed(value => !value);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setExamplePickerOpen(false);
        setIsCommandPaletteOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        openFormulaComposer();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveFile();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [filename, markdown, imageTarget, compactWorkspace]);

  /**
   * Generates a document manifest with current state for reproducible reopening.
   */
  function generateManifest(doc: { children: any[] }, core: MathMDCore): string {
    const now = new Date().toISOString();
    const manifest: any = {
      manifestVersion: 1,
      engineVersion: "0.1.0",
      createdAt: now,
      updatedAt: now,
      initialConditions: {
        graphParameters: {},
        timelinePositions: {},
      },
    };

    // Capture graph parameters
    doc.children.forEach((node: any) => {
      if ("paramControls" in node && node.paramControls?.enabled) {
        const params = core.getGraphParameters(node.id);
        if (Object.keys(params).length > 0) {
          manifest.initialConditions.graphParameters[node.id] = params;
        }
      }
      // Capture timeline positions
      if (node.type === "timeline") {
        const value = core.getVariable(node.name);
        if (value !== undefined) {
          manifest.initialConditions.timelinePositions[node.name] = value;
        }
      }
    });

    const yaml = `manifestVersion: ${manifest.manifestVersion}
engineVersion: "${manifest.engineVersion}"
createdAt: "${manifest.createdAt}"
updatedAt: "${manifest.updatedAt}"
initialConditions:
  graphParameters: ${JSON.stringify(manifest.initialConditions.graphParameters, null, 2).replace(/\n/g, '\n  ')}
  timelinePositions: ${JSON.stringify(manifest.initialConditions.timelinePositions, null, 2).replace(/\n/g, '\n  ')}
`;

    return `\`\`\`manifest\n${yaml}\`\`\`\n\n`;
  }

  const handleSaveFile = () => {
    // Parse markdown to get document structure
    const { document: mathmdDoc } = parseMathMDWithMarkdown(markdown);
    // Create core instance with the parsed document to extract current state
    const core = new MathMDCore(mathmdDoc);
    
    const manifestBlock = generateManifest(mathmdDoc, core);
    const contentWithManifest = manifestBlock + markdown;
    
    const blob = new Blob([contentWithManifest], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    markSaved();
  };

  const handleOpenFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      openDocument(file.name, content);
      // Clear any existing draft when loading a saved file
      clearDraft(file.name);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  /** Validate both the file signature and browser decoding before embedding any bytes. */
  const readLocalImageData = async (file: File): Promise<string> => {
    if (file.size > MAX_LOCAL_IMAGE_BYTES) {
      throw new Error("La imagen supera 3 MiB. Comprímela antes de insertarla.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = validateLocalRaster(bytes, file.name, file.type);
    const blob = new Blob([bytes], { type: mime });
    try {
      if (typeof window.createImageBitmap === "function") {
        const bitmap = await window.createImageBitmap(blob);
        bitmap.close();
      } else {
        await new Promise<void>((resolve, reject) => {
          const url = URL.createObjectURL(blob);
          const image = new Image();
          image.onload = () => { URL.revokeObjectURL(url); resolve(); };
          image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("La imagen está corrupta o no se puede decodificar."));
          };
          image.src = url;
        });
      }
    } catch {
      throw new Error("La imagen está corrupta o no se puede decodificar.");
    }
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string"
        ? resolve(reader.result) : reject(new Error("La lectura de la imagen no produjo datos."));
      reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada."));
      reader.onabort = () => reject(new Error("La lectura de la imagen fue cancelada."));
      reader.readAsDataURL(blob);
    });
  };

  const pickLocalImage = (): void => {
    const input = imageFileInputRef.current;
    if (!input) return;
    const textarea = textareaRef.current;
    const start = viewMode === "reader"
      ? markdown.length
      : editorView.toSourceOffset(Math.min(textarea?.selectionStart ?? editorView.text.length, editorView.text.length), "start");
    const end = viewMode === "reader"
      ? markdown.length
      : editorView.toSourceOffset(Math.min(textarea?.selectionEnd ?? editorView.text.length, editorView.text.length), "end");
    // The picker and FileReader are asynchronous. Never infer destination from the
    // active tab once the dialog is closed.
    imageDestinationRef.current = { documentId: activeId, content: markdown, start, end };
    setImageMessage(null);
    input.value = ""; // selecting the same file again must fire a change event
    input.click();
  };

  const handleImageFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    const target = imageDestinationRef.current;
    imageDestinationRef.current = null;
    event.target.value = "";
    if (!file || !target) return; // Cancel never changes the document.
    try {
      const dataUrl = await readLocalImageData(file);
      const markup = portableImageMarkdown(file.name, dataUrl);
      const status = insertAtDocumentSnapshot(target, markup);
      if (status === "inserted") {
        setImageMessage("Imagen integrada en el documento original. Guárdalo para conservarla sin el archivo de origen.");
      } else if (status === "too-large") {
        setImageMessage("El documento superaría el límite de 12 MiB. Reduce la imagen o utiliza un documento más pequeño.");
      } else if (status === "edited") {
        setImageMessage("El documento se editó durante la lectura. No se insertó la imagen y se conservaron todos los cambios; inténtalo de nuevo.");
      } else {
        setImageMessage("La pestaña de destino se cerró o ya no admite la posición original. No se modificó ningún documento.");
      }
    } catch (error) {
      setImageMessage(error instanceof Error ? error.message : "No se pudo insertar la imagen.");
    }
  };

  const handleNewDocument = () => createDocument();

  function openImageDialog() {
    const textarea = textareaRef.current;
    const caret = textarea
      ? editorView.toSourceOffset(Math.min(textarea.selectionEnd, editorView.text.length), "end")
      : markdown.length;
    const block = markdownRoot.children?.find(node => node.position &&
      node.position.start.offset <= caret && caret <= node.position.end.offset);
    const offset = block?.position && block.type !== "paragraph" ? block.position.end.offset : caret;
    setImageTarget({ id: activeId, source: markdown, offset });
  }

  function insertImage({ dataUrl, alt, caption, width }: ImageInsertion): string | undefined {
    if (!imageTarget || activeId !== imageTarget.id || markdown !== imageTarget.source) {
      return "El documento cambió. Abre Insertar imagen de nuevo.";
    }
    const { content, cursor, identifier } = insertEmbeddedImage(markdown, imageTarget.offset, dataUrl, alt, caption, width);
    const children = parseMarkdown(content).children ?? [];
    const definition = children.some(node => node.type === "definition" && node.identifier === identifier);
    const reference = children.some(node => node.type === "paragraph" && node.children?.some(child =>
      child.type === "imageReference" && child.identifier === identifier));
    if (!definition || !reference) return "Cierra el bloque de código o fórmula antes de insertar la imagen.";
    setMarkdown(content);
    setImageTarget(undefined);
    setViewMode(compactWorkspace ? "reader" : "split");
    if (!compactWorkspace) {
      const visibleCursor = compactImageEditor(content).toVisibleOffset(cursor, "end");
      window.requestAnimationFrame(() => {
        textareaRef.current?.setSelectionRange(visibleCursor, visibleCursor);
        textareaRef.current?.focus();
      });
    }
  }

  const handleExportHtml = () => {
    const renderedBody = sheetRef.current ? sheetRef.current.innerHTML : "";
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(filename)} • BWJM Document</title>
  
  <style>
    ${markdownReaderStyles}
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b1120; color: #0f172a; padding: 2rem; display: flex; justify-content: center; }
    .bwjm-sheet { box-sizing: border-box; background: #ffffff; max-width: 860px; width: 100%; min-width: 0; padding: clamp(1rem, 5vw, 3rem); border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
    h1 { font-size: 2rem; font-weight: 800; color: #0f172a; margin-bottom: 1.5rem; }
    h2 { font-size: 1.4rem; font-weight: 700; color: #1e293b; margin: 2rem 0 1rem; }
    p { font-size: 1.05rem; line-height: 1.7; color: #334155; margin-bottom: 1rem; }
    .math-display-box { display: flex; overflow-x: auto; margin: 1.5rem 0; padding: 1rem; background: #f8fafc; border-radius: 6px; }
    .math-display-box > * { flex: none; margin-inline: auto; }
    .bwjm-svg-plot > svg { display: block; max-inline-size: 100%; block-size: auto; }
  </style>
</head>
<body>
  <div class="bwjm-sheet">
    ${renderedBody}
  </div>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.replace(/\.(bwjm|jm|md)$/, "") + ".html";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleNavigateOutline = (item: OutlineItem) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const lines = markdown.split("\n");
      let charIndex = 0;
      for (let i = 0; i < item.lineNumber - 1 && i < lines.length; i++) {
        charIndex += lines[i].length + 1;
      }
      const selectHeading = () => {
        textarea.focus();
        textarea.setSelectionRange(
          editorView.toVisibleOffset(charIndex, "start"),
          editorView.toVisibleOffset(charIndex + (lines[item.lineNumber - 1]?.length ?? 0), "end"),
        );
      };
      if (compactWorkspace) {
        setViewMode("editor");
        window.requestAnimationFrame(selectHeading);
      } else {
        selectHeading();
      }
    }
  };

  const handleCloseDocument = (id: string) => {
    const target = documents.find(item => item.id === id);
    if (target?.content !== target?.savedContent &&
      !window.confirm("El documento tiene cambios sin guardar. ¿Cerrar esta pestaña?")) return;
    closeDocument(id);
  };

  const handleSearchLocate = ({ start, end }: TextMatch) => {
    if (compactWorkspace) setViewMode("editor");
    else if (viewMode === "reader") setViewMode("split");
    window.requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(editorView.toVisibleOffset(start, "start"), editorView.toVisibleOffset(end, "end"));
      const row = markdown.slice(0, start).split("\n").length - 1;
      const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight) || 23;
      textarea.scrollTop = Math.max(0, row * lineHeight - textarea.clientHeight / 3);
    });
  };

  /** Central handler for all actions registered in Ribbon.tsx. */
  const handleRibbonAction = (id: RibbonAction): void => {
    const fence = String.fromCharCode(96).repeat(3);
    switch (id) {
      case "open": fileInputRef.current?.click(); break;
      case "save": handleSaveFile(); break;
      case "export-html": handleExportHtml(); break;
      case "h1": insertAtCursor("# "); break;
      case "h2": insertAtCursor("## "); break;
      case "h3": insertAtCursor("### "); break;
      case "bold": insertAtCursor("**", "**"); break;
      case "italic": insertAtCursor("*", "*"); break;
      case "code": insertAtCursor(String.fromCharCode(96), String.fromCharCode(96)); break;
      case "quote": insertAtCursor("> "); break;
      case "list": insertAtCursor(markdown.slice(0, editorView.toSourceOffset(textareaRef.current?.selectionStart ?? editorView.text.length)).endsWith("\n") ? "- " : "\n\n- "); break;
      case "rule": insertAtCursor("\n\n---\n\n"); break;
      case "formula": openFormulaComposer(); break;
      case "graph": setIsChartModalOpen(true); break;
      case "table":
        insertAtCursor("\n\n| Columna 1 | Columna 2 |\n|---|---|\n| Dato 1 | Dato 2 |\n\n");
        break;
      case "picture": pickLocalImage(); break;
      case "equation": openFormulaComposer("expression", "block"); break;
      case "inline-math": openFormulaComposer("expression", "inline"); break;
      case "matrix": openFormulaComposer("matrix", "block"); break;
      case "integral": openFormulaComposer("integral", "inline"); break;
      case "slider": insertAtCursor("\n" + fence +
        "slider\nname: a\nmin: 0.1\nmax: 5\nstep: 0.1\ndefault: 1\n" + fence + "\n"); break;
      case "data-table":
        insertAtCursor("\n" + fence +
          "datatable\ncaption: Medición experimental\ncolumns: [Tiempo, Posición, Velocidad]\nunits: [s, m, m/s]\nrows:\n" +
          "  - [0, 0, 0]\n  - [1, 1.5, 3]\n  - [2, 6, 6]\nprecision: 3\n" +
          fence + "\n");
        break;
      case "vectorfield":
        insertAtCursor("\n" + fence +
          'vectorfield2d\nfield: ["-y", "x"]\nxDomain: [-3, 3]\nyDomain: [-3, 3]\ndensity: 12\n' + fence + "\n");
        break;
      case "riemann":
        openDocument(SAMPLE_LESSONS.riemann.filename, SAMPLE_LESSONS.riemann.content, "riemann"); break;
      case "view-editor": setViewMode("editor"); break;
      case "view-split": setViewMode("split"); break;
      case "view-reader": setViewMode("reader"); break;
      case "outline": showSidebarTab("outline"); break;
      case "inspector": showSidebarTab("inspector"); break;
      case "theme-linear": setTheme("linear"); break;
      case "theme-catppuccin": setTheme("catppuccin"); break;
      case "theme-tokyonight": setTheme("tokyonight"); break;
      case "commands": setExamplePickerOpen(false); setIsCommandPaletteOpen(true); break;
      case "examples": setExamplePickerOpen(true); setIsCommandPaletteOpen(true); break;
    }
  };

  const commandsList: CommandItem[] = [
    {
      id: "insert-scientific-table",
      title: "Insertar tabla científica exportable",
      category: "Datos",
      action: () => insertAtCursor("\n\n```datatable\ncaption: Medición experimental\ncolumns: [Tiempo, Posición, Velocidad]\nunits: [s, m, m/s]\nrows:\n  - [0, 0, 0]\n  - [1, 1.5, 3]\n  - [2, 6, 6]\nprecision: 3\n```\n"),
    },
    {
      id: "insert-image-modal",
      title: "Insertar imagen con pie y ancho",
      category: "Insertar",
      action: openImageDialog,
    },
    {
      id: "insert-formula",
      title: "Insertar Fórmula Matemática",
      category: "Matemáticas",
      shortcut: "Ctrl+Shift+M",
      action: () => openFormulaComposer(),
    },
    {
      id: "insert-chart",
      title: "Insertar Gráfica o Deslizador (Asistente)",
      category: "Gráficas",
      action: () => setIsChartModalOpen(true),
    },
    {
      id: "save-doc",
      title: "Guardar Documento",
      category: "Archivo",
      shortcut: "Ctrl+S",
      action: handleSaveFile,
    },
    {
      id: "open-doc",
      title: "Abrir Archivo (.bwjm)",
      category: "Archivo",
      shortcut: "Ctrl+O",
      action: () => fileInputRef.current?.click(),
    },
    {
      id: "export-html",
      title: "Exportar como HTML Interactivo",
      category: "Archivo",
      action: handleExportHtml,
    },
    {
      id: "mode-split",
      title: "Vista Dividida (Editor + Lector)",
      category: "Vista",
      action: () => setViewMode("split"),
    },
    {
      id: "mode-editor",
      title: "Modo Solo Editor",
      category: "Vista",
      action: () => setViewMode("editor"),
    },
    {
      id: "mode-reader",
      title: "Modo Solo Lector",
      category: "Vista",
      action: () => setViewMode("reader"),
    },
    {
      id: "toggle-outline",
      title: "Mostrar u ocultar el panel Documento",
      category: "Paneles",
      shortcut: "Ctrl+\\",
      action: toggleSidebar,
    },
    {
      id: "toggle-props",
      title: "Alternar Panel Derecho (Propiedades)",
      category: "Paneles",
      action: () => showSidebarTab("inspector"),
    },
    {
      id: "theme-linear",
      title: "Cambiar Tema a Linear Obsidian",
      category: "Tema",
      action: () => setTheme("linear"),
    },
    {
      id: "theme-catppuccin",
      title: "Cambiar Tema a Catppuccin Mocha",
      category: "Tema",
      action: () => setTheme("catppuccin"),
    },
    {
      id: "theme-tokyonight",
      title: "Cambiar Tema a Tokyo Night",
      category: "Tema",
      action: () => setTheme("tokyonight"),
    },
    {
      id: "load-lesson-1",
      title: "Abrir ejemplo: Área entre Curvas & Riemann",
      category: "Ejemplos",
      action: () => {
        openDocument(SAMPLE_LESSONS.riemann.filename, SAMPLE_LESSONS.riemann.content, "riemann");
      },
    },
    {
      id: "load-lesson-2",
      title: "Abrir ejemplo: Sólidos de Revolución (3π)",
      category: "Ejemplos",
      action: () => {
        openDocument(SAMPLE_LESSONS.revolution.filename, SAMPLE_LESSONS.revolution.content, "revolution");
      },
    },
    {
      id: "load-lesson-3",
      title: "Abrir ejemplo: Superficie 3D y Oscilador Armónico",
      category: "Ejemplos",
      action: () => {
        openDocument(SAMPLE_LESSONS.surface.filename, SAMPLE_LESSONS.surface.content, "surface");
      },
    },
    {
      id: "load-lesson-4",
      title: "Abrir ejemplo: Cinemática Espacial & Marco Frenet (TNB)",
      category: "Ejemplos",
      action: () => {
        openDocument(SAMPLE_LESSONS.vector_calculus.filename, SAMPLE_LESSONS.vector_calculus.content, "vector_calculus");
      },
    },
    {
      id: "load-lesson-5",
      title: "Abrir ejemplo: Campos Vectoriales 2D & Teorema de Green",
      category: "Ejemplos",
      action: () => {
        openDocument(SAMPLE_LESSONS.vector_field.filename, SAMPLE_LESSONS.vector_field.content, "vector_field");
      },
    },
  ];

  useEffect(() => {
    clearTimers();
    clearRenderers();
    riemannUpdateRef.current = null;

    const previousVariables = coreRef.current?.getVariables() ?? {};
    const previousCore = coreRef.current;
    coreRef.current = new MathMDCore(doc);
    // Keep local values after unrelated text edits when the chart ID stays stable.
    doc.children.forEach(node => {
      if (!supportsAdaptiveParameters(node) || !node.paramControls?.enabled) return;
      const previous = previousCore?.getGraphParameters(node.id) ?? {};
      node.paramControls.parameters.forEach(parameter => {
        const value = previous[parameter.name];
        if (value !== undefined && value >= parameter.min && value <= parameter.max) {
          coreRef.current?.setGraphParameter(node.id, parameter.name, value);
        }
      });
    });
    Object.entries(previousVariables).forEach(([name, value]) => {
      if (coreRef.current?.getVariable(name) !== undefined && Number.isFinite(value)) {
        coreRef.current.setVariable(name, value);
      }
    });
    const container = sheetRef.current;
    if (!container) return;

    container.replaceChildren();

    const sheet = document.createElement("article");
    sheet.className = "bwjm-sheet";

    const mounts = new Map<string, HTMLElement>();
    const rangeKey = (range: MathMDNode["range"]) => range.start.offset + ":" + range.end.offset;
    let inlinePlaybackMounted = false;

    const svgSizeHandlers = new Map<Element, (width: number) => void>();
    const pendingSvgSizes = new Map<Element, number>();
    let svgResizeFrame: number | undefined;
    const svgResizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(entries => {
      for (const entry of entries) pendingSvgSizes.set(entry.target, entry.contentRect.width);
      if (svgResizeFrame !== undefined) return;
      svgResizeFrame = window.requestAnimationFrame(() => {
        svgResizeFrame = undefined;
        pendingSvgSizes.forEach((width, element) => svgSizeHandlers.get(element)?.(width));
        pendingSvgSizes.clear();
      });
    });

    const mountSvg = (
      parent: HTMLElement, node: MathMDNode, width: number, height: number,
      initialData = coreRef.current?.getNodeData(node.id) ?? node,
    ) => {
      const mount = document.createElement("div");
      mount.id = "mount-" + node.id;
      mount.className = "bwjm-svg-plot";
      parent.appendChild(mount);

      const renderer = new SVGRenderer(mount, width, height);
      svgRenderersRef.current.set(node.id, renderer);
      renderer.render(initialData);

      let renderedWidth = width;
      svgSizeHandlers.set(mount, availableWidth => {
        const nextWidth = Math.min(width, Math.floor(availableWidth));
        if (nextWidth <= 0 || nextWidth === renderedWidth) return;
        renderedWidth = nextWidth;
        const nextHeight = Math.max(240, Math.round(nextWidth * height / width));
        renderer.resize(nextWidth, nextHeight);
        if (node.type === "calculusviz" && node.id === RIEMANN_LESSON_ID) {
          // Resizing must preserve the current partition, not restore the
          // generic calculusviz output cached by MathMDCore.
          riemannUpdateRef.current?.();
        } else {
          renderer.render(coreRef.current?.getNodeData(node.id) ?? initialData);
        }
      });
      svgResizeObserver?.observe(mount);
    };

    const curveReadouts: Array<[Extract<MathMDNode, { type: "curve3d" }>, HTMLElement]> = [];
    for (const diagnostic of doc.diagnostics) {
      if (!diagnostic.range || !diagnostic.blockType || diagnostic.severity !== "error") continue;
      const key = rangeKey(diagnostic.range);
      let diagnostics = mounts.get(key);
      if (!diagnostics) {
        diagnostics = document.createElement("div");
        mounts.set(key, diagnostics);
      }
      const box = document.createElement("div");
      box.className = "bwjm-diagnostic-box";
      box.innerHTML = `
        <div class="bwjm-diagnostic-title">SINTAXIS INVÁLIDA [${escapeHtml(diagnostic.blockType)}]</div>
        <div class="bwjm-diagnostic-msg">${escapeHtml(diagnostic.message)}</div>
        <div class="bwjm-diagnostic-code">${escapeHtml(markdown.slice(diagnostic.range.start.offset, Math.min(diagnostic.range.end.offset, diagnostic.range.start.offset + 400)))}</div>
      `;
      diagnostics.append(box);
    }
    for (const node of doc.children) {
        if (node.type === "timeline") {
          mounts.set(rangeKey(node.range), document.createElement("span"));
          continue;
        }
        const card = document.createElement("div");
        card.className = "bwjm-node-card";
        card.id = `node-${node.id}`;

        const cardHeader = document.createElement("div");
        cardHeader.className = "bwjm-node-header";
        const graphLabel = node.type === "calculusviz"
          ? node.mode === "riemann" ? "Área entre curvas" : "Áreas e integrales"
          : node.type === "conic" ? (node.conicType === "circle" || !node.conicType ? "Circunferencia" : node.conicType === "ellipse" ? "Elipse" : node.conicType === "parabola" ? "Parábola" : "Hipérbola")
          : node.type === "datachart" ? "Gráfica de datos" : graphLabels.get(node.type);
        cardHeader.innerHTML = `
          <span class="bwjm-node-tag">
            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
            ${escapeHtml(graphLabel ?? (node.type.toUpperCase() + " • " + node.id))}
          </span>
        `;
        if (node.type === "plot2d" || node.type === "surface3d" || node.type === "curve3d" || node.type === "parametric2d") {
          const formula = document.createElement("div");
          formula.className = "bwjm-node-equation";
          const latex = node.type === "curve3d"
            ? "\\mathbf{r}(t)=\\left(" + [node.x, node.y, node.z].map(expressionToLatex).join(",\\;") + "\\right)"
            : node.type === "parametric2d"
              ? "\\mathbf{r}(t)=\\left(" + [node.x, node.y].map(expressionToLatex).join(",\\;") + "\\right)"
              : (node.type === "surface3d" ? "z=" : "y=") + expressionToLatex(node.equation);
          formula.innerHTML = renderMathToString(latex, false);
          formula.title = node.type === "curve3d" ? [node.x, node.y, node.z].join(" , ")
            : node.type === "parametric2d" ? [node.x, node.y].join(" , ") : node.equation;
          cardHeader.appendChild(formula);
        }
        card.appendChild(cardHeader);

        const cardBody = document.createElement("div");
        cardBody.className = "bwjm-node-body";
        const crossStepsKey = activeId + ":" + node.range.start.offset;
        const crossReport = node.type === "crossproduct" && node.showSteps !== undefined
          ? createCrossProductReport(
              node.showSteps,
              openCrossProductStepsRef.current.has(crossStepsKey),
              open => {
                if (open) openCrossProductStepsRef.current.add(crossStepsKey);
                else openCrossProductStepsRef.current.delete(crossStepsKey);
              },
              () => {
                setMarkdown(previous => updateGraphOption(
                  previous, node.range, node.type, "reverseOrder", !node.reverseOrder));
              },
            ) : undefined;
        const determinant = node.type === "crossproduct" && node.showDeterminant
          ? createCrossProductDeterminant() : undefined;

        // Graph settings persist in the selected code fence, avoiding transient-only UI state.
        if (supportsAdaptiveParameters(node) || node.type === "crossproduct" || node.type === "datachart" ||
          node.type === "line3d" || node.type === "plane3d" || node.type === "conic" ||
          ((node.type === "vector2d" || node.type === "vector3d") && Boolean(node.mode))) {
          const options: Array<[string, string, string?]> = node.type === "curve3d" ? [
            ["animated", "Animar partícula"],
            ["showVectors", "Velocidad y aceleración"],
            ["showTNB", "Triedro de Frenet"],
            ["showLegend", "Leyenda"],
            ["showInfo", "Datos de la trayectoria"],
          ] : node.type === "surface3d" ? [
            ["contours", "Curvas de nivel"],
            ["animated", "Reproducir variación temporal"],
            ["showInfo", "Mostrar dominio"],
          ] : node.type === "parametric2d" ? [
            ["animated", "Animar partícula"],
            ["showTrail", "Estela"],
            ["showVelocity", "Velocidad"],
            ["showAcceleration", "Aceleración"],
            ["showTangent", "Tangente"],
            ["showNormal", "Normal"],
            ["followParticle", "Seguir partícula"],
          ] : node.type === "flow2d" ? [
            ["showVectors", "Flechas del campo"],
            ["showParticles", "Animar partículas"],
          ] : node.type === "plot2d" ? [
            ["grid", "Cuadrícula"],
          ] : node.type === "crossproduct" ? [
            ["showPlane", "Plano generado", "Geometría"],
            ["showNormal", "Normal orientada"],
            ["showArea", "Área del paralelogramo"],
            ["showTriangle", "Triángulo sombreado (1/2 |u×v|)"],
            ["showVolume", "Volumen paralelepípedo (u·(v×w))"],
            ["showCollapse", "Animar colapso del paralelepípedo", "Interacción"],
            ["showSignChallenge", "Desafío visual de signos"],
            ["reverseOrder", "Invertir orden"],
            ["showSteps", "Mostrar procedimiento matemático", "Procedimiento"],
            ["showDeterminant", "Mostrar determinante i, j, k"],
            ["showRightHand", "Regla de la mano derecha"],
            ["showAnticommutative", "Superponer normal opuesta (anticonmutatividad)"],
            ["showDistributive", "Distribución sobre suma u × (v + w)"],
            ["showIdentities", "Inspector de identidades guiadas"],
          ] : node.type === "conic" && (!node.conicType || node.conicType === "circle") ? [
            ["showCenter", "Centro"],
            ["showRadius", "Radio"],
            ["showDiameter", "Diámetro"],
            ["showChord", "Cuerda"],
            ["showSecant", "Secante"],
            ["showTangent", "Tangente"],
            ["showIntersections", "Intersecciones con los ejes"],
            ["showEquation", "Ecuación"],
            ["showInteractiveControls", "Arrastrar centro y puntos de la gráfica"],
          ] : node.type === "conic" && node.conicType === "ellipse" ? [
            ["showCenter", "Centro"],
            ["showFocus", "Focos"],
            ["showVertices", "Vértices"],
            ["showCoVertices", "Co-vértices"],
            ["showAxes", "Ejes mayor y menor"],
            ["showDirectrices", "Directrices"],
            ["showLatusRectum", "Lados rectos"],
            ["showTangent", "Tangente"],
            ["showEquation", "Ecuación"],
            ["showInteractiveControls", "Trasladar y cambiar semiejes"],
          ] : node.type === "line3d" ? [
            ["showPoint", "Mostrar punto P"],
            ["showDirection", "Mostrar vector director v"],
            ["showSegment", "Mostrar segmento"],
            ["showSteps", "Mostrar procedimiento matemático"],
          ] : node.type === "plane3d" ? [
            ["showPoint", "Mostrar punto P"],
            ["showNormal", "Mostrar normal n"],
            ["showIntercepts", "Mostrar interceptos ejes"],
            ["showSteps", "Mostrar procedimiento matemático"],
          ] : (node.type === "vector2d" || node.type === "vector3d") ? [
            ["showSteps", "Mostrar procedimiento matemático"],
          ] : [];
          const details = document.createElement("details");
          details.className = "bwjm-graph-settings";
          const settingsKey = node.type + ":" + node.range.start.offset;
          details.open = openGraphSettingsRef.current.has(settingsKey);
          const summary = document.createElement("summary");
          summary.textContent = "Personalizar gráfica";
          details.appendChild(summary);
          const controls = document.createElement("div");
          controls.className = "bwjm-graph-settings-controls";
          const table = document.createElement("table");
          table.className = "bwjm-graph-settings-table";
          table.id = "settings-" + node.id;
          table.setAttribute("aria-label", "Ajustes de la gráfica");
          const settingsRows = table.createTBody();
          const saveOption = (key: string, value: boolean | string) => {
            openGraphSettingsRef.current.add(settingsKey);
            setMarkdown(previous => {
              const updated = updateGraphOption(previous, node.range, node.type, key, value);
              if (updated === previous || value !== true || (key !== "animated" && key !== "showParticles")) return updated;
              const hasTimeControl = doc.children.some(item =>
                (item.type === "timeline" || item.type === "slider") && item.name === "t");
              if (hasTimeControl || ("timelineRef" in node && node.timelineRef)) return updated;
              const range = node.type === "curve3d" || node.type === "parametric2d" ? node.tDomain
                : node.type === "flow2d" ? [0, node.tMax] : [0, 2 * Math.PI];
              const fence = String.fromCharCode(96).repeat(3);
              const newline = previous.includes("\r\n") ? "\r\n" : "\n";
              return updated + ["", "", fence + "timeline", "name: t", "domain: [" + range.join(", ") + "]",
                "default: " + range[0], "loop: true", fence, ""].join(newline);
            });
          };
          options.forEach(([key, label, group]) => {
            if (node.type === "surface3d" && key === "animated" && !/\bt\b/.test(node.equation)) return;
            if (node.type === "curve3d" && !node.animated && (key === "showVectors" || key === "showTNB")) return;
            if (node.type === "parametric2d" && node.animated === false && key !== "animated") return;
            if (group) appendGraphSettingGroup(settingsRows, group);
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            const configured = (node as unknown as Record<string, unknown>)[key];
            const defaultOn = node.type === "conic" ? (node.conicType === "ellipse"
                ? ["showCenter","showFocus","showVertices","showCoVertices","showAxes","showEquation"].includes(key)
                : ["showCenter", "showEquation"].includes(key)) :
              node.type === "crossproduct" ? ["showPlane", "showNormal", "showArea"].includes(key) :
              key === "showSteps" || (key === "animated" && node.type === "parametric2d") ||
              (key === "showVectors" && node.type === "flow2d");
            checkbox.checked = typeof configured === "boolean" ? configured : defaultOn;
            checkbox.setAttribute("aria-label", label);
            checkbox.onchange = () => saveOption(key, checkbox.checked);
            appendGraphSetting(settingsRows, label, checkbox);
          });
          if (node.type === "surface3d") {
            const select = document.createElement("select");
            select.append(new Option("Escala por altura", "height"), new Option("Color uniforme", "solid"));
            select.value = node.color ? "solid" : "height";
            select.onchange = () => {
              if (select.value === "solid") saveOption("color", "#0284c7");
              else {
                openGraphSettingsRef.current.add(settingsKey);
                setMarkdown(previous => resetSurfaceColor(previous, node.range));
              }
            };
            appendGraphSetting(settingsRows, "Color de la superficie", select);
            if (node.color) appendGraphColor(settingsRows, "Color uniforme", node.color, "#0284c7",
              color => saveOption("color", color));
            if (node.contours) appendGraphColor(settingsRows, "Color de las curvas de nivel", node.contourColor,
              "#fbbf24", color => saveOption("contourColor", color));
          } else if (node.type === "conic") {
            appendGraphSettingGroup(settingsRows, "Apariencia");
            appendGraphColor(settingsRows, "Color de la cónica", node.color, "#0284c7",
              color => saveOption("color", color));
          } else if (node.type === "crossproduct") {
            appendGraphSettingGroup(settingsRows, "Apariencia");
            appendGraphColor(settingsRows, "Color del vector u", node.colorU, "#0284c7", color => saveOption("colorU", color));
            if (node.showPlane !== false) {
              appendGraphColor(settingsRows, "Color del plano", node.colorPlane, "#cbd5e1", color => saveOption("colorPlane", color));
            }
          } else if (node.type === "plot2d" || node.type === "curve3d" || node.type === "parametric2d" ||
            node.type === "vectorfield2d" || node.type === "flow2d" || node.type === "datachart" || node.type === "calculusviz") {
            const fallback = node.type === "flow2d" ? "#6366f1" : node.type === "calculusviz" ? "#a5b4fc" : "#0284c7";
            appendGraphColor(settingsRows, node.type === "calculusviz" ? "Color de la región" : "Color",
              node.color, fallback, color => saveOption("color", color));
          }
          if (settingsRows.rows.length) controls.append(table);
          details.addEventListener("toggle", () => {
            if (details.open) openGraphSettingsRef.current.add(settingsKey);
            else openGraphSettingsRef.current.delete(settingsKey);
          });
          // Slider para collapseFactor en crossproduct (animación de colapso T017)
          if (node.type === "crossproduct" && node.showCollapse) {
            appendGraphSettingGroup(settingsRows, "Colapso");
            const collapseRange = document.createElement("input");
            collapseRange.type = "range";
            collapseRange.min = "0";
            collapseRange.max = "1";
            collapseRange.step = "0.01";
            collapseRange.value = String(node.collapseFactor ?? 0);
            collapseRange.setAttribute("aria-label", "Factor de colapso del paralelepípedo");
            const collapseValue = document.createElement("output");
            collapseValue.textContent = `${Math.round((node.collapseFactor ?? 0) * 100)}%`;
            collapseRange.oninput = () => { 
              collapseValue.textContent = `${Math.round(Number(collapseRange.value) * 100)}%`; 
            };
            collapseRange.onchange = () => {
              openGraphSettingsRef.current.add(settingsKey);
              setMarkdown(previous => updateGraphOption(
                previous, node.range, node.type, "collapseFactor", Number(collapseRange.value)));
            };
            appendGraphSetting(settingsRows, "Factor de colapso", collapseRange, collapseValue);
            
            // Selector de objetivo de colapso (zero vs coplanar)
            const targetSelect = document.createElement("select");
            targetSelect.setAttribute("aria-label", "Objetivo de colapso");
            const targetOptions = [
              { value: "coplanar", label: "Coplanar (w en plano u,v)" },
              { value: "zero", label: "Vector cero (w → 0)" },
            ];
            targetOptions.forEach(opt => {
              const option = document.createElement("option");
              option.value = opt.value;
              option.textContent = opt.label;
              targetSelect.appendChild(option);
            });
            targetSelect.value = node.collapseTarget ?? "coplanar";
            targetSelect.onchange = () => {
              openGraphSettingsRef.current.add(settingsKey);
              setMarkdown(previous => updateGraphOption(
                previous, node.range, node.type, "collapseTarget", targetSelect.value));
            };
            appendGraphSetting(settingsRows, "Objetivo de colapso", targetSelect);
          }

          // Selector de modo de desafío de signos (T019)
          if (node.type === "crossproduct" && node.showSignChallenge) {
            appendGraphSettingGroup(settingsRows, "Desafío de signos");
            const modeSelect = document.createElement("select");
            modeSelect.setAttribute("aria-label", "Modo de desafío de signos");
            const modeOptions = [
              { value: "random", label: "Aleatorio (nuevos vectores cada vez)" },
              { value: "fixed", label: "Fijo (usar u, v actuales)" },
              { value: "quiz", label: "Quiz (preguntas secuenciales)" },
            ];
            modeOptions.forEach(opt => {
              const option = document.createElement("option");
              option.value = opt.value;
              option.textContent = opt.label;
              modeSelect.appendChild(option);
            });
            modeSelect.value = node.signChallengeMode ?? "random";
            modeSelect.onchange = () => {
              openGraphSettingsRef.current.add(settingsKey);
              setMarkdown(previous => updateGraphOption(
                previous, node.range, node.type, "signChallengeMode", modeSelect.value));
            };
            appendGraphSetting(settingsRows, "Modo de desafío", modeSelect);

            // Seed input para modo aleatorio reproducible
            const seedInput = document.createElement("input");
            seedInput.type = "number";
            seedInput.min = "0";
            seedInput.max = "2147483647";
            seedInput.step = "1";
            seedInput.value = String(node.signChallengeSeed ?? Math.floor(Math.random() * 1000000));
            seedInput.setAttribute("aria-label", "Semilla para generación aleatoria");
            seedInput.onchange = () => {
              openGraphSettingsRef.current.add(settingsKey);
              setMarkdown(previous => updateGraphOption(
                previous, node.range, node.type, "signChallengeSeed", Number(seedInput.value)));
            };
            appendGraphSetting(settingsRows, "Semilla aleatoria", seedInput);
          }
          if (node.type === "crossproduct") {
            controls.appendChild(createCrossProductEditor(node, {
              preview: (u, v) => {
                const study = crossReport
                  ? computeCrossProductStudy(u, v, node.reverseOrder, node.showSteps && node.showDeterminant, node.w, node.showIdentities, node.origin)
                  : undefined;
                const crossScene = study?.scene ?? computeCrossProductScene(u, v, node.reverseOrder, node.w, node.origin);
                plotlyRenderersRef.current.get(node.id)?.render({ ...node, u, v, crossScene });
                if (study) crossReport?.update(study);
                determinant?.update(describeCrossProductDeterminant(u, v, crossScene, node.reverseOrder));
              },
              save: (key, value) => {
                openGraphSettingsRef.current.add(settingsKey);
                setMarkdown(previous => updateCrossProductVector(previous, node.range, key, value));
              },
            }));
          }
          // Selector de modo para plane3d (T031-T048)
          if (node.type === "plane3d") {
            const modeSelect = document.createElement("select");
            modeSelect.setAttribute("aria-label", "Modo de definición del plano");
            const modeOptions = [
              { value: "point-normal", label: "Punto + Normal (punto + normal)" },
              { value: "three-points", label: "3 Puntos (A, B, C no colineales)" },
              { value: "point-vectors", label: "Punto + 2 Vectores (P + u, v)" },
              { value: "parametric", label: "Paramétrico (P + s·u + t·v)" },
              { value: "general", label: "Ecuación General (Ax + By + Cz + D = 0)" },
            ];
            modeOptions.forEach(opt => {
              const option = document.createElement("option");
              option.value = opt.value;
              option.textContent = opt.label;
              modeSelect.appendChild(option);
            });
            modeSelect.value = node.mode ?? "point-normal";
            modeSelect.onchange = () => {
              openGraphSettingsRef.current.add(settingsKey);
              setMarkdown(previous => updateGraphOption(
                previous, node.range, node.type, "mode", modeSelect.value));
            };
            appendGraphSetting(settingsRows, "Definición del plano", modeSelect);
          }

          // Controles específicos para cada modo de plane3d
          if (node.type === "plane3d") {
            const mode = node.mode ?? "point-normal";
            
            if (mode === "point-normal") {
              // point + normal inputs
              const addVectorInput = (key: "point" | "normal", labelText: string, defaultVal: number[]) => {
                const input = document.createElement("input");
                input.type = "text";
                input.value = (node[key] ?? defaultVal).join(", ");
                input.placeholder = "x, y, z";
                input.setAttribute("aria-label", labelText);
                input.onchange = () => {
                  openGraphSettingsRef.current.add(settingsKey);
                  const vals = input.value.split(",").map(v => parseFloat(v.trim()));
                  if (vals.length === 3 && vals.every(Number.isFinite)) {
                    setMarkdown(previous => updateGraphOption(
                      previous, node.range, node.type, key, vals as [number, number, number]));
                  }
                };
                appendGraphSetting(settingsRows, labelText, input);
              };
              addVectorInput("point", "Punto P", [0, 0, 0]);
              addVectorInput("normal", "Normal n", [1, 1, 1]);
            } else if (mode === "three-points") {
              const addPointInput = (key: "pointA" | "pointB" | "pointC", labelText: string, defaultVal: number[]) => {
                const input = document.createElement("input");
                input.type = "text";
                input.value = (node[key] ?? defaultVal).join(", ");
                input.placeholder = "x, y, z";
                input.setAttribute("aria-label", labelText);
                input.onchange = () => {
                  openGraphSettingsRef.current.add(settingsKey);
                  const vals = input.value.split(",").map(v => parseFloat(v.trim()));
                  if (vals.length === 3 && vals.every(Number.isFinite)) {
                    setMarkdown(previous => updateGraphOption(
                      previous, node.range, node.type, key, vals as [number, number, number]));
                  }
                };
                appendGraphSetting(settingsRows, labelText, input);
              };
              addPointInput("pointA", "Punto A", [0, 0, 0]);
              addPointInput("pointB", "Punto B", [1, 0, 0]);
              addPointInput("pointC", "Punto C", [0, 1, 0]);
            } else if (mode === "point-vectors" || mode === "parametric") {
              const addVectorInput = (key: "point" | "vectorU" | "vectorV", labelText: string, defaultVal: number[]) => {
                const input = document.createElement("input");
                input.type = "text";
                input.value = (node[key] ?? defaultVal).join(", ");
                input.placeholder = "x, y, z";
                input.setAttribute("aria-label", labelText);
                input.onchange = () => {
                  openGraphSettingsRef.current.add(settingsKey);
                  const vals = input.value.split(",").map(v => parseFloat(v.trim()));
                  if (vals.length === 3 && vals.every(Number.isFinite)) {
                    setMarkdown(previous => updateGraphOption(
                      previous, node.range, node.type, key, vals as [number, number, number]));
                  }
                };
                appendGraphSetting(settingsRows, labelText, input);
              };
              addVectorInput("point", "Punto P", [0, 0, 0]);
              addVectorInput("vectorU", "Vector u", [1, 0, 0]);
              addVectorInput("vectorV", "Vector v", [0, 1, 0]);
            } else if (mode === "general") {
              const addCoeffInput = (key: "A" | "B" | "C" | "D", labelText: string, defaultVal: number) => {
                const input = document.createElement("input");
                input.type = "number";
                input.step = "0.1";
                input.value = String(node[key] ?? defaultVal);
                input.setAttribute("aria-label", labelText);
                input.onchange = () => {
                  openGraphSettingsRef.current.add(settingsKey);
                  setMarkdown(previous => updateGraphOption(
                    previous, node.range, node.type, key, Number(input.value)));
                };
                appendGraphSetting(settingsRows, labelText, input);
              };
              addCoeffInput("A", "A", 1);
              addCoeffInput("B", "B", 0);
              addCoeffInput("C", "C", 0);
              addCoeffInput("D", "D", 0);
            }
          }
          // Controles numéricos para line3d (T021-T026)
          if (node.type === "line3d") {
            // tDomain min
            const tMinInput = document.createElement("input");
            tMinInput.type = "number";
            tMinInput.step = "0.1";
            tMinInput.value = String(node.tDomain?.[0] ?? -10);
            tMinInput.setAttribute("aria-label", "Valor mínimo del parámetro t");
            tMinInput.onchange = () => {
              openGraphSettingsRef.current.add(settingsKey);
              const newTDomain = [Number(tMinInput.value), node.tDomain?.[1] ?? 10] as [number, number];
              setMarkdown(previous => updateGraphOption(
                previous, node.range, node.type, "tDomain", newTDomain));
            };
            appendGraphSetting(settingsRows, "t mínimo", tMinInput);

            // tDomain max
            const tMaxInput = document.createElement("input");
            tMaxInput.type = "number";
            tMaxInput.step = "0.1";
            tMaxInput.value = String(node.tDomain?.[1] ?? 10);
            tMaxInput.setAttribute("aria-label", "Valor máximo del parámetro t");
            tMaxInput.onchange = () => {
              openGraphSettingsRef.current.add(settingsKey);
              const newTDomain = [node.tDomain?.[0] ?? -10, Number(tMaxInput.value)] as [number, number];
              setMarkdown(previous => updateGraphOption(
                previous, node.range, node.type, "tDomain", newTDomain));
            };
            appendGraphSetting(settingsRows, "t máximo", tMaxInput);

            // paramName
            const paramInput = document.createElement("input");
            paramInput.type = "text";
            paramInput.value = node.paramName ?? "t";
            paramInput.maxLength = 1;
            paramInput.setAttribute("aria-label", "Nombre del parámetro (t, s, u, etc.)");
            paramInput.onchange = () => {
              openGraphSettingsRef.current.add(settingsKey);
              setMarkdown(previous => updateGraphOption(
                previous, node.range, node.type, "paramName", paramInput.value));
            };
            appendGraphSetting(settingsRows, "Parámetro de la recta", paramInput);
          }

          // Controles numéricos para plane3d (T031-T034)
          if (node.type === "plane3d") {
            // xDomain min
            const xMinInput = document.createElement("input");
            xMinInput.type = "number";
            xMinInput.step = "0.5";
            xMinInput.value = String(node.xDomain?.[0] ?? -5);
            xMinInput.setAttribute("aria-label", "Límite mínimo del dominio x");
            xMinInput.onchange = () => {
              openGraphSettingsRef.current.add(settingsKey);
              const newXDomain = [Number(xMinInput.value), node.xDomain?.[1] ?? 5] as [number, number];
              setMarkdown(previous => updateGraphOption(
                previous, node.range, node.type, "xDomain", newXDomain));
            };
            appendGraphSetting(settingsRows, "x mínimo", xMinInput);

            // xDomain max
            const xMaxInput = document.createElement("input");
            xMaxInput.type = "number";
            xMaxInput.step = "0.5";
            xMaxInput.value = String(node.xDomain?.[1] ?? 5);
            xMaxInput.setAttribute("aria-label", "Límite máximo del dominio x");
            xMaxInput.onchange = () => {
              openGraphSettingsRef.current.add(settingsKey);
              const newXDomain = [node.xDomain?.[0] ?? -5, Number(xMaxInput.value)] as [number, number];
              setMarkdown(previous => updateGraphOption(
                previous, node.range, node.type, "xDomain", newXDomain));
            };
            appendGraphSetting(settingsRows, "x máximo", xMaxInput);

            // yDomain min
            const yMinInput = document.createElement("input");
            yMinInput.type = "number";
            yMinInput.step = "0.5";
            yMinInput.value = String(node.yDomain?.[0] ?? -5);
            yMinInput.setAttribute("aria-label", "Límite mínimo del dominio y");
            yMinInput.onchange = () => {
              openGraphSettingsRef.current.add(settingsKey);
              const newYDomain = [Number(yMinInput.value), node.yDomain?.[1] ?? 5] as [number, number];
              setMarkdown(previous => updateGraphOption(
                previous, node.range, node.type, "yDomain", newYDomain));
            };
            appendGraphSetting(settingsRows, "y mínimo", yMinInput);

            // yDomain max
            const yMaxInput = document.createElement("input");
            yMaxInput.type = "number";
            yMaxInput.step = "0.5";
            yMaxInput.value = String(node.yDomain?.[1] ?? 5);
            yMaxInput.setAttribute("aria-label", "Límite máximo del dominio y");
            yMaxInput.onchange = () => {
              openGraphSettingsRef.current.add(settingsKey);
              const newYDomain = [node.yDomain?.[0] ?? -5, Number(yMaxInput.value)] as [number, number];
              setMarkdown(previous => updateGraphOption(
                previous, node.range, node.type, "yDomain", newYDomain));
            };
            appendGraphSetting(settingsRows, "y máximo", yMaxInput);
          }

          // A single source of truth: all curve layers and numeric preferences
          // are edited here and persisted in the selected .bwjm block.
          if (node.type === "parametric2d") {
            const trailRange = document.createElement("input");
            trailRange.type = "range";
            trailRange.min = "2";
            trailRange.max = String(Math.min(500, node.samples ?? 200));
            trailRange.step = "1";
            trailRange.value = String(Math.min(Number(trailRange.max),
              Math.max(2, node.trailLength ?? 100)));
            trailRange.setAttribute("aria-label", "Longitud de estela");
            const trailValue = document.createElement("output");
            trailValue.textContent = trailRange.value;
            trailRange.oninput = () => { trailValue.textContent = trailRange.value; };
            trailRange.onchange = () => {
              openGraphSettingsRef.current.add(settingsKey);
              setMarkdown(previous => updateGraphNumericOption(
                previous, node.range, "parametric2d", "trailLength",
                Number(trailRange.value)));
            };
            appendGraphSetting(settingsRows, "Longitud de estela", trailRange, trailValue);
          }
          details.appendChild(controls);
          cardBody.appendChild(details);
        }

        try {
        if (node.type === "datatable" || node.type === "functiontable") {
          const tableNode = coreRef.current?.getNodeData(node.id) as DataTableNode | FunctionTableNode & { rows: Array<Array<string | number | boolean | null>> };
          const tableWrapper = document.createElement("div");
          tableWrapper.className = "bwjm-table-scroll";
          const table = document.createElement("table");
          table.className = "bwjm-scientific-table";
          if (tableNode.caption) {
            const caption = document.createElement("caption");
            caption.textContent = tableNode.caption;
            table.appendChild(caption);
          }
          const thead = document.createElement("thead");
          const headerRow = document.createElement("tr");
          tableNode.columns.forEach((name, col) => {
            const th = document.createElement("th");
            th.scope = "col";
            th.textContent = name;
            if (tableNode.units?.[col]) {
              const unit = document.createElement("small");
              unit.textContent = " [" + tableNode.units[col] + "]";
              th.appendChild(unit);
            }
            headerRow.appendChild(th);
          });
          thead.appendChild(headerRow);
          table.appendChild(thead);
          const tbody = document.createElement("tbody");
          renderTableBody(tbody, tableNode.rows, tableNode.precision);
          table.appendChild(tbody);
          tableWrapper.appendChild(table);
          const toolbar = document.createElement("div");
          toolbar.className = "bwjm-table-actions";
          const formats = ["csv", "tsv", "json"] as const;
          formats.forEach(format => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = "↓ " + format.toUpperCase();
            button.setAttribute("aria-label", "Exportar tabla a " + format.toUpperCase());
            button.addEventListener("click", () => {
              const live = coreRef.current?.getNodeData(node.id) as typeof tableNode ?? tableNode;
              const data = serializeScientificTable(live.columns, live.rows, format);
              const contentType = format === "json" ? "application/json" : "text/plain";
              const blob = new Blob([data], { type: contentType + ";charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = (tableNode.id || "tabla") + "." + format;
              anchor.click();
              URL.revokeObjectURL(url);
            });
            toolbar.appendChild(button);
          });
          const copy = document.createElement("button");
          copy.type = "button";
          copy.textContent = "Copiar TSV";
          copy.addEventListener("click", () => {
            const live = coreRef.current?.getNodeData(node.id) as typeof tableNode ?? tableNode;
            const data = serializeScientificTable(live.columns, live.rows, "tsv");
            void navigator.clipboard?.writeText(data);
          });
          toolbar.appendChild(copy);
          cardBody.appendChild(toolbar);
          cardBody.appendChild(tableWrapper);
        } else if (node.type === "statistics") {
          const data = coreRef.current?.getNodeData(node.id);
          const report = document.createElement("div");
          report.className = "bwjm-statistics-panel";
          renderStatisticsPanel(report, data);
          cardBody.appendChild(report);
        } else if (node.type === "datachart") {
          const mount = document.createElement("div");
          mount.style.width = "100%";
          mount.style.height = "400px";
          cardBody.appendChild(mount);
          const renderer = new PlotlyRenderer(mount);
          plotlyRenderersRef.current.set(node.id, renderer);
          renderer.render(coreRef.current.getNodeData(node.id) as any);
        } else if (node.type === "slider") {
          const sliderNode = node as SliderNode;
          const row = document.createElement("div");
          row.className = "bwjm-slider-row";

          const playBtn = document.createElement("button");
          playBtn.className = "bwjm-play-btn";
          playBtn.title = "Animar barrido cinemático";
          playBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;

          let isPlaying = false;
          playBtn.onclick = () => {
            if (isPlaying) {
              const timerId = activeTimersRef.current.get(sliderNode.name);
              if (timerId) {
                window.clearInterval(timerId);
                activeTimersRef.current.delete(sliderNode.name);
              }
              isPlaying = false;
              playBtn.classList.remove("playing");
              playBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
            } else {
              isPlaying = true;
              playBtn.classList.add("playing");
              playBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;

              const timerId = window.setInterval(() => {
                const currentVal = coreRef.current?.getVariables()[sliderNode.name] ?? sliderNode.default;
                let nextVal = currentVal + sliderNode.step;
                if (nextVal > sliderNode.max) {
                  nextVal = sliderNode.min;
                }
                rangeInput.value = nextVal.toFixed(2);
                valBadge.textContent = nextVal.toFixed(2);
                handleVariableChange(sliderNode.name, nextVal);
              }, 40);

              activeTimersRef.current.set(sliderNode.name, timerId);
            }
          };

          const label = document.createElement("label");
          label.htmlFor = "slider-" + sliderNode.id;
          label.textContent = sliderNode.label ?? sliderNode.name;

          const rangeInput = document.createElement("input");
          rangeInput.type = "range";
          rangeInput.id = label.htmlFor;
          rangeInput.min = String(sliderNode.min);
          rangeInput.max = String(sliderNode.max);
          rangeInput.step = String(sliderNode.step);
          rangeInput.value = String(sliderNode.default);
          rangeInput.className = "bwjm-range-input";

          const valBadge = document.createElement("span");
          valBadge.className = "bwjm-slider-val";
          valBadge.textContent = Number(sliderNode.default).toFixed(2);

          rangeInput.oninput = (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            valBadge.textContent = val.toFixed(2);
            handleVariableChange(sliderNode.name, val);
          };

          const isRiemannParameter = doc.children.some(graph => graph.type === "calculusviz" &&
            graph.mode === "riemann" && (graph.partitions === sliderNode.name || graph.upperBound === sliderNode.name));
          if (!isRiemannParameter) row.appendChild(playBtn);
          row.appendChild(label);
          row.appendChild(rangeInput);
          row.appendChild(valBadge);
          cardBody.appendChild(row);
        } else if (node.type === "checkbox") {
          const chkNode = node as CheckboxNode;
          const label = document.createElement("label");
          label.style.display = "flex";
          label.style.alignItems = "center";
          label.style.gap = "0.75rem";
          label.style.cursor = "pointer";

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = Boolean(chkNode.default);
          checkbox.style.width = "18px";
          checkbox.style.height = "18px";

          checkbox.onchange = (e) => {
            const checked = (e.target as HTMLInputElement).checked;
            handleVariableChange(chkNode.name, checked ? 1 : 0);
          };

          const textSpan = document.createElement("span");
          textSpan.style.fontWeight = "600";
          textSpan.textContent = chkNode.label || chkNode.name;

          label.appendChild(checkbox);
          label.appendChild(textSpan);
          cardBody.appendChild(label);
        } else if (node.type === "flow2d" || node.type === "parametric2d") {
          mountSvg(cardBody, node, 720, 380);
        } else if (node.type === "calculusviz") {
          if (node.id === RIEMANN_LESSON_ID && node.mode === "area-dx") {
            const vars = coreRef.current.getVariables();
            const initial = computeRiemannLesson(node, vars["a"] ?? 1, vars["n"] ?? 10);
            mountSvg(cardBody, node, 760, 430, initial.scene);
            const report = document.createElement("section");
            updateRiemannLessonReport(report, initial.study);
            cardBody.appendChild(report);
            riemannUpdateRef.current = () => {
              const current = coreRef.current?.getVariables();
              const renderer = svgRenderersRef.current.get(node.id);
              if (!current || !renderer) return;
              const view = computeRiemannLesson(node, current["a"] ?? 1, current["n"] ?? 10);
              renderer.render(view.scene);
              updateRiemannLessonReport(report, view.study);
            };
          } else {
          const data = coreRef.current.getNodeData(node.id);
          if (node.mode === "revolution") {
            const mount = document.createElement("div");
            mount.style.width = "100%";
            mount.style.height = "440px";
            cardBody.appendChild(mount);
            const renderer = new PlotlyRenderer(mount);
            plotlyRenderersRef.current.set(node.id, renderer);
            renderer.render(data);
          } else {
            mountSvg(cardBody, node, 760, 390, data);
          }
          const report = document.createElement("div");
          report.className = "bwjm-calculus-report";
          updateCalculusReport(report, data);
          cardBody.appendChild(report);
          }
        } else if (node.type === "conic") {
          let figure = createConicSVG(node);
          cardBody.appendChild(figure);
          if (!node.conicType || node.conicType === "circle") {
            const originalGeometry = resolveCircle(node);
            let report = buildCircleReport(node, originalGeometry);
            cardBody.appendChild(report);
            const previewCircle = (next: typeof originalGeometry, change: CircleInteraction = {}) => {
              const visualNode = {
                ...node,
                ...change.angles,
                tangentPoint: change.tangentPoint ?? node.tangentPoint,
                viewCenter: node.viewCenter ?? originalGeometry.center,
                viewSpan: node.viewSpan ?? Math.max(3, originalGeometry.radius * 1.55),
              };
              const fresh = createCircleSVG(visualNode, next);
              figure.replaceWith(fresh);
              figure = fresh;
              const updatedReport = buildCircleReport(visualNode, next);
              report.replaceWith(updatedReport);
              report = updatedReport;
            };
            const persistCircle = (change: CircleInteraction) => {
              openGraphSettingsRef.current.add(node.type + ":" + node.range.start.offset);
              setMarkdown(previous => updateCircleInteraction(previous, node.range,
                node, originalGeometry, change));
            };
            mountCircleDrag(cardBody, node, originalGeometry, previewCircle, persistCircle);
            mountCircleControls(cardBody, node, originalGeometry,
              next => previewCircle(next, { center: next.center, radius: next.radius }),
              (center,radius) => persistCircle({
                center: [center[0], center[1]], radius,
              }));
          } else if (node.conicType === "ellipse") {
            const geometry = resolveEllipse(node);
            let report = buildEllipseReport(node,geometry);
            cardBody.appendChild(report);
            mountEllipseControls(cardBody,node,geometry,
              next => {
                const fresh = createEllipseSVG(node,next);
                figure.replaceWith(fresh);
                figure = fresh;
                const updatedReport = buildEllipseReport(node,next);
                report.replaceWith(updatedReport);
                report = updatedReport;
              },
              (center,a,b) => {
                openGraphSettingsRef.current.add(node.type + ":" + node.range.start.offset);
                setMarkdown(previous => updateEllipseDimensions(previous,node.range,
                  [center[0],center[1]],a,b));
              });
          }
          const button = document.createElement("button");
          button.type = "button";
          button.className = "bwjm-export-svg";
          button.textContent = "↓ Exportar SVG";
          button.onclick = () => {
            const clone = figure.cloneNode(true) as SVGSVGElement;
            const blob = new Blob([new XMLSerializer().serializeToString(clone)],
              { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = node.id + ".svg";
            link.click();
            URL.revokeObjectURL(url);
          };
          cardBody.appendChild(button);
        } else if (node.type === "plot2d") {
          mountSvg(cardBody, node, 720, 360);
        } else if (node.type === "vector2d" || node.type === "vector3d") {
          const data = coreRef.current.getNodeData(node.id);
          if (node.type === "vector3d") {
            const mount = document.createElement("div");
            mount.id = `mount-${node.id}`;
            mount.style.width = "100%";
            mount.style.height = "420px";
            cardBody.appendChild(mount);
            const renderer = new PlotlyRenderer(mount);
            plotlyRenderersRef.current.set(node.id, renderer);
            renderer.render(data);
          } else {
            mountSvg(cardBody, node, 720, 360, data);
          }
          if (node.mode || data.error) {
            const report = document.createElement("section");
            report.className = "bwjm-calculus-report bwjm-vector-report";
            report.setAttribute("aria-label", "Procedimiento vectorial");
            updateVectorStudyReport(report, data);
            cardBody.appendChild(report);
          }
        } else if (node.type === "surface3d" || node.type === "crossproduct") {
          const mount = document.createElement("div");
          mount.id = `mount-${node.id}`;
          mount.style.width = "100%";
          mount.style.height = "420px";
          cardBody.appendChild(mount);

          const renderer = new PlotlyRenderer(mount);
          plotlyRenderersRef.current.set(node.id, renderer);

          const nodeData = coreRef.current.getNodeData(node.id);
          if (nodeData) {
            renderer.render(nodeData);
            if (crossReport && nodeData.crossStudy) {
              crossReport.update(nodeData.crossStudy);
              cardBody.appendChild(crossReport.element);
            }
            if (determinant && nodeData.crossDeterminant) {
              determinant.update(nodeData.crossDeterminant);
              cardBody.appendChild(determinant.element);
            }
          }
        } else if (node.type === "curve3d") {
          const mount = document.createElement("div");
          mount.id = `mount-${node.id}`;
          mount.style.width = "100%";
          mount.style.height = "420px";
          cardBody.appendChild(mount);

          const renderer = new PlotlyRenderer(mount);
          plotlyRenderersRef.current.set(node.id, renderer);

          const nodeData = coreRef.current.getNodeData(node.id) || node;
          const currentVars = coreRef.current.getGraphScope(node.id);
          const currentT = currentVars["t"] ?? (node as any).tDomain?.[1];
          renderer.render({
            ...nodeData, scope: currentVars, currentT,
            particle: node.animated === true,
            showTNB: node.animated === true && node.showTNB === true,
            showVectors: node.animated === true && node.showVectors === true,
            showLegend: node.showLegend === true,
          } as any);
        } else if (node.type === "vectorarrow") {
          const mount = document.createElement("div");
          mount.id = `mount-${node.id}`;
          mount.style.width = "100%";
          mount.style.height = "420px";
          cardBody.appendChild(mount);

          const renderer = new PlotlyRenderer(mount);
          plotlyRenderersRef.current.set(node.id, renderer);

          const nodeData = coreRef.current.getNodeData(node.id) || node;
          const currentVars = coreRef.current.getVariables();
          renderer.render({
            ...nodeData,
            scope: currentVars,
          } as any);
        } else if (node.type === "trajectory") {
          const mount = document.createElement("div");
          mount.id = `mount-${node.id}`;
          mount.style.width = "100%";
          mount.style.height = "420px";
          cardBody.appendChild(mount);

          const renderer = new PlotlyRenderer(mount);
          plotlyRenderersRef.current.set(node.id, renderer);

          const nodeData = coreRef.current.getNodeData(node.id) || node;
          const currentVars = coreRef.current.getVariables();
          const currentT = currentVars["t"] ?? (node as any).tDomain?.[0] ?? 0;
          renderer.render({
            ...nodeData,
            scope: currentVars,
            currentT,
          } as any);
        } else if (node.type === "particle") {
          const mount = document.createElement("div");
          mount.id = `mount-${node.id}`;
          mount.style.width = "100%";
          mount.style.height = "420px";
          cardBody.appendChild(mount);

          const renderer = new PlotlyRenderer(mount);
          plotlyRenderersRef.current.set(node.id, renderer);

          const nodeData = coreRef.current.getNodeData(node.id) || node;
          const currentVars = coreRef.current.getVariables();
          renderer.render({
            ...nodeData,
            scope: currentVars,
          } as any);
        } else if (node.type === "frame") {
          const mount = document.createElement("div");
          mount.id = `mount-${node.id}`;
          mount.style.width = "100%";
          mount.style.height = "420px";
          cardBody.appendChild(mount);

          const renderer = new PlotlyRenderer(mount);
          plotlyRenderersRef.current.set(node.id, renderer);

          const nodeData = coreRef.current.getNodeData(node.id) || node;
          const currentVars = coreRef.current.getVariables();
          renderer.render({
            ...nodeData,
            scope: currentVars,
          } as any);
        } else if (node.type === "field") {
          const mount = document.createElement("div");
          mount.id = `mount-${node.id}`;
          mount.style.width = "100%";
          mount.style.height = "420px";
          cardBody.appendChild(mount);

          const renderer = new PlotlyRenderer(mount);
          plotlyRenderersRef.current.set(node.id, renderer);

          const nodeData = coreRef.current.getNodeData(node.id) || node;
          const currentVars = coreRef.current.getVariables();
          renderer.render({
            ...nodeData,
            scope: currentVars,
          } as any);
        } else if (node.type === "region") {
          const mount = document.createElement("div");
          mount.id = `mount-${node.id}`;
          mount.style.width = "100%";
          mount.style.height = "420px";
          cardBody.appendChild(mount);

          const renderer = new PlotlyRenderer(mount);
          plotlyRenderersRef.current.set(node.id, renderer);

          const nodeData = coreRef.current.getNodeData(node.id) || node;
          const currentVars = coreRef.current.getVariables();
          renderer.render({
            ...nodeData,
            scope: currentVars,
          } as any);
        } else if (node.type === "camera") {
          const mount = document.createElement("div");
          mount.id = `mount-${node.id}`;
          mount.style.width = "100%";
          mount.style.height = "420px";
          cardBody.appendChild(mount);

          const renderer = new PlotlyRenderer(mount);
          plotlyRenderersRef.current.set(node.id, renderer);

          const nodeData = coreRef.current.getNodeData(node.id) || node;
          const currentVars = coreRef.current.getVariables();
          renderer.render({
            ...nodeData,
            scope: currentVars,
          } as any);
        } else if (node.type === "vectorfield2d") {
          mountSvg(cardBody, node, 720, 360);
        }

        // The large global clock is removed. Insert one small transport alongside
        // the first animated graph; existing layer checkboxes remain unchanged.
        if (node.type === "curve3d" && node.showInfo) {
          const panel = document.createElement("div");
          panel.className = "bwjm-live-analysis-panel bwjm-curve-readout";
          cardBody.appendChild(panel);
          curveReadouts.push([node, panel]);
        }
        if (node.type === "surface3d" && node.showInfo) {
          const domain = document.createElement("p");
          domain.className = "bwjm-graph-domain";
          domain.textContent = "Dominio · x ∈ [" + node.xDomain.join(", ") + "], y ∈ [" + node.yDomain.join(", ") + "]";
          cardBody.appendChild(domain);
        }
        if (!inlinePlaybackMounted && timelines.length > 0 && supportsInlinePlayback(node)) {
          const transport = createInlinePlayback(
            timelines,
            () => coreRef.current?.getVariables() ?? {},
            (name, value) => handleVariableChange(name, value),
          );
          const settingsControls = cardBody.querySelector(".bwjm-graph-settings-controls");
          if (settingsControls) settingsControls.appendChild(transport.element);
          else cardBody.appendChild(transport.element);
          playbackRef.current = transport;
          inlinePlaybackMounted = true;
        }

        const svgRenderer = svgRenderersRef.current.get(node.id);
        if (svgRenderer) {
          const exportButton = document.createElement("button");
          exportButton.type = "button";
          exportButton.className = "bwjm-export-svg";
          exportButton.textContent = "↓ Exportar SVG";
          exportButton.title = "Guardar el gráfico como imagen vectorial editable";
          exportButton.onclick = () => {
            const svg = svgRenderer.getElement().cloneNode(true) as SVGSVGElement;
            svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = node.id + ".svg";
            anchor.click();
            URL.revokeObjectURL(url);
          };
          cardBody.appendChild(exportButton);
        }
        } catch (error) {
          // An unbound coefficient must not crash the whole scientific document.
          const warning = document.createElement("div");
          warning.className = "bwjm-graph-runtime-warning";
          const description = error instanceof Error ? error.message : String(error);
          warning.textContent = "No se pudo graficar: " + description +
            (supportsAdaptiveParameters(node)
              ? ". Define los coeficientes al insertar la gráfica o con un parámetro del documento." : "");
          cardBody.appendChild(warning);
        }
        card.appendChild(cardBody);
        const key = rangeKey(node.range);
        const diagnostic = mounts.get(key);
        if (diagnostic) diagnostic.append(card);
        else mounts.set(key, card);
    }

    const renderMarkdown = createMarkdownReader(markdownRoot, renderMathToString, mounts, markdown);
    for (const node of markdownRoot.children ?? []) {
      const rendered = renderMarkdown(node);
      if (!rendered) continue;
      if (node.position && mounts.has(rangeKey(node.position))) sheet.append(rendered);
      else {
        const prose = document.createElement("div");
        prose.className = "bwjm-prose-block";
        prose.append(rendered);
        sheet.append(prose);
      }
    }

    const livePanel = document.createElement("div");
    livePanel.className = "bwjm-live-analysis-panel";
    sheet.appendChild(livePanel);

    const updateLiveScientificAnalysis = () => {
      const vars = coreRef.current?.getVariables() || {};
      for (const [curve, panel] of curveReadouts) {
        try {
          updateTrajectoryReadout(panel, curve, coreRef.current?.getGraphScope(curve.id) ?? vars);
        } catch (error) {
          panel.textContent = error instanceof Error ? error.message : String(error);
        }
      }
      const hasVisualNodes = doc.children.some(node =>
        ["trajectory", "field", "plot2d"].includes(node.type) &&
        (node as unknown as { showInfo?: boolean }).showInfo === true
      );
      if (!hasVisualNodes) {
        livePanel.style.display = "none";
        return;
      }
      livePanel.style.display = "block";

      const wantsInfo = (n: typeof doc.children[number]) =>
        (n as unknown as { showInfo?: boolean }).showInfo === true;
      const trajectoryNode = doc.children.find(n => n.type === "trajectory" && wantsInfo(n));
      const fieldNode = doc.children.find(n => (n.type === "vectorfield2d" || n.type === "field") && wantsInfo(n));
      const plot2dNodes = doc.children.filter(n => n.type === "plot2d" && wantsInfo(n));
      const regionNode = doc.children.find(n => n.type === "region");
      const frameNode = doc.children.find(n => n.type === "frame");

      if (trajectoryNode) {
        if (trajectoryNode.type === "trajectory") updateTrajectoryReadout(livePanel, trajectoryNode, vars, frameNode);
        return;
      }

      if (fieldNode) {
        const is3D = (fieldNode as any).dimensions === 3 || (fieldNode as any).type === "field" && (fieldNode as any).dimensions === 3;
        const components = (fieldNode as any).components || (fieldNode as any).field || ["-y", "x"];
        
        let fieldAnalysis = "";
        if (!is3D) {
          const sampleRes = sampleVectorField2D({ P: components[0], Q: components[1] }, [-3, 3], [-3, 3], 5, vars);
          const curlVal = sampleRes.curlAt(0, 0);
          const divVal = sampleRes.divergenceAt(0, 0);
          const isConservative = Math.abs(curlVal) < 1e-3;
          
          fieldAnalysis = `
            <div class="bwjm-panel-col">
              <div class="bwjm-col-title">Campo Vectorial 2D F = (${components[0]}, ${components[1]})</div>
              <div class="bwjm-metric-row">
                <span>Divergencia ∇ · F:</span>
                <strong style="color: #10b981;">${divVal.toFixed(4)} ${Math.abs(divVal) < 1e-6 ? "(Incompresible)" : ""}</strong>
              </div>
              <div class="bwjm-metric-row">
                <span>Rotacional (∇ × F)_z:</span>
                <strong style="color: #ea580c;">${curlVal.toFixed(4)} k</strong>
              </div>
              <div class="bwjm-metric-row">
                <span>Conservativo (estimado):</span>
                <strong style="color: ${isConservative ? "#10b981" : "#f59e0b"};">${isConservative ? "Sí" : "No"}</strong>
              </div>
            </div>
          `;
        } else {
          fieldAnalysis = `
            <div class="bwjm-panel-col">
              <div class="bwjm-col-title">Campo Vectorial 3D F = (${components[0]}, ${components[1]}, ${components[2] || "0"})</div>
              <div class="bwjm-metric-row">
                <span>Visualización:</span>
                <strong style="color: #0284c7;">Flechas 3D muestreadas</strong>
              </div>
            </div>
          `;
        }
        
        let greensAnalysis = "";
        if (regionNode && !is3D) {
          greensAnalysis = `
            <div class="bwjm-panel-col">
              <div class="bwjm-col-title">Región para Teorema de Green</div>
              <div class="bwjm-metric-row">
                <span>Frontera:</span>
                <strong>${(regionNode as any).boundary}</strong>
              </div>
              <div class="bwjm-metric-row">
                <span>Orientación:</span>
                <strong>${(regionNode as any).orientation ?? "ccw"}</strong>
              </div>
            </div>
          `;
        }

        livePanel.innerHTML = `
          <div class="bwjm-panel-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            <strong>Motor Científico BWJM • Análisis de Campos Vectoriales${!is3D ? " & Teorema de Green" : ""}</strong>
          </div>
          <div class="bwjm-panel-grid">
            ${fieldAnalysis}
            ${greensAnalysis}
          </div>
        `;
        return;
      }

      if (plot2dNodes.length > 0) {
        const aVal = vars["a"] ?? 1.0;
        const nVal = Math.round(vars["n"] ?? 10);
        const alphaVal = vars["alpha"] ?? 2 * Math.PI;

        const fStr = aVal === 1.0 ? "x" : `${aVal} * x`;
        const gStr = "x^2";

        const intersections = findIntersections(fStr, gStr, [0, 2]);
        const exactArea = computeExactArea(fStr, gStr, [0, 1], vars);
        const riemann = computeRiemannPartition(fStr, gStr, [0, 1], nVal, "midpoint", vars);
        const revVol = computeRevolutionVolume(fStr, gStr, [0, 1], "x", alphaVal, vars);
        const slice = computeCrossSection(fStr, gStr, sliceX, "x", vars);

        livePanel.innerHTML = `
          <div class="bwjm-panel-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            <strong>Motor Científico BWJM • Análisis de Área & Riemann</strong>
          </div>
          <div class="bwjm-panel-grid">
            <div class="bwjm-panel-col">
              <div class="bwjm-col-title">Puntos de Intersección</div>
              <div class="bwjm-metric-row">
                <span>Raíces resueltas:</span>
                <strong>${intersections.map((p) => `(${p.x}, ${p.y})`).join(" y ") || "Buscando..."}</strong>
              </div>
              <div class="bwjm-metric-row">
                <span>Área Exacta (∫):</span>
                <strong style="color: #0284c7;">${exactArea.exactFraction ? exactArea.exactFraction + " ≈ " : ""}${exactArea.value}</strong>
              </div>
            </div>
            <div class="bwjm-panel-col">
              <div class="bwjm-col-title">Suma de Riemann (n = ${nVal})</div>
              <div class="bwjm-metric-row">
                <span>Aproximación:</span>
                <strong style="color: #ea580c;">${riemann.riemannSum}</strong>
              </div>
              <div class="bwjm-metric-row">
                <span>Error Absoluto (|Δ|):</span>
                <strong style="color: ${riemann.error < 0.005 ? "#10b981" : "#f59e0b"};">${riemann.error}</strong>
              </div>
            </div>
            <div class="bwjm-panel-col">
              <div class="bwjm-col-title">Sólido de Revolución (α = ${Number(alphaVal.toFixed(2))} rad)</div>
              <div class="bwjm-metric-row">
                <span>Volumen Unión Espacial:</span>
                <strong style="color: #6366f1;">${revVol.rationalGuessOfPi ? revVol.rationalGuessOfPi + "π ≈ " : ""}${revVol.volume}</strong>
              </div>
              <div class="bwjm-metric-row">
                <span>Arandela en x = ${sliceX}:</span>
                <strong>R=${slice.outerRadius}, r=${slice.innerRadius} (Área: ${slice.washerArea})</strong>
              </div>
            </div>
          </div>
        `;
        return;
      }

      livePanel.innerHTML = `
        <div class="bwjm-panel-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          <strong>Motor Científico BWJM</strong>
        </div>
        <div class="bwjm-panel-grid">
          <div class="bwjm-panel-col">
            <div class="bwjm-col-title">Variables Activas</div>
            ${Object.entries(vars).map(([k, v]) => `
              <div class="bwjm-metric-row">
                <span>${k}:</span>
                <strong>${typeof v === 'number' ? v.toFixed(4) : v}</strong>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    };

    liveAnalysisRef.current = updateLiveScientificAnalysis;
    updateLiveScientificAnalysis();

    container.appendChild(sheet);
    return () => {
      svgResizeObserver?.disconnect();
      if (svgResizeFrame !== undefined) window.cancelAnimationFrame(svgResizeFrame);
    };
  }, [doc, markdown, filename, sliceX, activeId]);

  const handleVariableChange = (name: string, value: number) => {
    if (!coreRef.current) return;
    const dirtyNodeIds = coreRef.current.setVariable(name, value);
    const currentVars = coreRef.current.getVariables();

    dirtyNodeIds.forEach((nodeId) => {
      const nodeData = coreRef.current?.getNodeData(nodeId);
      if (!nodeData) return;

      const card = sheetRef.current?.querySelector(`#node-${nodeId}`);
      if (nodeData.type === "functiontable") {
        const tbody = card?.querySelector("table.bwjm-scientific-table tbody");
        if (tbody instanceof HTMLTableSectionElement) {
          renderTableBody(tbody, nodeData.rows, nodeData.precision);
        }
      }
      if (nodeData.type === "statistics") {
        const report = card?.querySelector(".bwjm-statistics-panel");
        if (report instanceof HTMLElement) renderStatisticsPanel(report, nodeData);
      }
      if (nodeData.type === "vector2d" || nodeData.type === "vector3d") {
        const report = card?.querySelector(".bwjm-vector-report");
        if (report instanceof HTMLElement) updateVectorStudyReport(report, nodeData);
      }

      if (nodeData.type === "calculusviz") {
        const report = card?.querySelector<HTMLElement>(".bwjm-calculus-report");
        if (report) updateCalculusReport(report, nodeData);
      }

      const svgRenderer = svgRenderersRef.current.get(nodeId);
      if (svgRenderer) {
        svgRenderer.render({
          ...nodeData,
        });
      }

      const plotlyRenderer = plotlyRenderersRef.current.get(nodeId);
      if (plotlyRenderer) {
        const currentT = currentVars["t"] ?? (nodeData as any).tDomain?.[1];
        const curveOpts = nodeData.type === "curve3d" ? {
          particle: nodeData.animated === true,
          showVectors: nodeData.animated === true && nodeData.showVectors === true,
          showTNB: nodeData.animated === true && nodeData.showTNB === true,
          showLegend: nodeData.showLegend === true,
        } : {};
        plotlyRenderer.render({
          ...nodeData, scope: coreRef.current?.getGraphScope(nodeId) ?? currentVars,
          currentT, ...curveOpts,
        } as any);
      }
    });

    plotlyRenderersRef.current.forEach((renderer, nodeId) => {
      if (dirtyNodeIds.includes(nodeId)) return;
      const nodeData = coreRef.current?.getNodeData(nodeId);
      if (nodeData) {
        const nodeType = (nodeData as any).type;
        if (["curve3d", "trajectory", "particle", "frame", "field", "region", "camera", "vectorarrow"].includes(nodeType)) {
          const currentT = currentVars["t"] ?? (nodeData as any).tDomain?.[1] ?? (nodeData as any).tDomain?.[0] ?? 0;
          renderer.render({
            ...nodeData,
            scope: coreRef.current?.getGraphScope(nodeId) ?? currentVars,
            currentT,
            particle: nodeType === "curve3d" && (nodeData as any).animated === true,
            showTNB: nodeType === "curve3d" && (nodeData as any).animated === true && (nodeData as any).showTNB === true,
            showVectors: nodeType === "curve3d" && (nodeData as any).animated === true && (nodeData as any).showVectors === true,
            showLegend: nodeType === "curve3d" && (nodeData as any).showLegend === true,
          } as any);
        }
      }
    });

    if (name === "a" || name === "n") {
      riemannUpdateRef.current?.();
    }
    if (liveAnalysisRef.current) {
      liveAnalysisRef.current();
    }
    
    window.dispatchEvent(new CustomEvent('bwjm-variable-change'));
  };

  const currentVariables = coreRef.current ? coreRef.current.getVariables() : {};

  return (
    <div className={`bwjm-app-container mode-${viewMode} theme-${theme}${compactWorkspace ? " is-compact" : ""}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".bwjm,.jm,.md,.txt"
        style={{ display: "none" }}
        onChange={handleOpenFile}
      />
      <input
        ref={imageFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        aria-label="Seleccionar imagen local"
        style={{ display: "none" }}
        onChange={handleImageFile}
      />

      <header className="bwjm-studio-header">
        <div className="bwjm-studio-brand">
          <span className="bwjm-studio-mark"><IconAtom size={17}/></span>
          <span className="bwjm-studio-name">BWJM <strong>Studio</strong></span>
          <span className="bwjm-studio-subtitle">Editor científico</span>
        </div>
        <DocumentSearch ref={searchRef} text={markdown} onLocate={handleSearchLocate}/>
        <div className="bwjm-studio-header-meta">
          <span className="bwjm-studio-active-name" title={filename}>{filename}</span>
          <span className={"bwjm-studio-diagnostics " + (doc.diagnostics.some(d => d.severity === "error") ? "has-errors" : "")}
            title={doc.diagnostics.length ? "Revisa los diagnósticos en Inspector" : "Sin errores de sintaxis"}>
            <IconCheck size={13}/>
            {doc.diagnostics.filter(d => d.severity === "error").length} errores
          </span>
        </div>
      </header>
      <DocumentTabs documents={documents} activeId={activeId}
        onSelect={selectDocument} onClose={handleCloseDocument} onNew={handleNewDocument}
        onRename={renameDocument} sidebarVisible={sidebarMode !== "hidden"}
        onToggleSidebar={toggleSidebar}/>
      <Ribbon activeView={viewMode} compactWorkspace={compactWorkspace} onAction={handleRibbonAction}
        theme={theme} onThemeChange={setTheme}
        collapsed={isRibbonCollapsed} onCollapseChange={setIsRibbonCollapsed}/>
      {imageMessage && <div className="bwjm-image-notice" role="status">{imageMessage}</div>}

      {compactWorkspace && (
        <div ref={compactViewRef} className="bwjm-compact-view" role="group" aria-label="Vista del documento">
          <button type="button" aria-pressed={viewMode === "editor"} aria-controls="bwjm-editor-panel"
            onClick={() => setViewMode("editor")}>Editor</button>
          <button type="button" aria-pressed={viewMode === "reader"} aria-controls="bwjm-reader-panel"
            onClick={() => setViewMode("reader")}>Lector</button>
        </div>
      )}

      <div ref={workspaceLayoutRef} className="bwjm-workspace-layout"
        onKeyDown={event => { if (compactSidebarVisible && event.key === "Escape") closeSidebar(); }}>
        <SidebarLeft
          tab={sidebarTab}
          mode={sidebarMode}
          onTabChange={setSidebarTab}
          onExpand={showSidebar}
          onCollapse={() => setDesktopSidebarMode("collapsed")}
          wordCount={wordCount}
          charCount={charCount}
          lineCount={lineCount}
          nodes={doc.children}
          diagnostics={doc.diagnostics}
          onClose={closeSidebar}
          outline={outline}
          variables={currentVariables}
          onNavigateOutline={handleNavigateOutline}
        />

        <main id="bwjm-workspace-active" className="bwjm-main-split" role="tabpanel"
          aria-labelledby={"tab-" + activeId} aria-hidden={compactSidebarVisible || undefined}
          style={{ visibility: compactSidebarVisible ? "hidden" : undefined }}>
          <section
            id="bwjm-editor-panel"
            className="bwjm-editor-panel"
            style={{ display: viewMode === "reader" ? "none" : undefined }}
          >
            <div className="bwjm-panel-toolbar">
              <span className="bwjm-panel-title">Editor de Código .bwjm</span>
              <span className="bwjm-char-count">{charCount} caracteres</span>
            </div>
            <textarea
              ref={textareaRef}
              className="bwjm-code-textarea"
              value={editorView.text}
              onChange={(e) => setMarkdown(editorView.restoreSource(e.target.value))}
              aria-label="Editor del documento, imágenes embebidas con referencias cortas"
              onKeyDown={event => {
                if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey &&
                  event.key.toLowerCase() === "b") {
                  event.preventDefault();
                  if (!event.repeat) handleRibbonAction("bold");
                }
              }}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
            />
          </section>

          <section
            id="bwjm-reader-panel"
            className="bwjm-preview-panel"
            style={{ display: viewMode === "editor" ? "none" : undefined }}
          >
            <div ref={sheetRef} className="bwjm-scroll-container" />
          </section>
        </main>


      </div>


      {imageTarget && <ImageModal onClose={() => setImageTarget(undefined)} onInsert={insertImage} />}

      <FormulaModal
        isOpen={isFormulaModalOpen}
        preset={formulaPreset}
        onClose={() => setIsFormulaModalOpen(false)}
        onInsert={(formulaText: string) => insertAtCursor(formulaText)}
      />

      <ChartModal
        isOpen={isChartModalOpen}
        documentVariables={doc.children.flatMap(node =>
          node.type === "slider" || node.type === "checkbox" || node.type === "timeline" ? [node.name] : [])}
        onClose={() => setIsChartModalOpen(false)}
        onInsert={(codeBlock: string) => insertAtCursor(codeBlock)}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => { setIsCommandPaletteOpen(false); setExamplePickerOpen(false); }}
        commands={commandsList.filter(command =>
          examplePickerOpen ? command.category === "Ejemplos" :
            (!compactWorkspace || command.id !== "mode-split"))}
      />
    </div>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<BWJMStudio />);
}
