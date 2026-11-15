import React, { useState } from "react";
import { IconFileText, IconList, IconSliders, IconLayers, IconX, IconSearch, IconSidebar } from "./icons.js";
import { SidebarRight } from "./SidebarRight.js";
import type { MathMDDiagnostic, MathMDNode } from "@mathmd/ast";

export interface OutlineItem {
  level: number;
  text: string;
  lineNumber: number;
}

export type SidebarTab = "outline" | "variables" | "inspector";
export type SidebarMode = "expanded" | "collapsed" | "hidden";

interface SidebarLeftProps {
  tab: SidebarTab;
  mode: SidebarMode;
  onTabChange: (tab: SidebarTab) => void;
  onExpand: () => void;
  onCollapse: () => void;
  onClose: () => void;
  wordCount: number;
  charCount: number;
  lineCount: number;
  nodes: MathMDNode[];
  diagnostics: MathMDDiagnostic[];
  outline: OutlineItem[];
  variables: Record<string, number>;
  onNavigateOutline: (item: OutlineItem) => void;
}

const tabs = [
  { id: "outline", label: "Esquema", Icon: IconList },
  { id: "variables", label: "Variables", Icon: IconSliders },
  { id: "inspector", label: "Inspector", Icon: IconLayers },
] as const;

export const SidebarLeft: React.FC<SidebarLeftProps> = ({
  tab, mode, onTabChange, onExpand, onCollapse, onClose,
  wordCount, charCount, lineCount, nodes, diagnostics,
  outline, variables, onNavigateOutline,
}) => {
  const [filter, setFilter] = useState("");
  if (mode === "hidden") return null;

  const collapsed = mode === "collapsed";
  const filteredOutline = outline.filter(item =>
    item.text.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()));
  const openTab = (next: SidebarTab) => {
    onTabChange(next);
    if (collapsed) onExpand();
  };

  return (
    <aside id="bwjm-document-sidebar"
      className={"bwjm-sidebar-left bwjm-document-sidebar bwjm-sidebar-mode-" + mode}
      aria-label="Panel del documento">
      <div className="bwjm-document-sidebar-header">
        {collapsed
          ? <button type="button" className="bwjm-sidebar-icon-button bwjm-sidebar-expand"
              onClick={onExpand} title="Expandir panel" aria-label="Expandir panel del documento">
              <IconSidebar size={18}/>
            </button>
          : <div className="bwjm-document-sidebar-title"><IconFileText size={16}/> <strong>Documento</strong></div>}
        <div className="bwjm-document-sidebar-actions">
          {!collapsed && <button type="button" className="bwjm-sidebar-icon-button bwjm-sidebar-collapse"
            onClick={onCollapse} title="Colapsar panel" aria-label="Colapsar panel del documento">
            <IconSidebar size={17}/>
          </button>}
          <button type="button" className="bwjm-sidebar-icon-button bwjm-sidebar-close"
            onClick={onClose} title="Ocultar panel" aria-label="Ocultar panel del documento">
            <IconX size={16}/>
          </button>
        </div>
      </div>

      <div className="bwjm-document-sidebar-tabs" role="tablist" aria-label="Herramientas del documento"
        aria-orientation={collapsed ? "vertical" : "horizontal"}>
        {tabs.map(({ id, label, Icon }) => (
          <button type="button" role="tab" key={id}
            id={"bwjm-sidebar-tab-" + id}
            aria-selected={tab === id} aria-label={collapsed ? label : undefined}
            aria-controls={collapsed ? undefined : "bwjm-sidebar-panel-" + id}
            className={"bwjm-document-sidebar-tab" + (tab === id ? " active" : "")}
            title={label} onClick={() => openTab(id)}>
            <Icon size={17}/>
            {!collapsed && <span>{label}</span>}
          </button>
        ))}
      </div>

      {!collapsed && <div className="bwjm-sidebar-content bwjm-document-sidebar-content"
        id={"bwjm-sidebar-panel-" + tab} role="tabpanel"
        aria-labelledby={"bwjm-sidebar-tab-" + tab}>
        {tab === "outline" && (
          <>
            <label className="bwjm-document-outline-filter">
              <IconSearch size={15}/>
              <span className="bwjm-visually-hidden">Buscar encabezados</span>
              <input type="search" value={filter} onChange={event => setFilter(event.target.value)}
                placeholder="Filtrar esquema..." aria-label="Filtrar esquema"/>
            </label>
            <nav className="bwjm-outline-list" aria-label="Encabezados del documento">
              {filteredOutline.length === 0 ? (
                <div className="bwjm-sidebar-empty">{outline.length === 0
                  ? "Agrega títulos con # para crear tu esquema."
                  : "No se encontraron encabezados."}</div>
              ) : filteredOutline.map((item, idx) => (
                <button type="button" key={item.lineNumber + "-" + idx}
                  className={"bwjm-outline-item level-" + item.level}
                  onClick={() => onNavigateOutline(item)}>
                  <span className="bwjm-outline-hash" aria-hidden="true">{"#".repeat(item.level)}</span>
                  <span className="bwjm-outline-text">{item.text}</span>
                </button>
              ))}
            </nav>
          </>
        )}
        {tab === "variables" && (
          <div className="bwjm-variables-list">
            {Object.keys(variables).length === 0
              ? <div className="bwjm-sidebar-empty">No hay variables o parámetros activos.</div>
              : Object.entries(variables).map(([name, value]) => (
                <div key={name} className="bwjm-variable-row">
                  <span className="bwjm-variable-name">{name}</span>
                  <output className="bwjm-variable-value">{Number(value.toFixed(4))}</output>
                </div>
              ))}
          </div>
        )}
        {tab === "inspector" && (
          <SidebarRight isOpen={true} onClose={() => onTabChange("outline")}
            wordCount={wordCount} charCount={charCount} lineCount={lineCount}
            nodes={nodes} diagnostics={diagnostics}/>
        )}
      </div>}

      {!collapsed && <div className="bwjm-document-sidebar-stats" aria-label="Resumen del documento">
        <div><span>Líneas</span><strong>{lineCount}</strong></div>
        <div><span>Palabras</span><strong>{wordCount}</strong></div>
        <div><span>Bloques</span><strong>{nodes.length}</strong></div>
      </div>}
    </aside>
  );
};
