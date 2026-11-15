import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Convert KaTeX font files to base64 data URIs and embed in CSS
 */
function embedFontsAsDataUris() {
  const katexFontsPath = join(__dirname, "..", "..", "..", "apps", "playground", "node_modules", "katex", "dist", "fonts");
  const distPath = join(__dirname, "..", "dist");
  const cssPath = join(distPath, "katex.min.css");

  if (!existsSync(katexFontsPath)) {
    console.error(`Source fonts directory not found: ${katexFontsPath}`);
    process.exit(1);
  }

  // Read the original CSS
  let css = readFileSync(cssPath, "utf-8");

  // Font files to embed
  const fontFiles = readdirSync(katexFontsPath);
  const fontExtensions = [".woff2", ".woff", ".ttf"];
  let embedded = 0;

  for (const fontFile of fontFiles) {
    const ext = fontFile.substring(fontFile.lastIndexOf("."));
    if (!fontExtensions.includes(ext)) continue;

    const src = join(katexFontsPath, fontFile);
    if (!statSync(src).isFile()) continue;

    const fontData = readFileSync(src);
    const base64 = fontData.toString("base64");
    const mimeType = ext === ".woff2" ? "font/woff2" : ext === ".woff" ? "font/woff" : "font/truetype";
    const dataUri = `data:${mimeType};base64,${base64}`;

    // Replace url(fonts/...) with data URI in CSS
    const urlPattern = new RegExp(`url\\(fonts/${fontFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`, "g");
    css = css.replace(urlPattern, `url(${dataUri})`);
    embedded++;
  }

  // Write the modified CSS
  writeFileSync(cssPath, css);
  console.log(`Embedded ${embedded} font files as data URIs in CSS`);
}

embedFontsAsDataUris();