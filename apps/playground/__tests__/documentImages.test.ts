import { describe, expect, it } from "vitest";
import { parseMathMDWithMarkdown } from "@mathmd/parser";
import { insertEmbeddedImage, parseEmbeddedImage } from "../src/documentImages.js";

const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPgndIBAAHbASoDVGnEAAAAAElFTkSuQmCC";

describe("images embedded in Markdown documents", () => {
  it("keeps image bytes, alt, caption and width with the document around a scientific block", () => {
    const source = "## Figura\r\n\r\n" + ["```plot2d", "equation: x^2", "```", ""].join("\r\n");
    const { content, identifier } = insertEmbeddedImage(source, 9, image, "Muestra [A]", 'Pie "A"', 320);
    expect(content.replace(/\r\n/g, "")).not.toContain("\n");
    const { document, root } = parseMathMDWithMarkdown(content);
    expect(document.children.map(node => node.type)).toEqual(["plot2d"]);
    const reference = root.children?.find(node => node.type === "paragraph")?.children?.[0];
    expect(reference).toMatchObject({ type: "imageReference", identifier, alt: "Muestra [A]" });
    const definition = root.children?.find(node => node.type === "definition" && node.identifier === identifier);
    expect(definition?.title).toBe('Pie "A"');
    expect(parseEmbeddedImage(definition?.url ?? "")).toEqual({ src: image, width: 320 });
  });

  it("does not reuse an identifier already in the document", () => {
    const first = insertEmbeddedImage("", 0, image, "", "");
    const second = insertEmbeddedImage(first.content, first.cursor, image, "B", "");
    expect(second.identifier).not.toEqual(first.identifier);
    const { root } = parseMathMDWithMarkdown(second.content);
    expect(root.children?.filter(node => node.type === "definition")).toHaveLength(2);
  });

  it("rejects active image media types, invalid encoding and unsupported width", () => {
    expect(parseEmbeddedImage("data:image/svg+xml;base64,PHN2Zz4=")).toBeUndefined();
    expect(parseEmbeddedImage("data:image/png;base64,abc")).toBeUndefined();
    expect(parseEmbeddedImage(image + "#width=2001")).toBeUndefined();
  });
});
