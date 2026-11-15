export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_WIDTH = 2000;

const imageTypes = [
  { mime: "png", signature: [137, 80, 78, 71, 13, 10, 26, 10] },
  { mime: "jpeg", signature: [255, 216, 255] },
  { mime: "gif", signature: [71, 73, 70, 56], marker: 5, suffix: [97] },
  { mime: "webp", signature: [82, 73, 70, 70], marker: 8, suffix: [87, 69, 66, 80] },
];

export async function readEmbeddedImage(file: Blob): Promise<string> {
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new Error("Elige una imagen de hasta 5 MB.");
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const format = imageTypes.find(({ signature, marker = 0, suffix = [] }) =>
    signature.every((byte, index) => header[index] === byte) &&
    suffix.every((byte, index) => header[index + marker] === byte));
  if (!format) throw new Error("Elige una imagen PNG, JPG, GIF o WebP.");
  const raster = new Blob([file], { type: "image/" + format.mime });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(raster);
  });
}

export function parseEmbeddedImage(url: string): { src: string; width?: number } | undefined {
  if (url.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 64) return undefined;
  const match = /^(data:image\/(?:png|jpeg|gif|webp);base64,([A-Za-z0-9+/]+={0,2}))(?:#width=(\d{1,4}))?$/i.exec(url);
  if (!match || match[2].length % 4 !== 0) return undefined;
  const bytes = match[2].length * 3 / 4 - (match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0);
  if (bytes > MAX_IMAGE_BYTES) return undefined;
  const width = match[3] ? Number(match[3]) : undefined;
  return width === undefined || (width >= 1 && width <= MAX_IMAGE_WIDTH) ? { src: match[1], width } : undefined;
}

function plainLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function insertEmbeddedImage(source: string, offset: number, dataUrl: string,
  alt: string, caption: string, width?: number): { content: string; cursor: number; identifier: string } {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const ids = new Set(Array.from(source.matchAll(/\[bwjm-imagen-(\d+)\]/gi), match => match[1]));
  let number = 1;
  while (ids.has(String(number))) number += 1;
  const id = "bwjm-imagen-" + number;
  const altText = plainLine(alt).replace(/[\\[\]]/g, "\\$&");
  const title = plainLine(caption).replace(/[\\"]/g, "\\$&");
  const image = newline + newline + "![" + altText + "][" + id + "]" + newline + newline;
  const body = source.slice(0, offset) + image + source.slice(offset);
  const definition = "[" + id + "]: " + dataUrl + (width ? "#width=" + width : "") +
    (title ? ' "' + title + '"' : "");
  const separator = body.endsWith(newline + newline) ? "" : body.endsWith(newline) ? newline : newline + newline;
  return { content: body + separator + definition + newline, cursor: offset + image.length, identifier: id };
}
