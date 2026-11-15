import React, { useEffect, useMemo, useRef, useState } from "react";
import { renderToString } from "katex";
import { IconX, IconCheck, IconFunction } from "./icons.js";
import {
  FORMULA_TEMPLATES, getFormulaTemplate, defaultFormulaValues,
  buildGuidedFormula, normalizeFormulaInput, serializeFormula,
  type FormulaKind, type FormulaMode, type FormulaValues,
} from "./formulaComposer.js";

interface FormulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (formulaText: string) => void;
  preset?: { kind: FormulaKind; mode: FormulaMode };
}

type EditorMode = "visual" | "latex";
const SYMBOLS = [
  { label: "π", latex: "\\pi" },
  { label: "α", latex: "\\alpha" },
  { label: "θ", latex: "\\theta" },
  { label: "∞", latex: "\\infty" },
  { label: "≤", latex: "\\le" },
  { label: "≥", latex: "\\ge" },
  { label: "±", latex: "\\pm" },
  { label: "√", latex: "\\sqrt{x}" },
  { label: "×", latex: "\\times" },
];

export const FormulaModal: React.FC<FormulaModalProps> = ({
  isOpen, onClose, onInsert, preset = { kind: "expression", mode: "block" },
}) => {
  const [editorMode, setEditorMode] = useState<EditorMode>("visual");
  const [kind, setKind] = useState<FormulaKind>(preset.kind);
  const [fields, setFields] = useState<FormulaValues>(() => defaultFormulaValues(preset.kind));
  const [latex, setLatex] = useState<string>(() => buildGuidedFormula(preset.kind, defaultFormulaValues(preset.kind)));
  const [mode, setMode] = useState<FormulaMode>(preset.mode);
  const [label, setLabel] = useState("1");
  const latexRef = useRef<HTMLTextAreaElement | null>(null);
  const guidedRef = useRef<HTMLInputElement | null>(null);

  // Each invocation starts from the tool the user clicked, not a stale previous formula.
  useEffect(() => {
    if (!isOpen) return;
    const values = defaultFormulaValues(preset.kind);
    setKind(preset.kind);
    setFields(values);
    setLatex(buildGuidedFormula(preset.kind, values));
    setMode(preset.mode);
    setEditorMode("visual");
    setLabel("1");
  }, [isOpen, preset.kind, preset.mode]);

  useEffect(() => {
    if (!isOpen || editorMode !== "visual") return;
    const timeout = window.setTimeout(() => guidedRef.current?.focus(), 50);
    return () => window.clearTimeout(timeout);
  }, [isOpen, editorMode, kind]);

  const template = getFormulaTemplate(kind);
  const incomplete = editorMode === "visual" &&
    template.fields.some(field => !(fields[field.key] ?? "").trim());
  const cleanLatex = normalizeFormulaInput(latex);

  const preview = useMemo(() => {
    if (!cleanLatex || incomplete) {
      return { html: "", error: "Completa los campos para visualizar tu fórmula." };
    }
    try {
      // Validate label too; KaTeX handles the actual math syntax.
      serializeFormula(cleanLatex, mode, label);
      const expression = mode === "numbered"
        ? cleanLatex + " \\tag{" + (label.trim() || "1") + "}"
        : cleanLatex;
      return {
        html: renderToString(expression, {
          displayMode: mode !== "inline", throwOnError: true, trust: false,
          maxExpand: 1000, maxSize: 20, output: "htmlAndMathml",
        }),
        error: "",
      };
    } catch {
      return {
        html: "",
        error: "No se pudo interpretar la fórmula. Comprueba que esté completa y revisa los símbolos.",
      };
    }
  }, [cleanLatex, incomplete, mode, label]);

  const chooseKind = (next: FormulaKind) => {
    const defaults = defaultFormulaValues(next);
    setKind(next);
    setFields(defaults);
    setLatex(buildGuidedFormula(next, defaults));
  };

  const updateField = (key: string, value: string) => {
    const next = { ...fields, [key]: value };
    setFields(next);
    setLatex(buildGuidedFormula(kind, next));
  };

  const insertSymbol = (symbol: string) => {
    setEditorMode("latex");
    setLatex(current => {
      const textarea = latexRef.current;
      if (!textarea) return current + (current ? " " : "") + symbol;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      return current.slice(0, start) + symbol + current.slice(end);
    });
  };

  const handleConfirm = () => {
    if (preview.error) return;
    try {
      const output = serializeFormula(cleanLatex, mode, label);
      onInsert(output);
      onClose();
    } catch {
      // The insertion button is disabled for invalid input; don't insert malformed source.
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleConfirm();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="bwjm-modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="bwjm-modal-container bwjm-formula-dialog" role="dialog" aria-modal="true"
        aria-labelledby="bwjm-formula-dialog-title" onClick={event => event.stopPropagation()}>
        <div className="bwjm-modal-header">
          <div className="bwjm-modal-title" id="bwjm-formula-dialog-title">
            <IconFunction size={18} />
            <span>Insertar fórmula matemática</span>
          </div>
          <button type="button" className="bwjm-modal-close" onClick={onClose} aria-label="Cerrar">
            <IconX size={16} />
          </button>
        </div>

        <div className="bwjm-modal-body">
          <div className="bwjm-formula-editor-switch" role="group" aria-label="Forma de crear la fórmula">
            <button type="button" className={editorMode === "visual" ? "selected" : ""}
              aria-pressed={editorMode === "visual"} onClick={() => {
                setEditorMode("visual");
                setLatex(buildGuidedFormula(kind, fields));
              }}>Editor visual</button>
            <button type="button" className={editorMode === "latex" ? "selected" : ""}
              aria-pressed={editorMode === "latex"} onClick={() => setEditorMode("latex")}>
              LaTeX avanzado
            </button>
          </div>

          {editorMode === "visual" ? (
            <>
              <div className="bwjm-modal-field">
                <span className="bwjm-modal-label">Elige qué quieres escribir</span>
                <div className="bwjm-formula-templates" role="group" aria-label="Tipos de fórmula">
                  {FORMULA_TEMPLATES.map(item => (
                    <button key={item.id} type="button"
                      className={"bwjm-formula-choice " + (kind === item.id ? "selected" : "")}
                      aria-pressed={kind === item.id} title={item.description}
                      onClick={() => chooseKind(item.id)}>
                      <strong aria-hidden="true">{item.symbol}</strong>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="bwjm-modal-field">
                <span className="bwjm-modal-label">{template.description}</span>
                <div className="bwjm-formula-fields">
                  {template.fields.map((field, index) => (
                    <label key={field.key} className="bwjm-formula-field">
                      <span>{field.label}</span>
                      <input ref={index === 0 ? guidedRef : undefined} type="text"
                        className="bwjm-modal-input" value={fields[field.key] ?? ""}
                        placeholder={field.placeholder} onChange={event => updateField(field.key, event.target.value)}
                        autoComplete="off" spellCheck={false} />
                    </label>
                  ))}
                </div>
                <small className="bwjm-formula-tip">Escribe valores normales, por ejemplo x, 2 o x^2. Los comandos se generan automáticamente.</small>
              </div>
            </>
          ) : (
            <div className="bwjm-modal-field">
              <label className="bwjm-modal-label" htmlFor="bwjm-formula-latex">Código LaTeX (opcional)</label>
              <textarea id="bwjm-formula-latex" ref={latexRef} rows={4} spellCheck={false}
                className={"bwjm-modal-textarea" + (preview.error ? " has-error" : "")}
                value={latex} onChange={event => setLatex(event.target.value)}
                placeholder="Ej. \frac{x^2+1}{2}" />
              <small className="bwjm-formula-tip">Puedes pegar una fórmula entre $...$ o $$...$$. Studio quitará esos delimitadores al insertarla.</small>
              <div className="bwjm-template-palette" role="group" aria-label="Símbolos matemáticos">
                {SYMBOLS.map(symbol => (
                  <button key={symbol.label} type="button" className="bwjm-template-chip"
                    onClick={() => insertSymbol(symbol.latex)}>{symbol.label}</button>
                ))}
              </div>
            </div>
          )}

          <div className="bwjm-modal-field">
            <span className="bwjm-modal-label">Cómo aparecerá en tu documento</span>
            <div className="bwjm-modal-radios">
              <label className="bwjm-radio-label"><input type="radio" name="formula-mode"
                checked={mode === "inline"} onChange={() => setMode("inline")} />
                <span>Dentro del texto</span></label>
              <label className="bwjm-radio-label"><input type="radio" name="formula-mode"
                checked={mode === "block"} onChange={() => setMode("block")} />
                <span>Centrada</span></label>
              <label className="bwjm-radio-label"><input type="radio" name="formula-mode"
                checked={mode === "numbered"} onChange={() => setMode("numbered")} />
                <span>Numerada</span></label>
            </div>
            {mode === "numbered" && (
              <label className="bwjm-formula-field bwjm-formula-tag">
                <span>Número o etiqueta</span>
                <input type="text" className="bwjm-modal-input" value={label}
                  onChange={event => setLabel(event.target.value)} maxLength={40} />
              </label>
            )}
          </div>

          <div className="bwjm-modal-field">
            <span className="bwjm-modal-label">Así se verá tu fórmula</span>
            <div className="bwjm-modal-preview-box bwjm-formula-preview"
              role="region" aria-label="Vista previa de la fórmula" aria-live="polite">
              {preview.error
                ? <span className="bwjm-formula-preview-message">{preview.error}</span>
                : <span dangerouslySetInnerHTML={{ __html: preview.html }} />}
            </div>
          </div>
        </div>

        <div className="bwjm-modal-footer">
          <button type="button" className="bwjm-btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="bwjm-btn-primary" onClick={handleConfirm}
            disabled={Boolean(preview.error)}>
            <IconCheck size={14} />
            <span>Insertar fórmula</span>
          </button>
        </div>
      </div>
    </div>
  );
};
