import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Copy KaTeX assets (fonts and CSS) from node_modules to dist
 */
function copyKatexAssets() {
  const katexPath = join(__dirname, "..", "node_modules", "katex");
  const distPath = join(__dirname, "..", "dist");
  const fontsDistPath = join(distPath, "fonts");

  // Create dist directories
  mkdirSync(distPath, { recursive: true });
  mkdirSync(fontsDistPath, { recursive: true });

  // Copy CSS file
  const cssSrc = join(katexPath, "dist", "katex.min.css");
  const cssDest = join(distPath, "katex.min.css");
  if (existsSync(cssSrc)) {
    copyFileSync(cssSrc, cssDest);
    console.log(`Copied: ${cssSrc} -> ${cssDest}`);
  } else {
    console.warn(`CSS source not found: ${cssSrc}`);
  }

  // Copy font files
  const fontsSrc = join(katexPath, "dist", "fonts");
  if (existsSync(fontsSrc)) {
    const fontFiles = readdirSync(fontsSrc);
    for (const fontFile of fontFiles) {
      const src = join(fontsSrc, fontFile);
      const dest = join(fontsDistPath, fontFile);
      if (statSync(src).isFile()) {
        copyFileSync(src, dest);
        console.log(`Copied font: ${fontFile}`);
      }
    }
  } else {
    console.warn(`Fonts source not found: ${fontsSrc}`);
  }

  console.log("KaTeX assets copied successfully");
}

copyKatexAssets();