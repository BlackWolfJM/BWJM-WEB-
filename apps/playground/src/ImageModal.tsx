import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { MAX_IMAGE_WIDTH, readEmbeddedImage } from "./documentImages.js";
import { IconFileText, IconX } from "./icons.js";

export interface ImageInsertion {
  dataUrl: string;
  alt: string;
  caption: string;
  width?: number;
}

export function ImageModal({ onClose, onInsert }: {
  onClose: () => void;
  onInsert: (image: ImageInsertion) => string | undefined;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const selection = useRef(0);
  const [image, setImage] = useState<string>();
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [width, setWidth] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    dialog.current?.showModal();
    return () => { selection.current += 1; };
  }, []);

  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const request = ++selection.current;
    setImage(undefined);
    setError("");
    setReading(Boolean(file));
    if (!file) return;
    try {
      const dataUrl = await readEmbeddedImage(file);
      const preview = new Image();
      preview.src = dataUrl;
      await preview.decode().catch(() => { throw new Error("No se pudo abrir la imagen."); });
      if (selection.current !== request) return;
      setImage(dataUrl);
      setAlt(file.name.replace(/\.[^.]+$/, "").slice(0, 200));
    } catch (reason) {
      if (selection.current === request) setError(reason instanceof Error ? reason.message : "No se pudo abrir la imagen.");
    } finally {
      if (selection.current === request) setReading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!image) return;
    const problem = onInsert({ dataUrl: image, alt, caption, width: width ? Number(width) : undefined });
    if (problem) setError(problem);
  }

  return <dialog ref={dialog} className="bwjm-modal-container bwjm-image-modal"
    aria-labelledby="bwjm-image-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <form onSubmit={submit}>
      <div className="bwjm-modal-header">
        <div className="bwjm-modal-title">
          <IconFileText size={18} />
          <h2 id="bwjm-image-title">Insertar imagen</h2>
        </div>
        <button type="button" className="bwjm-modal-close" onClick={onClose} aria-label="Cerrar"><IconX size={16} /></button>
      </div>
      <div className="bwjm-modal-body">
        <label className="bwjm-modal-field">
          <span className="bwjm-modal-label">Archivo de imagen</span>
          <input type="file" accept=".png,.jpg,.jpeg,.gif,.webp" onChange={selectImage}
            aria-describedby="bwjm-image-formats" />
        </label>
        <small id="bwjm-image-formats">PNG, JPG, GIF o WebP · hasta 5 MB</small>
        {reading && <p role="status">Abriendo imagen…</p>}
        {image && <>
          <img className="bwjm-image-preview" src={image} alt={alt} />
          <label className="bwjm-modal-field">
            <span className="bwjm-modal-label">Texto alternativo</span>
            <input className="bwjm-modal-input" value={alt} maxLength={200}
              onChange={event => setAlt(event.target.value)} />
          </label>
          <label className="bwjm-modal-field">
            <span className="bwjm-modal-label">Pie de imagen</span>
            <input className="bwjm-modal-input" value={caption} maxLength={200}
              onChange={event => setCaption(event.target.value)} />
          </label>
          <label className="bwjm-modal-field">
            <span className="bwjm-modal-label">Ancho (px)</span>
            <input className="bwjm-modal-input" type="number" min={1} max={MAX_IMAGE_WIDTH}
              placeholder="Automático" value={width} onChange={event => setWidth(event.target.value)} />
          </label>
        </>}
        {error && <p className="bwjm-calculus-error" role="alert">{error}</p>}
      </div>
      <div className="bwjm-modal-footer">
        <button type="button" className="bwjm-btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="bwjm-btn-primary" disabled={!image || reading}>Insertar</button>
      </div>
    </form>
  </dialog>;
}
