import type { MarkdownNode } from "@mathmd/parser";
import { parseEmbeddedImage } from "./documentImages.js";

type Definition = MarkdownNode & { identifier: string; url: string };
type RenderMath = (tex: string, display: boolean) => string;
type Range = { start: { offset: number }; end: { offset: number } };

function rangeKey(range: Range): string {
  return range.start.offset + ":" + range.end.offset;
}

/** Render only known Markdown nodes, preserving the full document's reference definitions. */
export function createMarkdownReader(root: MarkdownNode, renderMath: RenderMath,
  mounts: ReadonlyMap<string, HTMLElement>, source: string): (node: MarkdownNode) => Node | undefined {
  const definitions = new Map<string, Definition>();
  function collect(node: MarkdownNode): void {
    if (node.type === "definition" && node.identifier && node.url && !definitions.has(node.identifier)) {
      definitions.set(node.identifier, { ...node, identifier: node.identifier, url: node.url });
    }
    node.children?.forEach(collect);
  }
  collect(root);

  function safeUrl(url: string, image: boolean): string | undefined {
    if (!url) return undefined;
    try {
      const { protocol } = new URL(url, "https://markdown.invalid");
      if (protocol === "http:" || protocol === "https:" || (!image && protocol === "mailto:")) return url;
    } catch { /* Ignore malformed destinations. */ }
    return undefined;
  }

  function imageInfo(node: MarkdownNode) {
    const reference = node.identifier ? definitions.get(node.identifier) : undefined;
    const url = node.url ?? reference?.url ?? "";
    return { url, caption: node.title ?? reference?.title, embedded: parseEmbeddedImage(url) };
  }

  function renderImage(node: MarkdownNode): HTMLElement {
    const { url, caption, embedded } = imageInfo(node);
    const src = embedded?.src ?? safeUrl(url, true);
    if (!src) {
      const unavailable = document.createElement("span");
      unavailable.className = "bwjm-image-unavailable";
      unavailable.textContent = node.alt || "Imagen no disponible";
      return unavailable;
    }
    const image = document.createElement("img");
    image.src = src;
    image.alt = node.alt ?? "";
    if (caption) image.title = caption;
    if (embedded?.width) image.width = embedded.width;
    image.decoding = "async";
    return image;
  }

  function appendChildren(target: Node, node: MarkdownNode): Node {
    for (const child of node.children ?? []) {
      const rendered = render(child);
      if (rendered) target.appendChild(rendered);
    }
    return target;
  }

  function render(node: MarkdownNode): Node | undefined {
    const mounted = node.position && mounts.get(rangeKey(node.position));
    if (mounted) return mounted;
    switch (node.type) {
      case "definition": return undefined;
      case "text":
      case "html": return document.createTextNode(node.value ?? "");
      case "break": return document.createElement("br");
      case "thematicBreak": return document.createElement("hr");
      case "image":
      case "imageReference": return renderImage(node);
      case "paragraph": {
        const only = node.children?.length === 1 ? node.children[0] : undefined;
        if (only?.type === "inlineMath" && only.position) {
          const raw = source.slice(only.position.start.offset, only.position.end.offset);
          if (/^\$\$(?!\$).+?(?<!\$)\$\$$/.test(raw)) return render({ type: "math", value: only.value });
        }
        if (only?.type === "image" || only?.type === "imageReference") {
          const figure = document.createElement("figure");
          figure.append(renderImage(only));
          const { embedded, caption } = imageInfo(only);
          if (embedded && caption) {
            const label = document.createElement("figcaption");
            label.textContent = caption;
            figure.append(label);
          }
          return figure;
        }
        return appendChildren(document.createElement("p"), node);
      }
      case "heading": return appendChildren(document.createElement("h" + (node.depth ?? 1)), node);
      case "strong": return appendChildren(document.createElement("strong"), node);
      case "emphasis": return appendChildren(document.createElement("em"), node);
      case "delete": return appendChildren(document.createElement("del"), node);
      case "blockquote": {
        const quote = document.createElement("blockquote");
        quote.className = "markdown-callout";
        return appendChildren(quote, node);
      }
      case "list": {
        const list = document.createElement(node.ordered ? "ol" : "ul");
        if (node.ordered && node.start != null) list.setAttribute("start", String(node.start));
        return appendChildren(list, node);
      }
      case "listItem": {
        const item = document.createElement("li");
        appendChildren(item, node);
        if (typeof node.checked === "boolean") {
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.disabled = true;
          checkbox.checked = node.checked;
          checkbox.toggleAttribute("checked", node.checked);
          checkbox.setAttribute("aria-label", node.checked ? "Tarea completada" : "Tarea pendiente");
          (item.querySelector("p") ?? item).prepend(checkbox, " ");
        }
        return item;
      }
      case "link":
      case "linkReference": {
        const definition = node.identifier ? definitions.get(node.identifier) : undefined;
        const href = safeUrl(node.url ?? definition?.url ?? "", false);
        if (!href) return appendChildren(document.createDocumentFragment(), node);
        const link = document.createElement("a");
        link.href = href;
        const title = node.title ?? definition?.title;
        if (title) link.title = title;
        return appendChildren(link, node);
      }
      case "code":
      case "inlineCode": {
        const code = document.createElement("code");
        code.textContent = node.value ?? "";
        if (node.type === "inlineCode") return code;
        const pre = document.createElement("pre");
        pre.append(code);
        return pre;
      }
      case "math":
      case "inlineMath": {
        const display = node.type === "math";
        const math = document.createElement(display ? "div" : "span");
        if (display) {
          math.className = "math-display-box";
          math.tabIndex = 0;
          math.setAttribute("role", "region");
          math.setAttribute("aria-label", "Fórmula");
        } else {
          math.className = "bwjm-inline-math";
        }
        math.innerHTML = renderMath(node.value ?? "", display);
        return math;
      }
      case "table": {
        const wrapper = document.createElement("div");
        wrapper.className = "bwjm-markdown-table-scroll";
        wrapper.tabIndex = 0;
        wrapper.setAttribute("role", "region");
        wrapper.setAttribute("aria-label", "Tabla Markdown");
        const table = document.createElement("table");
        const head = table.createTHead();
        const body = table.createTBody();
        (node.children ?? []).forEach((row, index) => {
          const tr = (index === 0 ? head : body).insertRow();
          (row.children ?? []).forEach((cell, column) => {
            const td = document.createElement(index === 0 ? "th" : "td");
            if (index === 0) td.setAttribute("scope", "col");
            const alignment = node.align?.[column];
            if (alignment) td.style.textAlign = alignment;
            appendChildren(td, cell);
            tr.append(td);
          });
        });
        wrapper.append(table);
        return wrapper;
      }
      default: return appendChildren(document.createDocumentFragment(), node);
    }
  }

  return render;
}
