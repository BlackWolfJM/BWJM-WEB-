import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/** Read-only Markdown nodes shared by the scientific parser and Studio reader. */
export interface MarkdownNode {
  type: string;
  position?: {
    start: { line: number; column: number; offset: number };
    end: { line: number; column: number; offset: number };
  };
  children?: MarkdownNode[];
  value?: string;
  lang?: string | null;
  depth?: number;
  ordered?: boolean;
  start?: number | null;
  checked?: boolean | null;
  align?: Array<"left" | "center" | "right" | null>;
  url?: string;
  title?: string | null;
  alt?: string | null;
  identifier?: string;
}

const markdownParser = unified().use(remarkParse).use(remarkGfm).use(remarkMath).freeze();

export function parseMarkdown(source: string): MarkdownNode {
  return markdownParser.parse(source) as unknown as MarkdownNode;
}
